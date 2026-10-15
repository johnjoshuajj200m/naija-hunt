import * as THREE from "three";

import { standard, withRepeat } from "./sceneHelpers";
import { createAsphaltTexture, createGlassFacadeTexture, createPaverTexture, createPlasterTexture } from "./textures";

/**
 * Palette: forest green, charcoal, sand, cream and antique gold. Surfaces get their detail from
 * small procedural textures instead of image files, so there is nothing extra to download.
 */
export function createMaterials() {
  const plasterMap = createPlasterTexture();
  const paverMap = createPaverTexture();
  const glassMap = createGlassFacadeTexture();

  return {
    plaster: (color: THREE.ColorRepresentation) =>
      standard({ map: plasterMap, color, roughness: 0.93, metalness: 0.02 }),
    /** A tower's glass skin. The facade texture repeats so floors and bays keep a believable scale. */
    towerGlass: (width: number, height: number) =>
      standard({
        map: withRepeat(glassMap, width / 12.8, height / 14.4),
        color: "#ffffff",
        roughness: 0.3,
        metalness: 0.42,
      }),
    crownGlass: standard({
      color: "#c3d6cc",
      roughness: 0.16,
      metalness: 0.6,
      emissive: "#5a4520",
      emissiveIntensity: 0.38,
    }),
    asphalt: standard({ map: createAsphaltTexture([2, 28]), color: "#ffffff", roughness: 0.95, metalness: 0.03 }),
    paver: (width: number, length: number, color: THREE.ColorRepresentation = "#ffffff") =>
      standard({ map: withRepeat(paverMap, width / 2, length / 2), color, roughness: 0.92, metalness: 0.02 }),
    concrete: standard({ map: plasterMap, color: "#cfc6b6", roughness: 0.88, metalness: 0.02 }),
    darkConcrete: standard({ map: plasterMap, color: "#8d877c", roughness: 0.9, metalness: 0.02 }),
    sand: standard({ map: plasterMap, color: "#cdb98f", roughness: 1, metalness: 0 }),
    verge: standard({ color: "#58694a", roughness: 1, metalness: 0 }),
    lineWhite: standard({ color: "#e8e1d0", roughness: 0.8, metalness: 0 }),
    lineGold: standard({ color: "#c9a24a", roughness: 0.7, metalness: 0.1 }),
    glass: standard({ color: "#6f8a84", roughness: 0.14, metalness: 0.55, transparent: true, opacity: 0.7 }),
    frame: standard({ color: "#242d2a", roughness: 0.55, metalness: 0.4 }),
    metal: standard({ color: "#807a70", roughness: 0.4, metalness: 0.7 }),
    gold: standard({
      color: "#b88f35",
      roughness: 0.36,
      metalness: 0.68,
      emissive: "#3a2c10",
      emissiveIntensity: 0.2,
    }),
    forest: standard({ color: "#1d3226", roughness: 0.6, metalness: 0.2 }),
    charcoal: standard({ color: "#2a312e", roughness: 0.6, metalness: 0.25 }),
    tank: standard({ color: "#1c1f1e", roughness: 0.55, metalness: 0.15 }),
    wood: standard({ color: "#6a4f36", roughness: 0.85, metalness: 0 }),
    leaf: standard({ color: "#46623b", roughness: 0.8, metalness: 0, side: THREE.DoubleSide }),
    shrub: standard({ color: "#3f5a35", roughness: 0.9, metalness: 0 }),
    trunk: standard({ color: "#75604b", roughness: 0.92, metalness: 0 }),
    solar: standard({ color: "#1f3a3d", roughness: 0.25, metalness: 0.6 }),
    transit: standard({ color: "#2b3732", roughness: 0.5, metalness: 0.3 }),
    produce: standard({ color: "#ffffff", roughness: 0.7, metalness: 0 }),
    beam: new THREE.MeshBasicMaterial({
      color: "#d9b95c",
      transparent: true,
      opacity: 0.3,
      depthWrite: false,
      side: THREE.DoubleSide,
      fog: false,
    }),
    padRing: new THREE.MeshBasicMaterial({
      color: "#d9b95c",
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  };
}

export type Materials = ReturnType<typeof createMaterials>;
