import * as THREE from "three";

import type { District } from "../createDistrict";
import { buildPalms, type Palm } from "../props";
import { disposeTree, standard } from "../sceneHelpers";
import { addSky } from "../sky";
import { createDanfoFactory } from "../vehicles";
import { buildBuildings } from "./junctionBuildings";
import { createJunctionKit } from "./junctionKit";
import { mergeStaticByMaterial } from "./mergeStatic";
import { buildProps } from "./junctionProps";
import { buildStreet } from "./junctionStreet";
import { buildDirectionSign, buildFlyover, buildSkyline, buildUtilityLines } from "./junctionStructures";
import { buildNeighbourhood } from "../../explore/neighbourhood";
import { buildInterior } from "../../explore/interiorBuilder";
import { WORLD_ENTRANCES } from "../../explore/entranceWorld";
import { addCourtDetail } from "../../explore/court/courtDetail";
import { createGlassDoors } from "../../explore/glassDoor";
import { createSignKit } from "./junctionSigns";
import { INTERIORS } from "../../explore/interiorRegistry";
import type { JunctionAssets } from "./loadJunctionAssets";

/** PLACEHOLDER palms: the procedural crowns from the first prototype. A commissioned palm replaces them. */
const JUNCTION_PALMS: Palm[] = [
  // Median of the far avenue, clear of the flyover.
  { x: 0, z: -38, scale: 1.2, yaw: 0.4 },
  { x: 0, z: -50, scale: 1.3, yaw: 2.1 },
  { x: 0, z: -60, scale: 1.25, yaw: 4.0 },
  { x: 0, z: -88, scale: 1.3, yaw: 1.2 },
  { x: 0, z: -100, scale: 1.3, yaw: 3.3 },
  { x: 0, z: -112, scale: 1.3, yaw: 5.5 },
  // Pavements near the camera.
  { x: -9.6, z: -7.5, scale: 1.1, yaw: 3.0 },
  { x: -9.7, z: 19.5, scale: 1.0, yaw: 0.2 },
  { x: 9.4, z: 17.5, scale: 1.05, yaw: 5.2 },
  { x: 9.3, z: -1.2, scale: 1.1, yaw: 0.9 },
  { x: 9.3, z: -12, scale: 1.0, yaw: 2.6 },
  // Cross-street corners and the red-earth lot.
  { x: -16, z: -15.8, scale: 1.1, yaw: 4.4 },
  { x: 16, z: -15.8, scale: 1.05, yaw: 1.7 },
  { x: -17, z: -32.6, scale: 1.2, yaw: 5.0 },
  { x: 28, z: -13, scale: 1.15, yaw: 0.6 },
  // Far pavements.
  { x: 9.2, z: -42, scale: 1.2, yaw: 3.8 },
  { x: -9.2, z: -46, scale: 1.2, yaw: 1.4 },
  { x: 9.2, z: -58, scale: 1.25, yaw: 5.9 },
  // Market street and the plaza. Same instanced palms, so they add triangles but not draw calls.
  { x: -80.5, z: -8, scale: 1.05, yaw: 0.4 },
  { x: -80.5, z: -36, scale: 1.15, yaw: 1.2 },
  { x: -80.5, z: -78, scale: 1.1, yaw: 2.4 },
  { x: -92.5, z: 6, scale: 1.2, yaw: 3.1 },
  { x: -92.5, z: -52, scale: 1.15, yaw: 4.2 },
  { x: -100, z: -14, scale: 1.2, yaw: 0.8 },
];

/**
 * Palm Mile hero junction: PBR materials and props from the processed Poly Haven assets, HDRI
 * lighting (applied by the caller as scene.environment), and our own signage.
 *
 * Temporary placeholders, all in groups named PLACEHOLDER_*: the procedural danfos, the procedural
 * palms, the box buildings, the flyover and the distant skyline. The explorer, when play mode is on,
 * is added by ExploreController and is a placeholder figure, not finished character art.
 */
export function createJunction(assets: JunctionAssets): District {
  const root = new THREE.Group();
  root.name = "palm-mile-junction";
  const kit = createJunctionKit(assets);
  // One sign atlas for every sign in the district. The phone tier draws it at half size to stay inside its texture budget.
  const signKit = createSignKit(assets.tier === "mobile" ? 0.5 : 1);

  buildStreet(root, kit);
  buildBuildings(root, kit, assets.tier, signKit);
  // Roads and the plaza join the street and building groups before those groups are merged.
  buildNeighbourhood(root, kit);
  buildProps(root, assets, kit);
  buildUtilityLines(root);
  buildDirectionSign(root);
  buildFlyover(root, kit);
  buildSkyline(root);
  addSky(root);

  // ---- Placeholder palms.
  const palms = new THREE.Group();
  palms.name = "PLACEHOLDER_palms";
  const updatePalms = buildPalms(
    palms,
    {
      trunk: standard({ color: "#75604b", roughness: 0.92, metalness: 0 }),
      leaf: standard({ color: "#46623b", roughness: 0.8, metalness: 0, side: THREE.DoubleSide }),
    },
    JUNCTION_PALMS,
  );
  root.add(palms);

  // ---- Placeholder danfos. The nose of each bus points along local +x; the holder re-centres it.
  // Parked buses share one group so their parts collapse into a handful of draw calls; the moving bus is separate.
  const danfos = new THREE.Group();
  danfos.name = "PLACEHOLDER_danfos";
  const movingDanfo = new THREE.Group();
  movingDanfo.name = "PLACEHOLDER_danfo_moving";
  const makeDanfo = createDanfoFactory({
    glass: standard({ color: "#6f8a84", roughness: 0.14, metalness: 0.55, transparent: true, opacity: 0.7 }),
    metal: standard({ color: "#807a70", roughness: 0.4, metalness: 0.7 }),
    frame: standard({ color: "#242d2a", roughness: 0.55, metalness: 0.4 }),
    wood: standard({ color: "#6a4f36", roughness: 0.85, metalness: 0 }),
    charcoal: standard({ color: "#2a312e", roughness: 0.6, metalness: 0.25 }),
  });
  const placeDanfo = (parent: THREE.Group, x: number, z: number, yaw: number, detailed: boolean): THREE.Group => {
    const holder = new THREE.Group();
    const bus = makeDanfo(detailed);
    bus.position.x = -2.3;
    holder.add(bus);
    holder.position.set(x, 0, z);
    holder.rotation.y = yaw;
    parent.add(holder);
    return holder;
  };
  // Hero: a minibus pulling out from the market, side on to the camera.
  placeDanfo(danfos, 0.9, 8.5, Math.PI * 0.86, true);
  placeDanfo(danfos, -3.4, -9.5, Math.PI / 2, false);
  placeDanfo(danfos, -22, -24.6, Math.PI, false);
  placeDanfo(danfos, 3.2, -44, Math.PI / 2, false);
  placeDanfo(danfos, -3.2, -62, Math.PI / 2, false);
  const moving = placeDanfo(movingDanfo, 3.1, -7, Math.PI / 2, true);
  mergeStaticByMaterial(moving);
  root.add(danfos, movingDanfo);

  // Every room and its street backdrop start hidden. The walk controller shows the room the player is in
  // (and any room whose door they are near), and the backdrop only once the street itself is hidden.
  const roomNames: string[] = [];
  for (const def of INTERIORS) {
    const { room, vignette } = buildInterior(kit, def);
    room.visible = false;
    root.add(room);
    roomNames.push(room.name);
    // Only a room with a street door has a view of the street.
    if (vignette) {
      vignette.visible = false;
      root.add(vignette);
      roomNames.push(vignette.name);
    }
  }
  // The sliding glass doors are live objects, so they are not merged. They hide with the street.
  createGlassDoors(root, WORLD_ENTRANCES);
  // Palm Court's stairs, lift, plates and call buttons go into the rooms before the rooms are merged.
  addCourtDetail(root, kit, signKit);

  // Everything that never moves is baked to one mesh per material. Same triangles, far fewer draw calls.
  for (const name of ["street", "PLACEHOLDER_buildings", "PLACEHOLDER_flyover", "direction-sign", "street-props", "PLACEHOLDER_danfos", ...roomNames]) {
    const group = root.getObjectByName(name);
    if (group) {
      mergeStaticByMaterial(group);
    }
  }

  const update = (elapsed: number) => {
    // Slow on purpose: ambient life, not a distraction. One bus drives away down the avenue.
    moving.position.z = -7 - ((elapsed * 2) % 105);
    updatePalms(elapsed);
  };

  const dispose = () => {
    disposeTree(root);
    assets.dispose();
  };

  return { root, update, dispose };
}
