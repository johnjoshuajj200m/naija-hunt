import * as THREE from "three";
import { describe, expect, it } from "vitest";

import {
  collectSceneTextures,
  estimateShadowMapBytes,
  estimateTextureBytes,
  formatSnapshot,
  isStatsRequested,
} from "./statsSnapshot";

/** A texture that reports pixel dimensions without needing a browser image. */
function textureOf(width: number, height: number, options: Partial<THREE.Texture> = {}): THREE.Texture {
  const texture = new THREE.Texture({ width, height } as unknown as HTMLImageElement);
  Object.assign(texture, options);
  return texture;
}

describe("isStatsRequested", () => {
  it("is off by default and for anything but stats=1", () => {
    expect(isStatsRequested("")).toBe(false);
    expect(isStatsRequested("?stats=0")).toBe(false);
    expect(isStatsRequested("?stats=true")).toBe(false);
    expect(isStatsRequested("?debug=1")).toBe(false);
  });

  it("is on for stats=1, alongside other parameters", () => {
    expect(isStatsRequested("?stats=1")).toBe(true);
    expect(isStatsRequested("?a=2&stats=1")).toBe(true);
  });
});

describe("estimateTextureBytes", () => {
  it("counts 4 bytes per pixel plus a full mip chain (4/3) for a normal texture", () => {
    expect(estimateTextureBytes(textureOf(1024, 1024))).toBe(Math.round(1024 * 1024 * 4 * (4 / 3)));
  });

  it("counts no mip chain when the texture does not generate one", () => {
    expect(estimateTextureBytes(textureOf(512, 256, { generateMipmaps: false }))).toBe(512 * 256 * 4);
  });

  it("counts half-float images at 8 bytes per pixel", () => {
    const texture = textureOf(512, 256, { type: THREE.HalfFloatType, generateMipmaps: false });
    expect(estimateTextureBytes(texture)).toBe(512 * 256 * 8);
  });

  it("is zero for a texture with no image yet, never NaN", () => {
    expect(estimateTextureBytes(new THREE.Texture())).toBe(0);
  });
});

describe("collectSceneTextures", () => {
  it("finds material textures and the environment, counting shared images once", () => {
    const shared = textureOf(256, 256);
    const clone = shared.clone();
    const normal = textureOf(256, 256);
    const environment = textureOf(512, 256, { generateMipmaps: false });

    const scene = new THREE.Scene();
    scene.environment = environment;
    scene.add(new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial({ map: shared, normalMap: normal })));
    scene.add(new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial({ map: clone })));

    expect(collectSceneTextures(scene)).toHaveLength(3); // shared/clone, normal, environment
  });
});

describe("estimateShadowMapBytes", () => {
  it("counts only lights that cast shadows", () => {
    const scene = new THREE.Scene();
    const sun = new THREE.DirectionalLight();
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    scene.add(sun, new THREE.DirectionalLight());
    // Depth (4 bytes) plus the RGBA8 colour attachment (4 bytes) per texel.
    expect(estimateShadowMapBytes(scene)).toBe(1024 * 1024 * 8);
  });
});

describe("formatSnapshot", () => {
  it("labels estimates as estimates and flags that counts include the shadow pass", () => {
    const text = formatSnapshot(
      {
        drawCalls: 120,
        triangles: 250000,
        lines: 0,
        geometries: 60,
        gpuTextures: 40,
        shaderPrograms: 18,
        textureBytesEstimated: 105_000_000,
        shadowMapBytesEstimated: 4_194_304,
        frameMsAverage: 8.4,
        pixelRatio: 1,
        canvas: "1100x640",
      },
      "desktop",
    );
    expect(text).toContain("tier desktop");
    expect(text).toContain("draw calls 120 (incl. shadow pass)");
    expect(text).toContain("texture mem ~105.0 MB (est.)");
    expect(text).toContain("shaders 18");
  });
});
