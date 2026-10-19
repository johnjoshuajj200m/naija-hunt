import * as THREE from "three";

import { addInstances, type InstanceSpec, type Vec3 } from "../sceneHelpers";
import type { AssetTier, PropId } from "./assetList";
import { TEXTURE_TILE_METRES } from "./assetList";
import type { JunctionKit } from "./junctionKit";
import { KERB_HEIGHT } from "./junctionLayout";
import type { JunctionAssets } from "./loadJunctionAssets";
import { applyWorldUv } from "./worldUv";

/**
 * Street dressing: the Poly Haven props (as GPU instances), plastic-chair cafes under market umbrellas,
 * and corrugated-iron stalls on the red-earth lot. Phones get fewer props, because per-prop triangle
 * and texture cost is what grows on a small GPU.
 */

type Placement = { position: Vec3; yaw?: number; scale?: number };

type Density = { tables: number; chairsPerTable: number; crates: number; barrels: number; tyres: number; boxes: number };

const DENSITY: Record<AssetTier, Density> = {
  desktop: { tables: 6, chairsPerTable: 3, crates: 6, barrels: 5, tyres: 6, boxes: 2 },
  mobile: { tables: 4, chairsPerTable: 2, crates: 3, barrels: 3, tyres: 3, boxes: 1 },
};

/** Table positions, most important first. Each gets three chairs and an umbrella. */
const TABLES: Array<{ x: number; z: number }> = [
  { x: -8.7, z: 15.5 },
  { x: 8.7, z: 12.5 },
  { x: -8.8, z: 9.5 },
  { x: -8.7, z: 3 },
  { x: 8.8, z: 7.2 },
  { x: -8.9, z: -4 },
];

const CRATES: Placement[] = [
  { position: [-10.3, KERB_HEIGHT, 12.4], yaw: Math.PI / 2 },
  { position: [-10.3, KERB_HEIGHT + 0.35, 12.4], yaw: Math.PI / 2 + 0.1 },
  { position: [-10.2, KERB_HEIGHT, 6.8], yaw: Math.PI / 2 - 0.15 },
  { position: [-10.2, KERB_HEIGHT + 0.35, 6.8], yaw: Math.PI / 2 },
  { position: [-10.3, KERB_HEIGHT, -2.2], yaw: Math.PI / 2 },
  { position: [10.3, KERB_HEIGHT, 4.5], yaw: Math.PI / 2 + 0.2 },
  { position: [13.5, 0, 1.8], yaw: 0.4 },
  { position: [14.4, 0, 1.6], yaw: -0.2 },
];

const BARRELS: Placement[] = [
  { position: [-6.7, KERB_HEIGHT, -9.5] },
  { position: [6.7, KERB_HEIGHT, -9.5] },
  { position: [17.2, 0, -5.2] },
  { position: [-10.4, KERB_HEIGHT, 1] },
  { position: [10.4, KERB_HEIGHT, 15.5] },
];

const TYRES: Placement[] = [
  { position: [20.4, 0, -9.2], yaw: 0.3 },
  { position: [20.4, 0.16, -9.2], yaw: 1.1 },
  { position: [20.4, 0.32, -9.2], yaw: 0.2 },
  { position: [21.6, 0, -8.3], yaw: 2.0 },
  { position: [21.6, 0.16, -8.3], yaw: 0.7 },
  { position: [19.3, 0, -10.6], yaw: 0.9 },
];

const UTILITY_BOXES: Placement[] = [
  { position: [-7.1, KERB_HEIGHT, -16.8], yaw: 0 },
  { position: [7.1, KERB_HEIGHT, -16.9], yaw: Math.PI },
];

function place(parent: THREE.Group, assets: JunctionAssets, id: PropId, placements: Placement[]): void {
  const specs: InstanceSpec[] = placements.map((p) => ({
    position: p.position,
    rotation: [0, p.yaw ?? 0, 0],
    scale: p.scale ?? 1,
  }));
  assets.props[id].forEach((part, index) => {
    // Props are small and numerous: they receive shadows but do not cast them, which would draw each one twice.
    addInstances(parent, part.geometry, part.material, specs, { cast: false, name: `prop-${id}-${index}` });
  });
}

export function buildProps(parent: THREE.Group, assets: JunctionAssets, kit: JunctionKit): void {
  const group = new THREE.Group();
  group.name = "street-props";
  parent.add(group);
  const density = DENSITY[assets.tier];

  // ---- Cafe tables: a painted table, three plastic chairs and a market umbrella each.
  const tables = TABLES.slice(0, density.tables);
  const tableGeometry = applyWorldUv(new THREE.BoxGeometry(0.9, 0.74, 0.9), TEXTURE_TILE_METRES.beige_wall_001);
  addInstances(
    group,
    tableGeometry,
    kit.pbr("beige_wall_001", { tint: "#e8d6b0" }),
    tables.map((t) => ({ position: [t.x, KERB_HEIGHT + 0.37, t.z] as Vec3 })),
    { name: "tables" },
  );

  const chairs: Placement[] = [];
  const umbrellas: InstanceSpec[] = [];
  const poles: InstanceSpec[] = [];
  const UMBRELLA_COLORS = ["#d9402f", "#e0a82e", "#2f7a5a", "#3a6ea5", "#e8dfc9", "#c8452f"];
  tables.forEach((table, index) => {
    // Chairs sit at equal thirds of a circle, so two chairs are still placed sensibly rather than opposite.
    for (let c = 0; c < density.chairsPerTable; c += 1) {
      const angle = index * 0.9 + c * ((Math.PI * 2) / 3);
      chairs.push({
        position: [table.x + Math.cos(angle) * 0.92, KERB_HEIGHT, table.z + Math.sin(angle) * 0.92],
        // The chair faces the table.
        yaw: -angle - Math.PI / 2,
      });
    }
    umbrellas.push({
      position: [table.x, KERB_HEIGHT + 2.45, table.z],
      scale: [1, 1, 1],
      color: UMBRELLA_COLORS[index % UMBRELLA_COLORS.length] ?? "#d9402f",
    });
    poles.push({ position: [table.x, KERB_HEIGHT + 1.2, table.z], scale: [1, 1, 1] });
  });
  place(group, assets, "plastic_monobloc_chair_01", chairs);

  const canopy = new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.82, metalness: 0, side: THREE.DoubleSide });
  addInstances(group, new THREE.ConeGeometry(1.45, 0.55, 10), canopy, umbrellas, { name: "market-umbrellas" });
  addInstances(
    group,
    new THREE.CylinderGeometry(0.025, 0.025, 2.4, 6),
    new THREE.MeshStandardMaterial({ color: "#3b3b3b", roughness: 0.5, metalness: 0.6 }),
    poles,
    { cast: false, name: "umbrella-poles" },
  );

  // ---- Poly Haven props.
  place(group, assets, "wooden_crate_01", CRATES.slice(0, density.crates));
  place(group, assets, "Barrel_01", BARRELS.slice(0, density.barrels));
  place(group, assets, "old_tyre", TYRES.slice(0, density.tyres));
  place(group, assets, "utility_box_02", UTILITY_BOXES.slice(0, density.boxes));

  buildStalls(group, kit);
}

/** Open-sided market stalls on the red-earth lot: dark posts, a tilted corrugated roof, a back sheet and a counter. */
function buildStalls(parent: THREE.Group, kit: JunctionKit): void {
  const post = new THREE.BoxGeometry(0.1, 2.3, 0.1);
  const postMaterial = new THREE.MeshStandardMaterial({ color: "#3a2f26", roughness: 0.85, metalness: 0.05 });
  const postSpecs: InstanceSpec[] = [];
  const goods: InstanceSpec[] = [];
  const GOODS_COLORS = ["#b8472f", "#c98a2b", "#5f7d45", "#a77b5a", "#d2b24a"];

  const stalls: Array<{ x: number; z: number; yaw: number }> = [
    { x: 15.5, z: -3.2, yaw: 0 },
    { x: 24.5, z: -1.5, yaw: 0 },
    { x: 15.8, z: -9.5, yaw: 0 },
  ];

  stalls.forEach((stall, s) => {
    for (const dx of [-1.5, 1.5]) {
      for (const dz of [-1.0, 1.0]) {
        postSpecs.push({ position: [stall.x + dx, 1.15, stall.z + dz] });
      }
    }
    // Roof slopes down towards the street (the -x side faces the avenue).
    const roof = kit.box(parent, "corrugated_iron_02", [3.6, 0.07, 2.6], [stall.x, 2.45, stall.z], { tint: "#cdbfa5" });
    roof.rotation.z = 0.12;
    kit.box(parent, "corrugated_iron_02", [0.06, 2.2, 2.2], [stall.x + 1.62, 1.15, stall.z], { tint: "#a99d88" });
    kit.box(parent, "concrete", [0.8, 0.85, 2.0], [stall.x - 0.5, 0.425, stall.z], { tint: "#cdbfa5" });
    for (let i = 0; i < 8; i += 1) {
      goods.push({
        position: [stall.x - 0.5 + ((i % 2) - 0.5) * 0.35, 0.98, stall.z - 0.75 + Math.floor(i / 2) * 0.5],
        scale: 0.85 + ((i * 5 + s) % 4) * 0.1,
        color: GOODS_COLORS[(i + s) % GOODS_COLORS.length] ?? "#b8472f",
      });
    }
  });

  addInstances(parent, post, postMaterial, postSpecs, { name: "stall-posts" });
  addInstances(
    parent,
    new THREE.SphereGeometry(0.14, 10, 8),
    new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.7, metalness: 0 }),
    goods,
    { name: "stall-goods" },
  );
}
