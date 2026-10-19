import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";

import { RendererStats } from "../diagnostics/RendererStats";
import { isStatsRequested } from "../diagnostics/statsSnapshot";
import { createDistrict, type District } from "./createDistrict";
import { detectAssetTier, type AssetTier } from "./junction/assetList";
import { createJunction } from "./junction/createJunction";
import { HAZE_FAR, SUN_DIRECTION } from "./junction/junctionLayout";
import { loadJunctionAssets } from "./junction/loadJunctionAssets";
import { HAZE_COLOR } from "./sky";
import { ExploreController } from "../explore/ExploreController";

/** Same breakpoint as the menu: below it the menu is a bottom panel, above it a left column. */
const WIDE_LAYOUT_MIN_WIDTH = 1024;
/** Approximate pixel heights of the phone header and bottom menu panel the scene sits between. */
const COMPACT_HEADER_PX = 96;
const COMPACT_PANEL_PX = 404;
/** Width of the desktop menu column in pixels (23rem). */
const WIDE_MENU_PX = 368;

/**
 * What is on screen. While the junction's assets load there is only haze and light. If they cannot
 * be loaded (offline, blocked, a bad deploy) the original procedural street is shown instead, so the
 * menu never sits over an empty canvas.
 */
type SceneContent =
  | { kind: "loading" }
  | { kind: "junction"; district: District }
  | { kind: "fallback"; district: District };

/** Where the camera stands and looks, per layout, for each kind of scene. */
const CAMERA = {
  junction: {
    wide: { position: [3.2, 2.4, 17], target: [-1.5, 4.6, -40], drift: 0.6, lookDrift: 0.3 },
    compact: { position: [3.2, 2.4, 18], target: [-3.5, 4.8, -40], drift: 0.4, lookDrift: 0 },
  },
  fallback: {
    wide: { position: [3.2, 3, 16], target: [-1.5, 16, -40], drift: 0.6, lookDrift: 0.3 },
    compact: { position: [3.2, 3, 17], target: [-3.5, 16.2, -40], drift: 0.4, lookDrift: 0 },
  },
} as const;

/**
 * Frames the street for the layout. The projection is shifted so the subject sits in the part of
 * the screen the menu does not cover: between header and panel on phones, right of the column on
 * desktop.
 */
function CameraRig({ view }: { view: keyof typeof CAMERA }) {
  const appliedLayout = useRef("");

  useFrame(({ camera, size, clock }) => {
    if (!(camera instanceof THREE.PerspectiveCamera)) {
      return;
    }
    const wide = size.width >= WIDE_LAYOUT_MIN_WIDTH;

    // Projection only changes when the viewport changes.
    const layoutKey = `${wide ? "wide" : "compact"}-${size.width}x${size.height}`;
    if (appliedLayout.current !== layoutKey) {
      appliedLayout.current = layoutKey;
      // Phones use a very wide lens, but the view offset keeps only its central band, so edge stretch stays small.
      camera.fov = wide ? 62 : 98;
      if (wide) {
        camera.setViewOffset(size.width, size.height, -WIDE_MENU_PX / 2, 0, size.width, size.height);
      } else {
        const panelTop = Math.max(0.35, 1 - COMPACT_PANEL_PX / size.height);
        const headerBottom = Math.min(0.2, COMPACT_HEADER_PX / size.height);
        const bandCenter = (panelTop + headerBottom) / 2;
        camera.setViewOffset(size.width, size.height, 0, (0.5 - bandCenter) * size.height, size.width, size.height);
      }
      camera.updateProjectionMatrix();
    }

    const preset = CAMERA[view][wide ? "wide" : "compact"];
    const drift = Math.sin(clock.elapsedTime * 0.15);
    camera.position.set(preset.position[0] + drift * preset.drift, preset.position[1], preset.position[2]);
    camera.lookAt(preset.target[0] + drift * preset.lookDrift, preset.target[1], preset.target[2]);
  });

  return null;
}

function useSceneContent(tier: AssetTier): SceneContent {
  const gl = useThree((state) => state.gl);
  const scene = useThree((state) => state.scene);
  const camera = useThree((state) => state.camera);
  const [content, setContent] = useState<SceneContent>({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;
    let created: District | null = null;
    let environment: THREE.Texture | null = null;

    loadJunctionAssets(gl, tier)
      .then(async (assets) => {
        if (cancelled) {
          assets.dispose();
          return;
        }
        try {
          created = createJunction(assets);
        } catch (error) {
          assets.dispose(); // nothing owns these textures yet
          throw error;
        }
        environment = assets.environment;
        // The environment must be on the scene before compiling, or the shaders would be built without it
        // and compiled a second time on the first frame.
        scene.environment = environment;
        // Compile shaders without blocking the page, so the menu stays responsive while the scene prepares.
        // A failure here is not fatal: the first render compiles whatever is missing and reports any real error.
        await gl.compileAsync(created.root, camera, scene).catch(() => undefined);
        if (!cancelled) {
          setContent({ kind: "junction", district: created });
        }
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return;
        }
        // A warning, not an error: the page still works, with the simpler procedural street.
        console.warn("Junction assets could not be loaded; showing the procedural street instead.", error);
        // Release anything the failed attempt had created before the fallback takes over.
        if (environment && scene.environment === environment) {
          scene.environment = null;
        }
        created?.dispose();
        created = createDistrict();
        setContent({ kind: "fallback", district: created });
      });

    return () => {
      cancelled = true;
      if (environment && scene.environment === environment) {
        scene.environment = null;
      }
      created?.dispose();
    };
  }, [gl, scene, camera, tier]);

  return content;
}

function DistrictScene({ tier, showStats, playing, run }: { tier: AssetTier; showStats: boolean; playing: boolean; run: number }) {
  const content = useSceneContent(tier);
  const sunTarget = useMemo(() => {
    const target = new THREE.Object3D();
    target.position.set(0, 0, -8);
    return target;
  }, []);

  const district = content.kind === "loading" ? null : content.district;
  useFrame(({ clock }) => {
    district?.update(clock.elapsedTime);
  });

  const junction = content.kind === "junction";
  // With image-based lighting doing the ambient work, the hemisphere light is only a gentle fill.
  const shadowSize = tier === "mobile" ? 1024 : 2048;
  const sunPosition = SUN_DIRECTION.clone().multiplyScalar(60).add(sunTarget.position);

  return (
    <>
      <color attach="background" args={[HAZE_COLOR]} />
      <fog attach="fog" args={[HAZE_COLOR, playing ? 55 : junction ? 34 : 26, playing ? 220 : junction ? HAZE_FAR : 150]} />
      <hemisphereLight args={["#fff0d6", "#8a7458", junction ? 0.5 : 1.5]} />
      <primitive object={sunTarget} />
      <directionalLight
        position={junction ? sunPosition.toArray() : [9, 15, 12]}
        target={sunTarget}
        intensity={junction ? 3.8 : 2.5}
        color={junction ? "#ffcf98" : "#ffd7a5"}
        castShadow
        shadow-mapSize-width={junction ? shadowSize : 1024}
        shadow-mapSize-height={junction ? shadowSize : 1024}
        shadow-camera-near={1}
        shadow-camera-far={junction ? 130 : 90}
        shadow-camera-left={junction ? -38 : -30}
        shadow-camera-right={junction ? 38 : 30}
        shadow-camera-top={junction ? 38 : 34}
        shadow-camera-bottom={junction ? -38 : -34}
        shadow-bias={-0.0004}
        shadow-normalBias={0.04}
      />
      {district && <primitive object={district.root} />}
      {playing && junction ? <ExploreController key={run} /> : content.kind !== "loading" && <CameraRig view={junction ? "junction" : "fallback"} />}
      {showStats && <RendererStats tier={tier} />}
    </>
  );
}

export function DistrictPreview({ playing = false, run = 0 }: { playing?: boolean; run?: number }) {
  // Chosen once per page load: textures cannot be swapped cheaply later, and a phone should never fetch the big tier.
  const [tier] = useState<AssetTier>(detectAssetTier);
  const [showStats] = useState(() => isStatsRequested(window.location.search));

  return (
    <Canvas
      shadows="percentage"
      dpr={[1, 1.5]}
      camera={{ fov: 40, near: 0.1, far: 280, position: [5, 4.6, 16] }}
      gl={{ antialias: true, powerPreference: "high-performance" }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.05;
      }}
    >
      <DistrictScene tier={tier} showStats={showStats} playing={playing} run={run} />
    </Canvas>
  );
}
