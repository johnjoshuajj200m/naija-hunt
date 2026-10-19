import * as THREE from "three";

import { addInstances, addMesh, type InstanceSpec } from "../sceneHelpers";
import { HAZE_COLOR } from "../sky";
import type { JunctionKit } from "./junctionKit";
import {
  FLYOVER_DECK_BOTTOM,
  FLYOVER_DECK_THICKNESS,
  FLYOVER_DEPTH,
  FLYOVER_Z,
  KERB_HEIGHT,
  ROAD_HALF,
} from "./junctionLayout";
import { createDirectionSignTexture } from "./signage";

/**
 * Market street pole positions along z. Kept off the cross street (z -30..-18) and the south road (z -107..-97),
 * and at least 4 m from every shop door and its sign (doors at z 14, 0, -52 and -80 on the east side).
 */
export const MARKET_POLE_Z = [8, -7, -36, -44, -68, -89, -94, -110] as const;
export const MARKET_POLE_X = [-92.4, -79.6] as const;

/** Timber utility poles beside the avenue, crossarms, and the wires that sag between them. */
export function buildUtilityLines(parent: THREE.Group): void {
  const POLE_X = ROAD_HALF + 0.6;
  const POLE_Z = [14, -3, -36, -52, -66, -90, -108];
  const POLE_HEIGHT = 9;
  const ARM_Y = 8.3;

  const poles: InstanceSpec[] = [];
  const arms: InstanceSpec[] = [];
  const segments: number[] = [];

  const addWire = (a: THREE.Vector3, b: THREE.Vector3, sag: number): void => {
    const steps = 14;
    let previous = a.clone();
    for (let i = 1; i <= steps; i += 1) {
      const t = i / steps;
      const point = a.clone().lerp(b, t);
      point.y -= sag * 4 * t * (1 - t);
      segments.push(previous.x, previous.y, previous.z, point.x, point.y, point.z);
      previous = point;
    }
  };

  for (const side of [-1, 1]) {
    POLE_Z.forEach((z, index) => {
      const x = side * POLE_X;
      poles.push({ position: [x, KERB_HEIGHT + POLE_HEIGHT / 2, z] });
      arms.push({ position: [x, ARM_Y, z] });
      // Wires to the next pole on the same side, three per span.
      const nextZ = POLE_Z[index + 1];
      if (nextZ !== undefined) {
        for (const dx of [-0.9, 0, 0.9]) {
          addWire(new THREE.Vector3(x + dx, ARM_Y + 0.12, z), new THREE.Vector3(x + dx, ARM_Y + 0.12, nextZ), 0.55);
        }
      }
      // Service wires across the avenue from this pole to its opposite number.
      if (side === -1) {
        for (const dz of [-0.2, 0.2]) {
          addWire(new THREE.Vector3(x, ARM_Y + 0.1, z + dz), new THREE.Vector3(-x, ARM_Y + 0.1, z + dz), 0.9);
        }
      }
    });
  }

  // Same meshes as the avenue, so the market street does not add a draw call.
  const MARKET_X = -86;
  // Kept off the cross street (z -30..-18) and the south road (z -107..-97), and at least 4 m from every
  // shop door and its sign (doors at z 14, 0, -52 and -80 on the east side), so no pole stands in front of one.
  const MARKET_Z = MARKET_POLE_Z;
  for (const side of [-1, 1]) {
    MARKET_Z.forEach((z, index) => {
      const x = MARKET_X + side * 6.4;
      poles.push({ position: [x, KERB_HEIGHT + POLE_HEIGHT / 2, z] });
      arms.push({ position: [x, ARM_Y, z] });
      const nextZ = MARKET_Z[index + 1];
      if (nextZ !== undefined) {
        for (const dx of [-0.7, 0.7]) {
          addWire(new THREE.Vector3(x + dx, ARM_Y + 0.12, z), new THREE.Vector3(x + dx, ARM_Y + 0.12, nextZ), 0.5);
        }
      }
    });
  }

  addInstances(parent, new THREE.CylinderGeometry(0.1, 0.16, POLE_HEIGHT, 8), new THREE.MeshStandardMaterial({ color: "#5a4a3b", roughness: 0.95, metalness: 0 }), poles, {
    name: "utility-poles",
  });
  addInstances(parent, new THREE.BoxGeometry(2.4, 0.12, 0.12), new THREE.MeshStandardMaterial({ color: "#4a3d31", roughness: 0.9, metalness: 0 }), arms, {
    name: "utility-crossarms",
  });

  const wires = new THREE.BufferGeometry();
  wires.setAttribute("position", new THREE.Float32BufferAttribute(segments, 3));
  const lines = new THREE.LineSegments(wires, new THREE.LineBasicMaterial({ color: "#1b1a18" }));
  lines.name = "utility-wires";
  lines.frustumCulled = false;
  parent.add(lines);
}

/** Original, fictional green direction sign on a post at the near-right corner. All names are invented. */
export function buildDirectionSign(parent: THREE.Group): void {
  const group = new THREE.Group();
  group.name = "direction-sign";
  const board = new THREE.PlaneGeometry(4.6, 4.6 * (408 / 1024));
  const material = new THREE.MeshStandardMaterial({
    map: createDirectionSignTexture([
      { label: "Palm Mile", arrow: "up" },
      // Market Street really is to the west: along the cross street, then north to Mama Put.
      { label: "Market Street", arrow: "left" },
      { label: "Harbour Road", arrow: "right" },
    ]),
    roughness: 0.55,
    metalness: 0.2,
  });
  const x = ROAD_HALF + 3.2;
  const z = -6;
  addMesh(group, board, material, [x, 5.6, z], { rotation: [0, 0.18, 0], cast: false });
  const postMaterial = new THREE.MeshStandardMaterial({ color: "#6b6e70", roughness: 0.45, metalness: 0.8 });
  for (const dx of [-1.4, 1.4]) {
    addMesh(group, new THREE.CylinderGeometry(0.07, 0.07, 6.3, 8), postMaterial, [x + dx, KERB_HEIGHT + 3.15, z - 0.1]);
  }
  parent.add(group);
}

/**
 * PLACEHOLDER flyover: a concrete deck on blocky piers crossing the avenue. Standing in for authored
 * transport infrastructure; it has no ramps, barriers detail or road surface.
 */
export function buildFlyover(parent: THREE.Group, kit: JunctionKit): void {
  const group = new THREE.Group();
  group.name = "PLACEHOLDER_flyover";
  parent.add(group);

  const deckY = FLYOVER_DECK_BOTTOM + FLYOVER_DECK_THICKNESS / 2;
  kit.box(group, "concrete", [150, FLYOVER_DECK_THICKNESS, FLYOVER_DEPTH], [0, deckY, FLYOVER_Z], { tint: "#d6cdbd" });
  // Parapets on both long edges.
  for (const side of [-1, 1]) {
    kit.box(group, "concrete", [150, 1.0, 0.4], [0, FLYOVER_DECK_BOTTOM + FLYOVER_DECK_THICKNESS + 0.5, FLYOVER_Z + side * (FLYOVER_DEPTH / 2 - 0.2)], {
      tint: "#c9c0b0",
    });
  }
  // Piers, kept clear of the carriageway.
  const pierHeight = FLYOVER_DECK_BOTTOM;
  for (const x of [-9, 9, -26, 26, -44, 44, -62, 62]) {
    kit.box(group, "concrete", [1.8, pierHeight, FLYOVER_DEPTH * 0.45], [x, pierHeight / 2, FLYOVER_Z], { tint: "#cfc6b6" });
  }
}

/**
 * PLACEHOLDER skyline: plain, hazy boxes far down the avenue so the horizon is not empty. These are
 * our own simple silhouettes and nothing from the HDRI is ever shown as a background.
 */
export function buildSkyline(parent: THREE.Group): void {
  const group = new THREE.Group();
  group.name = "PLACEHOLDER_skyline";
  const towers: Array<[number, number, number, number, number]> = [
    // x, z, width, depth, height
    [-26, -140, 16, 14, 62],
    [-4, -152, 18, 16, 96],
    [20, -146, 14, 14, 70],
    [44, -138, 18, 18, 54],
    [-52, -134, 20, 16, 44],
    [8, -128, 10, 10, 40],
  ];
  // Unlit and outside the scene fog: at this distance atmosphere, not sunlight, sets the colour. Each tower
  // is hazy at its base (the horizon colour) and a little cooler and clearer towards its top.
  const haze = new THREE.Color(HAZE_COLOR);
  const material = new THREE.MeshBasicMaterial({ vertexColors: true, fog: false });
  towers.forEach(([x, z, w, d, h], index) => {
    const geometry = new THREE.BoxGeometry(w, h, d);
    const top = new THREE.Color(index % 2 === 0 ? "#9fb0b8" : "#b2aea2");
    const position = geometry.getAttribute("position");
    const colors = new Float32Array(position.count * 3);
    const mixed = new THREE.Color();
    for (let i = 0; i < position.count; i += 1) {
      const t = Math.min(1, Math.max(0, position.getY(i) / h + 0.5));
      mixed.copy(haze).lerp(top, Math.pow(t, 0.8));
      colors.set([mixed.r, mixed.g, mixed.b], i * 3);
    }
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    addMesh(group, geometry, material, [x, h / 2, z], { cast: false, receive: false });
  });
  parent.add(group);
}
