import * as THREE from "three";

import { LEFT_FACE, RIGHT_FACE } from "./layout";
import type { Materials } from "./materials";
import { addInstances, addMesh, footprintGeometry, standard, type InstanceSpec } from "./sceneHelpers";
import { createSignTexture, createStripeTexture } from "./textures";

type Side = "left" | "right";

type BlockSpec = {
  side: Side;
  z: number;
  depth: number;
  width: number;
  height: number;
  color: string;
  floors: number;
  balconies?: boolean;
  shop?: { label: string; background: string; foreground: string };
  frontWindows?: boolean;
};

const SHOP_GREEN = { background: "#1d3226", foreground: "#faf6ee" };
const SHOP_CHARCOAL = { background: "#2a312e", foreground: "#d9b04a" };
const SHOP_CREAM = { background: "#efe6d0", foreground: "#1d3226" };

const BLOCKS: BlockSpec[] = [
  // Near-camera blocks so the street does not simply stop at the edge of the frame.
  { side: "left", z: 8, depth: 11, width: 7, height: 11, color: "#dccaa8", floors: 3, balconies: true, shop: { label: "PALM MILE PHARMACY", ...SHOP_CREAM } },
  { side: "left", z: 19.5, depth: 12, width: 7, height: 8, color: "#e5d4b4", floors: 2, frontWindows: true },
  { side: "left", z: 31, depth: 11, width: 7, height: 13, color: "#d3b79a", floors: 4, balconies: true },
  { side: "right", z: 13, depth: 12, width: 7, height: 10, color: "#e0cfae", floors: 3, balconies: true, shop: { label: "NEPA BUKKA", ...SHOP_GREEN } },
  { side: "right", z: 25, depth: 12, width: 7, height: 14, color: "#d4c3a2", floors: 4 },
  { side: "right", z: 36.5, depth: 11, width: 7, height: 8, color: "#eadcc2", floors: 2, frontWindows: true },
  { side: "left", z: -4, depth: 10, width: 7, height: 9.5, color: "#e5d4b4", floors: 3, balconies: true, frontWindows: true, shop: { label: "MAMA NKE PROVISIONS", ...SHOP_GREEN } },
  { side: "left", z: -14.5, depth: 11, width: 7, height: 13, color: "#d3b79a", floors: 4, balconies: true, shop: { label: "BUKKA 24", ...SHOP_CHARCOAL } },
  { side: "left", z: -24.5, depth: 9, width: 7, height: 9, color: "#e1cfae", floors: 3, shop: { label: "TAILOR & CO", ...SHOP_CREAM } },
  { side: "right", z: 3, depth: 8, width: 6, height: 7.2, color: "#eadcc2", floors: 2, frontWindows: true },
  { side: "right", z: -6, depth: 10, width: 7, height: 12, color: "#cdbb9a", floors: 4, balconies: true, shop: { label: "GLOBAL SIM", ...SHOP_GREEN } },
  { side: "right", z: -17, depth: 11, width: 7, height: 9.5, color: "#e3d3b5", floors: 3, shop: { label: "SUPERMART", ...SHOP_CHARCOAL } },
  { side: "right", z: -26.5, depth: 8, width: 7, height: 16, color: "#d6cbb5", floors: 5, balconies: true },
];

type CrownStyle = "ring" | "garden" | "spire" | "stepped";

type TowerSpec = {
  side: Side | "center";
  z: number;
  size: number;
  height: number;
  crown: CrownStyle;
  corners?: boolean;
};

const TOWERS: TowerSpec[] = [
  { side: "left", z: -35, size: 9, height: 36, crown: "stepped", corners: true },
  { side: "right", z: -35, size: 9, height: 42, crown: "ring", corners: true },
  { side: "left", z: -47, size: 10, height: 46, crown: "spire" },
  { side: "right", z: -48, size: 10, height: 52, crown: "garden" },
  { side: "left", z: -60, size: 11, height: 56, crown: "ring" },
  { side: "right", z: -62, size: 11, height: 60, crown: "stepped" },
  { side: "left", z: -75, size: 12, height: 64, crown: "garden" },
  { side: "right", z: -78, size: 12, height: 70, crown: "spire" },
  { side: "center", z: -97, size: 12, height: 86, crown: "spire" },
];

function faceCenterX(side: Side | "center", width: number): number {
  if (side === "left") {
    return LEFT_FACE - width / 2;
  }
  if (side === "right") {
    return RIGHT_FACE + width / 2;
  }
  return 0;
}

export const SKYBRIDGE_Z = -35;
const SKYBRIDGE_Y = 15.5;

export function buildBuildings(parent: THREE.Group, materials: Materials): void {
  const windowSlots: InstanceSpec[] = [];
  const balconySlots: InstanceSpec[] = [];
  const railSlots: InstanceSpec[] = [];
  const tankSlots: InstanceSpec[] = [];
  const standSlots: InstanceSpec[] = [];
  const awnings = [
    standard({ map: createStripeTexture("#b88f35", "#efe6d0"), roughness: 0.75, side: THREE.DoubleSide }),
    standard({ map: createStripeTexture("#1d3226", "#efe6d0"), roughness: 0.75, side: THREE.DoubleSide }),
    standard({ map: createStripeTexture("#2a312e", "#d7c4a0"), roughness: 0.75, side: THREE.DoubleSide }),
  ];
  let awningIndex = 0;

  for (const block of BLOCKS) {
    const leftSide = block.side === "left";
    const x = faceCenterX(block.side, block.width);
    const streetFaceX = leftSide ? LEFT_FACE : RIGHT_FACE;
    const outward = leftSide ? 1 : -1; // direction from the wall toward the street
    addMesh(parent, footprintGeometry(block.width, block.depth, block.height), materials.plaster(block.color), [x, 0, block.z]);
    addMesh(parent, footprintGeometry(block.width + 0.3, block.depth + 0.3, 0.3, 0.02), materials.concrete, [x, block.height, block.z]);

    const floorHeight = block.height / block.floors;
    const columns = Math.max(2, Math.round(block.depth / 2));
    const hasShop = block.shop !== undefined;
    for (let floor = hasShop ? 1 : 0; floor < block.floors; floor += 1) {
      const y = floor * floorHeight + floorHeight * 0.58;
      for (let column = 0; column < columns; column += 1) {
        const z = block.z - block.depth / 2 + ((column + 0.5) * block.depth) / columns;
        windowSlots.push({ position: [streetFaceX + outward * 0.03, y, z], rotation: [0, Math.PI / 2, 0] });
        if (block.balconies && floor >= 1 && column % 2 === 0) {
          balconySlots.push({ position: [streetFaceX + outward * 0.4, floor * floorHeight, z] });
          railSlots.push({ position: [streetFaceX + outward * 0.78, floor * floorHeight + 0.45, z] });
        }
      }
    }
    if (block.frontWindows) {
      const frontZ = block.z + block.depth / 2 + 0.03;
      const frontColumns = Math.max(2, Math.round(block.width / 2));
      for (let floor = 0; floor < block.floors; floor += 1) {
        const y = floor * floorHeight + floorHeight * 0.58;
        for (let column = 0; column < frontColumns; column += 1) {
          const px = x - block.width / 2 + ((column + 0.5) * block.width) / frontColumns;
          windowSlots.push({ position: [px, y, frontZ] });
        }
      }
    }

    if (block.shop) {
      addMesh(parent, new THREE.BoxGeometry(0.16, 2.7, block.depth * 0.9), materials.charcoal, [streetFaceX + outward * 0.08, 1.35, block.z], {
        cast: false,
      });
      const signMaterial = standard({
        map: createSignTexture(block.shop.label, block.shop.background, block.shop.foreground),
        roughness: 0.6,
      });
      addMesh(parent, new THREE.PlaneGeometry(4.2, 1.05), signMaterial, [streetFaceX + outward * 0.2, 3.3, block.z], {
        rotation: [0, outward * (Math.PI / 2), 0],
        cast: false,
      });
      const awning = awnings[awningIndex % awnings.length];
      awningIndex += 1;
      if (awning) {
        addMesh(parent, new THREE.BoxGeometry(1.0, 0.06, block.depth * 0.8), awning, [streetFaceX + outward * 0.55, 2.95, block.z], {
          rotation: [0, 0, outward * -0.28],
        });
      }
    }

    // Lagos rooftops: water tanks on stands.
    for (const offset of [-0.25, 0.25]) {
      tankSlots.push({ position: [x, block.height + 1.35, block.z + block.depth * offset] });
      standSlots.push({ position: [x, block.height + 0.55, block.z + block.depth * offset] });
    }
  }

  addWindows(parent, materials, windowSlots);
  if (balconySlots.length > 0) {
    addInstances(parent, new THREE.BoxGeometry(0.8, 0.1, 1.5), materials.concrete, balconySlots);
    addInstances(parent, new THREE.BoxGeometry(0.05, 0.8, 1.5), materials.frame, railSlots);
  }
  addInstances(parent, new THREE.CylinderGeometry(0.55, 0.55, 1.3, 14), materials.tank, tankSlots);
  addInstances(parent, new THREE.BoxGeometry(0.9, 0.5, 0.9), materials.darkConcrete, standSlots);

  for (const spec of TOWERS) {
    buildTower(parent, materials, spec);
  }
  buildSkybridge(parent, materials);
}

function addWindows(parent: THREE.Group, materials: Materials, slots: InstanceSpec[]): void {
  addInstances(parent, new THREE.BoxGeometry(1.0, 1.3, 0.05), materials.frame, slots, { cast: false });
  const glassSlots = slots.map((slot) => ({
    ...slot,
    scale: [0.82, 0.82, 1] as [number, number, number],
  }));
  addInstances(parent, new THREE.BoxGeometry(1.0, 1.3, 0.07), materials.glass, glassSlots, { cast: false, receive: false });
}

function buildTower(parent: THREE.Group, materials: Materials, spec: TowerSpec): void {
  const x = faceCenterX(spec.side, spec.size);
  const { size, z } = spec;
  const podiumHeight = 4.5;
  const crownHeight = 5.5;
  const shaftHeight = spec.height - podiumHeight - crownHeight;

  addMesh(parent, footprintGeometry(size, size, podiumHeight), materials.plaster("#d9cdb6"), [x, 0, z]);
  addMesh(parent, footprintGeometry(size + 0.9, size + 0.9, 0.35, 0.03), materials.concrete, [x, podiumHeight, z]);

  const shaftMaterial = materials.towerGlass(size, shaftHeight);
  addMesh(parent, new THREE.BoxGeometry(size, shaftHeight, size), shaftMaterial, [x, podiumHeight + 0.2 + shaftHeight / 2, z]);

  if (spec.corners) {
    const half = size / 2;
    for (const cx of [-half, half]) {
      for (const cz of [-half, half]) {
        addMesh(parent, new THREE.BoxGeometry(0.4, shaftHeight, 0.4), materials.frame, [x + cx, podiumHeight + 0.2 + shaftHeight / 2, z + cz]);
      }
    }
  }

  const crownBase = podiumHeight + 0.2 + shaftHeight;
  const crownSize = spec.crown === "stepped" ? size * 0.7 : size * 0.86;
  addMesh(parent, new THREE.BoxGeometry(size + 0.4, 0.5, size + 0.4), materials.gold, [x, crownBase + 0.25, z], { cast: false });
  addMesh(parent, new THREE.BoxGeometry(crownSize, crownHeight, crownSize), materials.crownGlass, [x, crownBase + 0.5 + crownHeight / 2, z], {
    cast: false,
  });
  const roofY = crownBase + 0.5 + crownHeight;
  addMesh(parent, new THREE.BoxGeometry(crownSize + 0.3, 0.3, crownSize + 0.3), materials.gold, [x, roofY + 0.15, z], { cast: false });

  if (spec.crown === "stepped") {
    addMesh(parent, new THREE.BoxGeometry(crownSize * 0.6, 3, crownSize * 0.6), materials.crownGlass, [x, roofY + 1.8, z], { cast: false });
  }
  if (spec.crown === "garden") {
    addMesh(parent, new THREE.BoxGeometry(crownSize, 0.5, crownSize), materials.verge, [x, roofY + 0.55, z], { cast: false });
    const shrubs: InstanceSpec[] = [];
    for (let i = 0; i < 6; i += 1) {
      const angle = (i / 6) * Math.PI * 2;
      shrubs.push({ position: [x + Math.cos(angle) * crownSize * 0.32, roofY + 1.0, z + Math.sin(angle) * crownSize * 0.32] });
    }
    addInstances(parent, new THREE.IcosahedronGeometry(0.6, 1), materials.shrub, shrubs, { cast: false });
  }
  if (spec.crown === "spire") {
    addMesh(parent, new THREE.CylinderGeometry(0.06, 0.18, 9, 6), materials.metal, [x, roofY + 4.8, z], { cast: false });
    addMesh(parent, new THREE.SphereGeometry(0.22, 8, 6), materials.gold, [x, roofY + 9.4, z], { cast: false });
  }
}

/** Glass-tube skybridge linking the two towers at the middle of the street. */
function buildSkybridge(parent: THREE.Group, materials: Materials): void {
  const span = RIGHT_FACE - LEFT_FACE;
  const centerX = (RIGHT_FACE + LEFT_FACE) / 2;
  const z = SKYBRIDGE_Z;
  const y = SKYBRIDGE_Y;

  addMesh(parent, new THREE.BoxGeometry(span, 3, 3.2), materials.glass, [centerX, y, z], { cast: false });
  addMesh(parent, new THREE.BoxGeometry(span, 0.4, 3.7), materials.charcoal, [centerX, y - 1.7, z]);
  addMesh(parent, new THREE.BoxGeometry(span, 0.35, 3.7), materials.charcoal, [centerX, y + 1.7, z]);
  for (const side of [-1, 1]) {
    addMesh(parent, new THREE.BoxGeometry(span, 0.1, 0.1), materials.gold, [centerX, y - 1.4, z + side * 1.88], { cast: false });
  }
  const ribs: InstanceSpec[] = [];
  for (let x = LEFT_FACE + 1; x < RIGHT_FACE; x += 1.6) {
    ribs.push({ position: [x, y, z] });
  }
  addInstances(parent, new THREE.BoxGeometry(0.2, 3.6, 3.75), materials.frame, ribs);
}
