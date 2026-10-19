import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";

import {
  collectSceneTextures,
  estimateShadowMapBytes,
  estimateTextureBytes,
  formatSnapshot,
  type RendererSnapshot,
} from "./statsSnapshot";

/**
 * Read-only renderer diagnostics, mounted only when the page URL has `?stats=1`.
 *
 * It reads `renderer.info` and walks the scene to estimate texture memory, and writes text into its
 * own DOM element outside the canvas. It never changes the scene, the renderer or any setting, and
 * it subscribes to the frame loop with the default priority on purpose: in react-three-fiber a
 * positive priority takes over rendering, which this must never do.
 *
 * `renderer.info` reports the frame that was just drawn, so counts include the shadow-map pass.
 */
export function RendererStats({ tier }: { tier: string }) {
  const gl = useThree((state) => state.gl);
  const scene = useThree((state) => state.scene);
  const live = useRef({ seconds: 0, frames: 0, element: null as HTMLElement | null });

  useEffect(() => {
    const element = document.createElement("pre");
    element.setAttribute("data-testid", "renderer-stats");
    element.setAttribute("aria-hidden", "true");
    Object.assign(element.style, {
      position: "fixed",
      top: "8px",
      right: "8px",
      zIndex: "60",
      margin: "0",
      padding: "6px 8px",
      font: "11px/1.35 ui-monospace, Consolas, monospace",
      color: "#d7f5dd",
      background: "rgba(0, 0, 0, 0.62)",
      borderRadius: "4px",
      pointerEvents: "none",
      whiteSpace: "pre",
    });
    document.body.appendChild(element);
    const state = live.current;
    state.element = element;
    return () => {
      element.remove();
      state.element = null;
    };
  }, []);

  useFrame((_state, delta) => {
    const current = live.current;
    current.seconds += delta;
    current.frames += 1;
    if (current.seconds < 0.5 || !current.element) {
      return;
    }
    const { render, memory } = gl.info;
    const canvas = gl.domElement;
    const snapshot: RendererSnapshot = {
      drawCalls: render.calls,
      triangles: render.triangles,
      lines: render.lines,
      geometries: memory.geometries,
      gpuTextures: memory.textures,
      shaderPrograms: gl.info.programs?.length ?? 0,
      textureBytesEstimated: collectSceneTextures(scene).reduce((sum, texture) => sum + estimateTextureBytes(texture), 0),
      shadowMapBytesEstimated: estimateShadowMapBytes(scene),
      frameMsAverage: (current.seconds / current.frames) * 1000,
      pixelRatio: gl.getPixelRatio(),
      canvas: `${canvas.width}x${canvas.height}`,
    };
    current.element.textContent = formatSnapshot(snapshot, tier);
    current.element.setAttribute("data-snapshot", JSON.stringify({ tier, ...snapshot }));
    current.seconds = 0;
    current.frames = 0;
  });

  return null;
}
