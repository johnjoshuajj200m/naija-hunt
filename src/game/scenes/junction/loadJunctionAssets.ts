import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { HDRLoader } from "three/addons/loaders/HDRLoader.js";

import {
  assetUrl,
  HDRI_FILE,
  PROP_IDS,
  propPath,
  TEXTURE_IDS,
  TEXTURE_MAPS,
  texturePath,
  type AssetTier,
  type PropId,
  type TextureId,
  type TextureMap,
} from "./assetList";
import { alignSun } from "./hdriSun";
import { SUN_AZIMUTH } from "./junctionLayout";

export type PbrSet = Record<TextureMap, THREE.Texture>;

/** One renderable part of a prop, already positioned inside the prop's own space. */
export type PropPart = { geometry: THREE.BufferGeometry; material: THREE.MeshStandardMaterial };

export type JunctionAssets = {
  tier: AssetTier;
  textures: Record<TextureId, PbrSet>;
  props: Record<PropId, PropPart[]>;
  /** Pre-filtered image-based lighting. Lights and reflects only; it is never used as a background. */
  environment: THREE.Texture;
  dispose: () => void;
};

/** Anisotropic filtering keeps the road crisp at grazing angles. Phones get less to save bandwidth. */
const ANISOTROPY: Record<AssetTier, number> = { desktop: 8, mobile: 4 };

async function loadPbrSet(
  loader: THREE.TextureLoader,
  tier: AssetTier,
  id: TextureId,
  maxAnisotropy: number,
): Promise<PbrSet> {
  const entries = await Promise.all(
    TEXTURE_MAPS.map(async (map) => {
      const texture = await loader.loadAsync(assetUrl(texturePath(tier, id, map)));
      texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
      // Colour is sRGB. Normal and ARM (AO / roughness / metalness) are data and must stay linear.
      texture.colorSpace = map === "diff" ? THREE.SRGBColorSpace : THREE.NoColorSpace;
      texture.anisotropy = Math.min(ANISOTROPY[tier], maxAnisotropy);
      return [map, texture] as const;
    }),
  );
  return Object.fromEntries(entries) as PbrSet;
}

async function loadProp(loader: GLTFLoader, tier: AssetTier, id: PropId, maxAnisotropy: number): Promise<PropPart[]> {
  const gltf = await loader.loadAsync(assetUrl(propPath(tier, id)));
  gltf.scene.updateMatrixWorld(true);
  const parts: PropPart[] = [];
  gltf.scene.traverse((object) => {
    if (!(object instanceof THREE.Mesh) || !(object.material instanceof THREE.MeshStandardMaterial)) {
      return;
    }
    const material = object.material;
    // Poly Haven packs AO (red), roughness (green) and metalness (blue) into one "ARM" image.
    // glTF only wires up the last two, so the AO channel is connected here.
    if (material.roughnessMap) {
      material.aoMap = material.roughnessMap;
    }
    for (const texture of [material.map, material.normalMap, material.roughnessMap]) {
      if (texture) {
        texture.anisotropy = Math.min(ANISOTROPY[tier], maxAnisotropy);
      }
    }
    parts.push({ geometry: object.geometry.clone().applyMatrix4(object.matrixWorld), material });
  });
  if (parts.length === 0) {
    throw new Error(`Prop "${id}" has no mesh parts.`);
  }
  return parts;
}

/**
 * Loads the HDRI, turns it so its sun matches the directional light, and pre-filters it for lighting.
 * Pixels are aligned in float (to find the sun), then uploaded as half float, which every WebGL2
 * device can filter. The decoded source image is freed straight away.
 */
async function loadEnvironment(renderer: THREE.WebGLRenderer): Promise<THREE.Texture> {
  const loader = new HDRLoader();
  loader.setDataType(THREE.FloatType);
  const source = await loader.loadAsync(assetUrl(HDRI_FILE));
  const { width, height, data } = source.image as { width: number; height: number; data: Float32Array };

  const aligned = alignSun(data, width, height, SUN_AZIMUTH);
  const half = new Uint16Array(aligned.length);
  for (let i = 0; i < aligned.length; i += 1) {
    half[i] = THREE.DataUtils.toHalfFloat(aligned[i] ?? 0);
  }
  const equirect = new THREE.DataTexture(half, width, height, THREE.RGBAFormat, THREE.HalfFloatType);
  equirect.mapping = THREE.EquirectangularReflectionMapping;
  equirect.colorSpace = THREE.LinearSRGBColorSpace;
  equirect.minFilter = equirect.magFilter = THREE.LinearFilter;
  equirect.generateMipmaps = false;
  equirect.flipY = true;
  equirect.needsUpdate = true;
  source.dispose();

  const generator = new THREE.PMREMGenerator(renderer);
  const target = generator.fromEquirectangular(equirect);
  equirect.dispose();
  generator.dispose();
  return target.texture;
}

export async function loadJunctionAssets(renderer: THREE.WebGLRenderer, tier: AssetTier): Promise<JunctionAssets> {
  const maxAnisotropy = renderer.capabilities.getMaxAnisotropy();
  const textureLoader = new THREE.TextureLoader();
  const gltfLoader = new GLTFLoader();

  const [textureSets, propParts, environment] = await Promise.all([
    Promise.all(TEXTURE_IDS.map((id) => loadPbrSet(textureLoader, tier, id, maxAnisotropy))),
    Promise.all(PROP_IDS.map((id) => loadProp(gltfLoader, tier, id, maxAnisotropy))),
    loadEnvironment(renderer),
  ]);

  const textures = Object.fromEntries(TEXTURE_IDS.map((id, i) => [id, textureSets[i]])) as Record<TextureId, PbrSet>;
  const props = Object.fromEntries(PROP_IDS.map((id, i) => [id, propParts[i]])) as Record<PropId, PropPart[]>;

  const dispose = () => {
    for (const set of Object.values(textures)) {
      for (const texture of Object.values(set)) {
        texture.dispose();
      }
    }
    for (const parts of Object.values(props)) {
      for (const part of parts) {
        part.geometry.dispose();
        for (const value of Object.values(part.material)) {
          if (value instanceof THREE.Texture) {
            value.dispose();
          }
        }
        part.material.dispose();
      }
    }
    environment.dispose();
  };

  return { tier, textures, props, environment, dispose };
}
