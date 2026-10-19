import * as THREE from "three";

import { MARKER_Z } from "./layout";
import type { Materials } from "./materials";
import { addInstances, addMesh, standard, type InstanceSpec } from "./sceneHelpers";
import { createSignTexture, createStripeTexture } from "./textures";

type Stall = { x: number; z: number; awning: number; sign: string; bg: string; fg: string };

const STALLS: Stall[] = [
  { x: -5.3, z: -4.9, awning: 0, sign: "SUYA", bg: "#1d3226", fg: "#faf6ee" },
  { x: -5.3, z: -8.5, awning: 1, sign: "FRESH PEPPER", bg: "#efe6d0", fg: "#1d3226" },
  { x: -5.3, z: -12.1, awning: 2, sign: "ANKARA FABRICS", bg: "#2a312e", fg: "#d9b04a" },
  { x: -5.3, z: -15.7, awning: 0, sign: "YAM & PLANTAIN", bg: "#1d3226", fg: "#faf6ee" },
  { x: -8.1, z: -6.7, awning: 1, sign: "PHONE REPAIR", bg: "#2a312e", fg: "#d9b04a" },
  { x: -8.1, z: -10.5, awning: 2, sign: "BEANS & RICE", bg: "#efe6d0", fg: "#1d3226" },
  { x: -8.1, z: -14.3, awning: 0, sign: "SHOES", bg: "#1d3226", fg: "#faf6ee" },
];

const PRODUCE_COLORS = ["#b8472f", "#c98a2b", "#5f7d45", "#a77b5a", "#d2b24a"];

/** Open-air market: striped tarpaulin stalls, produce, crates and a signed entrance gate. */
export function buildMarket(parent: THREE.Group, materials: Materials): void {
  const awnings = [
    standard({ map: createStripeTexture("#b88f35", "#efe6d0"), roughness: 0.75, side: THREE.DoubleSide }),
    standard({ map: createStripeTexture("#1d3226", "#efe6d0"), roughness: 0.75, side: THREE.DoubleSide }),
    standard({ map: createStripeTexture("#2a312e", "#d7c4a0"), roughness: 0.75, side: THREE.DoubleSide }),
  ];
  const roofGeometry = new THREE.BoxGeometry(2.4, 0.06, 3.0);
  const signGeometry = new THREE.PlaneGeometry(1.8, 0.45);

  const poles: InstanceSpec[] = [];
  const counters: InstanceSpec[] = [];
  const goods: InstanceSpec[] = [];
  const crates: InstanceSpec[] = [];

  STALLS.forEach((stall, stallIndex) => {
    const awning = awnings[stall.awning % awnings.length];
    if (awning) {
      addMesh(parent, roofGeometry, awning, [stall.x + 0.02, 2.5, stall.z], { rotation: [0, 0, -0.13] });
    }
    const signMaterial = standard({ map: createSignTexture(stall.sign, stall.bg, stall.fg), roughness: 0.6 });
    addMesh(parent, signGeometry, signMaterial, [stall.x + 1.18, 2.2, stall.z], { rotation: [0, Math.PI / 2, 0], cast: false });

    for (const px of [-0.95, 0.95]) {
      for (const pz of [-1.4, 1.4]) {
        poles.push({ position: [stall.x + px, 1.2, stall.z + pz] });
      }
    }
    counters.push({ position: [stall.x + 0.6, 0.45, stall.z] });
    for (let i = 0; i < 9; i += 1) {
      const color = PRODUCE_COLORS[(i + stallIndex) % PRODUCE_COLORS.length] ?? "#b8472f";
      goods.push({
        position: [stall.x + 0.45 + (i % 3) * 0.22, 1.02, stall.z - 0.9 + Math.floor(i / 3) * 0.7 + (i % 2) * 0.1],
        scale: 0.8 + ((i * 7 + stallIndex) % 4) * 0.12,
        color,
      });
    }
    crates.push({ position: [stall.x - 0.4, 0.2, stall.z + 0.8] });
    crates.push({ position: [stall.x - 0.45, 0.2, stall.z - 0.7], rotation: [0, 0.3, 0] });
  });

  addInstances(parent, new THREE.CylinderGeometry(0.04, 0.04, 2.4, 6), materials.metal, poles);
  addInstances(parent, new THREE.BoxGeometry(0.8, 0.9, 2.4), materials.wood, counters);
  addInstances(parent, new THREE.SphereGeometry(0.14, 8, 6), materials.produce, goods);
  addInstances(parent, new THREE.BoxGeometry(0.6, 0.4, 0.5), materials.wood, crates);

  // Entrance gate.
  const gateZ = -2.3;
  for (const x of [-4.3, -8.8]) {
    addMesh(parent, new THREE.BoxGeometry(0.4, 4.8, 0.4), materials.forest, [x, 2.4, gateZ]);
  }
  addMesh(parent, new THREE.BoxGeometry(5.0, 1.2, 0.2), materials.forest, [-6.55, 4.4, gateZ]);
  addMesh(parent, new THREE.BoxGeometry(5.1, 0.12, 0.28), materials.gold, [-6.55, 3.74, gateZ], { cast: false });
  addMesh(parent, new THREE.BoxGeometry(5.1, 0.12, 0.28), materials.gold, [-6.55, 5.06, gateZ], { cast: false });
  const gateSign = standard({
    map: createSignTexture("PALM MILE MARKET", "#1d3226", "#faf6ee"),
    roughness: 0.55,
  });
  addMesh(parent, new THREE.PlaneGeometry(4.7, 1.17), gateSign, [-6.55, 4.4, gateZ + 0.11], { cast: false });
}

/** Discovery marker on a traffic island in the median: gold obelisk, floating gem and a faint beam. */
export function buildMarker(parent: THREE.Group, materials: Materials): THREE.Object3D {
  addMesh(parent, new THREE.BoxGeometry(3.6, 0.2, 5.4), materials.concrete, [0, 0.1, MARKER_Z]);

  const marker = new THREE.Group();
  marker.name = "marker";
  marker.position.set(0, 0.2, MARKER_Z);
  // Larger than life on purpose: it must read from the far end of the street.
  marker.scale.setScalar(1.6);
  parent.add(marker);

  addMesh(marker, new THREE.BoxGeometry(1.6, 0.35, 1.6), materials.darkConcrete, [0, 0.175, 0]);
  addMesh(marker, new THREE.BoxGeometry(1.1, 0.2, 1.1), materials.concrete, [0, 0.45, 0]);
  addMesh(marker, new THREE.CylinderGeometry(0.1, 0.26, 2.8, 4), materials.gold, [0, 1.95, 0], { rotation: [0, Math.PI / 4, 0] });
  addMesh(marker, new THREE.RingGeometry(1.0, 1.28, 40), materials.padRing, [0, 0.03, 0], {
    rotation: [-Math.PI / 2, 0, 0],
    cast: false,
    receive: false,
  });
  const plaque = standard({ map: createSignTexture("DISCOVERY POINT", "#1d3226", "#faf6ee"), roughness: 0.6 });
  addMesh(marker, new THREE.PlaneGeometry(1.2, 0.3), plaque, [0, 0.3, 0.82], { cast: false });
  addMesh(marker, new THREE.CylinderGeometry(0.3, 0.6, 4.6, 24, 1, true), materials.beam, [0, 2.4, 0], {
    cast: false,
    receive: false,
    name: "clue-beam",
  });

  const gem = addMesh(marker, new THREE.OctahedronGeometry(0.34, 0), materials.gold, [0, 3.7, 0], { name: "clue-gem" });
  gem.scale.set(0.85, 1.25, 0.85);
  return gem;
}

const TRUNK_HEIGHT = 6.2;
const TRUNK_BEND = 0.7;

export type Palm = { x: number; z: number; scale: number; yaw: number };

const PALMS: Palm[] = [
  { x: 0, z: -19, scale: 1.15, yaw: 0.4 },
  { x: 0, z: -31, scale: 1.2, yaw: 2.1 },
  { x: 0, z: -44, scale: 1.3, yaw: 4.0 },
  { x: 0, z: -57, scale: 1.3, yaw: 1.2 },
  { x: 0, z: -70, scale: 1.3, yaw: 3.3 },
  { x: 5.3, z: 3, scale: 1.0, yaw: 5.2 },
  { x: 5.4, z: -4, scale: 1.1, yaw: 0.9 },
  { x: 5.3, z: -14, scale: 1.05, yaw: 2.6 },
  { x: 5.4, z: -23, scale: 1.1, yaw: 4.4 },
  { x: 5.3, z: -43, scale: 1.2, yaw: 1.7 },
  { x: -4.7, z: -23, scale: 1.1, yaw: 3.0 },
  { x: -4.8, z: -29, scale: 1.0, yaw: 0.2 },
  { x: -4.7, z: -42, scale: 1.2, yaw: 5.0 },
];

function createTrunkGeometry(): THREE.BufferGeometry {
  const geometry = new THREE.CylinderGeometry(0.11, 0.2, 1, 7, 8);
  geometry.translate(0, 0.5, 0);
  const position = geometry.getAttribute("position");
  for (let i = 0; i < position.count; i += 1) {
    const y = position.getY(i);
    position.setX(i, position.getX(i) + TRUNK_BEND * y * y);
  }
  geometry.computeVertexNormals();
  return geometry;
}

/** Ten arching fronds in one mesh, so every palm crown is a single draw. */
function createCrownGeometry(): THREE.BufferGeometry {
  const fronds = 10;
  const segments = 6;
  const length = 2.7;
  const positions: number[] = [];
  const indices: number[] = [];
  for (let f = 0; f < fronds; f += 1) {
    const yaw = (f / fronds) * Math.PI * 2 + (f % 2) * 0.18;
    const elevation = 0.45 + (f % 3) * 0.2;
    const base = positions.length / 3;
    for (let i = 0; i <= segments; i += 1) {
      const t = i / segments;
      const along = length * t;
      const x = along * Math.cos(elevation);
      const y = along * Math.sin(elevation) - 1.15 * t * t;
      const halfWidth = 0.34 * Math.sin(Math.PI * Math.min(1, t * 1.05 + 0.1)) * (1 - 0.35 * t);
      const row: Array<[number, number]> = [
        [-halfWidth, y - halfWidth * 0.4],
        [0, y],
        [halfWidth, y - halfWidth * 0.4],
      ];
      for (const [lateral, height] of row) {
        positions.push(x * Math.cos(yaw) + lateral * Math.sin(yaw), height, -x * Math.sin(yaw) + lateral * Math.cos(yaw));
      }
    }
    for (let i = 0; i < segments; i += 1) {
      const a = base + i * 3;
      const b = a + 3;
      indices.push(a, b, a + 1, a + 1, b, b + 1);
      indices.push(a + 1, b + 1, a + 2, a + 2, b + 1, b + 2);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

/** Palm trunks and crowns as two instanced meshes. Returns an updater that sways the crowns. */
export function buildPalms(
  parent: THREE.Group,
  materials: Pick<Materials, "trunk" | "leaf">,
  palmList: Palm[] = PALMS,
): (elapsed: number) => void {
  const trunks = new THREE.InstancedMesh(createTrunkGeometry(), materials.trunk, palmList.length);
  const crowns = new THREE.InstancedMesh(createCrownGeometry(), materials.leaf, palmList.length);
  const dummy = new THREE.Object3D();
  dummy.rotation.order = "YXZ";

  palmList.forEach((palm, index) => {
    dummy.position.set(palm.x, 0.16, palm.z);
    dummy.rotation.set(0, palm.yaw, 0);
    dummy.scale.set(palm.scale, TRUNK_HEIGHT * palm.scale, palm.scale);
    dummy.updateMatrix();
    trunks.setMatrixAt(index, dummy.matrix);
  });
  trunks.instanceMatrix.needsUpdate = true;
  trunks.castShadow = true;
  trunks.receiveShadow = true;
  parent.add(trunks);

  crowns.castShadow = true;
  crowns.frustumCulled = false;
  parent.add(crowns);

  return (elapsed: number) => {
    palmList.forEach((palm, index) => {
      const sway = Math.sin(elapsed * 0.7 + index * 1.7) * 0.05;
      dummy.position.set(
        palm.x + TRUNK_BEND * palm.scale * Math.cos(palm.yaw),
        0.16 + TRUNK_HEIGHT * palm.scale,
        palm.z - TRUNK_BEND * palm.scale * Math.sin(palm.yaw),
      );
      dummy.rotation.set(sway, palm.yaw + index, sway * 0.6);
      dummy.scale.setScalar(palm.scale);
      dummy.updateMatrix();
      crowns.setMatrixAt(index, dummy.matrix);
    });
    crowns.instanceMatrix.needsUpdate = true;
  };
}
