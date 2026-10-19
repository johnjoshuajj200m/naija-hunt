import * as THREE from "three";

import { buildBuildings } from "./buildings";
import { createMaterials } from "./materials";
import { buildMarker, buildMarket, buildPalms } from "./props";
import { disposeTree } from "./sceneHelpers";
import { buildStreet } from "./street";
import { addSky } from "./sky";
import { createDanfoFactory } from "./vehicles";

/**
 * Palm Mile: an original, fictional near-future Lagos-inspired street, built from code.
 * There is intentionally no human figure in this scene.
 */
export type District = {
  root: THREE.Group;
  /** Advances ambient motion: the train, one minibus, swaying palms and the marker gem. */
  update: (elapsed: number) => void;
  dispose: () => void;
};

export function createDistrict(): District {
  const root = new THREE.Group();
  root.name = "palm-mile";

  const materials = createMaterials();
  const { train } = buildStreet(root, materials);
  buildBuildings(root, materials);
  buildMarket(root, materials);
  const gem = buildMarker(root, materials);
  const updatePalms = buildPalms(root, materials);
  addSky(root);

  // Danfos. The nose of each bus points along local +x; the holder re-centres it on its position.
  const makeDanfo = createDanfoFactory(materials);
  const placeDanfo = (x: number, z: number, yaw: number, detailed: boolean): THREE.Group => {
    const holder = new THREE.Group();
    const bus = makeDanfo(detailed);
    bus.position.x = -2.3;
    holder.add(bus);
    holder.position.set(x, 0, z);
    holder.rotation.y = yaw;
    root.add(holder);
    return holder;
  };
  // Pulling out from the market stop, angled so its side faces the viewer.
  placeDanfo(-2.5, 1.4, Math.PI / 2 - 0.35, true);
  const moving = placeDanfo(2.5, -22, Math.PI / 2, true);
  placeDanfo(2.6, -17, Math.PI / 2, true);
  placeDanfo(-2.5, -40, Math.PI / 2, false);
  placeDanfo(2.5, -56, Math.PI / 2, false);

  const update = (elapsed: number) => {
    // Slow on purpose: ambient life, not a distraction.
    train.position.z = 22 - ((elapsed * 3 + 36) % 130);
    moving.position.z = 12 - ((elapsed * 2 + 34) % 110);
    updatePalms(elapsed);
    gem.rotation.y = elapsed * 0.45;
    gem.position.y = 3.7 + Math.sin(elapsed * 0.9) * 0.08;
  };

  return { root, update, dispose: () => disposeTree(root) };
}
