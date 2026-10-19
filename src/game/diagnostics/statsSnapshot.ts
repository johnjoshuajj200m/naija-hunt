import * as THREE from "three";

/** Diagnostics are opt-in: only `?stats=1` turns them on. Anything else, including `?stats=0`, is off. */
export function isStatsRequested(search: string): boolean {
  return new URLSearchParams(search).get("stats") === "1";
}

function dimensions(texture: THREE.Texture): { width: number; height: number } | null {
  const image = texture.image as
    | { width?: number; height?: number; naturalWidth?: number; naturalHeight?: number }
    | null
    | undefined;
  const width = image?.naturalWidth ?? image?.width;
  const height = image?.naturalHeight ?? image?.height;
  return width && height ? { width, height } : null;
}

/**
 * Estimated GPU bytes for one texture, from its pixel dimensions. This is NOT a driver measurement:
 * it assumes 4 bytes per pixel for 8-bit images (8 for half float, 16 for float) and a full mip chain
 * where the texture generates one. Real usage depends on the driver and may be higher.
 */
export function estimateTextureBytes(texture: THREE.Texture): number {
  const size = dimensions(texture);
  if (!size) {
    return 0;
  }
  const bytesPerPixel = texture.type === THREE.HalfFloatType ? 8 : texture.type === THREE.FloatType ? 16 : 4;
  const hasMips =
    texture.generateMipmaps && texture.minFilter !== THREE.NearestFilter && texture.minFilter !== THREE.LinearFilter;
  return Math.round(size.width * size.height * bytesPerPixel * (hasMips ? 4 / 3 : 1));
}

/** Every distinct texture the scene draws with: material maps plus the environment. Clones sharing an image count once. */
export function collectSceneTextures(scene: THREE.Scene): THREE.Texture[] {
  const bySource = new Map<string, THREE.Texture>();
  const add = (texture: THREE.Texture) => {
    bySource.set(`${texture.source.uuid}|${texture.type}|${texture.generateMipmaps}`, texture);
  };
  scene.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) {
      return;
    }
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of materials) {
      for (const value of Object.values(material)) {
        if (value instanceof THREE.Texture) {
          add(value);
        }
      }
    }
  });
  if (scene.environment instanceof THREE.Texture) {
    add(scene.environment);
  }
  return [...bySource.values()];
}

/**
 * Bytes per shadow-map texel: this three.js version allocates a 24-bit depth texture AND an RGBA8 colour
 * texture for each shadow map (4 + 4). Confirmed by recording the real WebGL allocations in Chrome: a
 * 2048 x 2048 shadow map showed up as one DEPTH24 and one RGBA8 texture of 16.8 MB each.
 */
const SHADOW_BYTES_PER_TEXEL = 8;

/** Estimated bytes of the shadow maps of shadow-casting lights (depth plus colour attachment). */
export function estimateShadowMapBytes(scene: THREE.Scene): number {
  let bytes = 0;
  scene.traverse((object) => {
    // Directional and spot lights use one flat map. (Point lights use six faces and are not used here.)
    if ((object instanceof THREE.DirectionalLight || object instanceof THREE.SpotLight) && object.castShadow) {
      bytes += object.shadow.mapSize.x * object.shadow.mapSize.y * SHADOW_BYTES_PER_TEXEL;
    }
  });
  return bytes;
}

export type RendererSnapshot = {
  drawCalls: number;
  triangles: number;
  lines: number;
  geometries: number;
  gpuTextures: number;
  /** Compiled shader programs. Each distinct material feature set costs a compile, which is slow on some GPUs. */
  shaderPrograms: number;
  textureBytesEstimated: number;
  shadowMapBytesEstimated: number;
  frameMsAverage: number;
  pixelRatio: number;
  canvas: string;
};

export const megabytes = (bytes: number): string => (bytes / 1e6).toFixed(1);

export function formatSnapshot(s: RendererSnapshot, tier: string): string {
  return [
    `tier ${tier}`,
    `draw calls ${s.drawCalls} (incl. shadow pass)`,
    `triangles ${s.triangles.toLocaleString("en-US")} (incl. shadow pass)`,
    `geometries ${s.geometries} | GPU textures ${s.gpuTextures} | shaders ${s.shaderPrograms}`,
    `texture mem ~${megabytes(s.textureBytesEstimated)} MB (est.)`,
    `shadow map ~${megabytes(s.shadowMapBytesEstimated)} MB (est., depth + colour)`,
    `frame ${s.frameMsAverage.toFixed(1)} ms | dpr ${s.pixelRatio} | ${s.canvas}`,
  ].join("\n");
}
