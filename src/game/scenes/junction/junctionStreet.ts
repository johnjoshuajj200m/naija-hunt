import * as THREE from "three";

import { addInstances, type InstanceSpec } from "../sceneHelpers";
import {
  AVENUE_END_Z,
  AVENUE_START_Z,
  CROSS_FAR_Z,
  CROSS_HALF_LENGTH,
  CROSS_NEAR_Z,
  KERB_HEIGHT,
  MEDIAN_HALF,
  ROAD_HALF,
  SIDEWALK_WIDTH,
} from "./junctionLayout";
import type { JunctionKit } from "./junctionKit";

const SLAB = 0.3; // thickness of road and ground slabs; their top faces sit at y = 0 (roads) or KERB_HEIGHT (pavements)

/** Ground, asphalt, kerbs, pavements, lane markings and the far median. */
export function buildStreet(parent: THREE.Group, kit: JunctionKit): void {
  const street = new THREE.Group();
  street.name = "street";
  parent.add(street);

  // Red laterite earth under everything. Overlapping slabs elsewhere keep their tops above it.
  // Its top sits 2 cm below the asphalt, level enough to stand on and inside the road slabs' thickness.
  kit.box(street, "red_laterite_soil_stones", [420, 0.4, 420], [0, -0.22, -60], { tint: "#d9b49a", cast: false });

  // Asphalt. The cross street is one slab so the junction square has no seam; the avenue stops at its edges.
  const crossDepth = CROSS_NEAR_Z - CROSS_FAR_Z;
  kit.box(street, "asphalt_02", [CROSS_HALF_LENGTH * 2, SLAB, crossDepth], [0, -SLAB / 2, (CROSS_NEAR_Z + CROSS_FAR_Z) / 2], {
    cast: false,
  });
  const nearLength = AVENUE_START_Z - CROSS_NEAR_Z;
  kit.box(street, "asphalt_02", [ROAD_HALF * 2, SLAB, nearLength], [0, -SLAB / 2, (AVENUE_START_Z + CROSS_NEAR_Z) / 2], {
    cast: false,
  });
  const farLength = CROSS_FAR_Z - AVENUE_END_Z;
  kit.box(street, "asphalt_02", [ROAD_HALF * 2, SLAB, farLength], [0, -SLAB / 2, (CROSS_FAR_Z + AVENUE_END_Z) / 2], {
    cast: false,
  });

  // Pavements along the avenue, brick with a concrete kerb on the road side.
  for (const side of [-1, 1]) {
    const centreX = side * (ROAD_HALF + SIDEWALK_WIDTH / 2);
    const kerbX = side * (ROAD_HALF + 0.12);
    for (const [z0, z1] of [
      [AVENUE_START_Z, CROSS_NEAR_Z],
      [CROSS_FAR_Z, AVENUE_END_Z],
    ] as const) {
      const length = z0 - z1;
      const centreZ = (z0 + z1) / 2;
      kit.box(street, "brick_pavement_02", [SIDEWALK_WIDTH, SLAB, length], [centreX, KERB_HEIGHT - SLAB / 2, centreZ], {
        tint: "#e6cdb4",
      });
      kit.box(street, "concrete", [0.24, KERB_HEIGHT + 0.01, length], [kerbX, (KERB_HEIGHT + 0.01) / 2, centreZ], {
        cast: false,
      });
    }
  }

  // Pavements along the cross street, beyond the avenue pavements.
  for (const [zEdge, direction] of [
    [CROSS_NEAR_Z, 1],
    [CROSS_FAR_Z, -1],
  ] as const) {
    for (const side of [-1, 1]) {
      const x0 = ROAD_HALF + SIDEWALK_WIDTH;
      const length = CROSS_HALF_LENGTH - x0;
      const centreX = side * (x0 + length / 2);
      const centreZ = zEdge + direction * (SIDEWALK_WIDTH / 2);
      kit.box(street, "brick_pavement_02", [length, SLAB, SIDEWALK_WIDTH], [centreX, KERB_HEIGHT - SLAB / 2, centreZ], {
        tint: "#e6cdb4",
      });
      kit.box(street, "concrete", [length, KERB_HEIGHT + 0.01, 0.24], [centreX, (KERB_HEIGHT + 0.01) / 2, zEdge + direction * 0.12], {
        cast: false,
      });
    }
  }

  // Median island on the far avenue.
  const medianLength = CROSS_FAR_Z - AVENUE_END_Z;
  const medianZ = (CROSS_FAR_Z + AVENUE_END_Z) / 2;
  kit.box(street, "concrete", [MEDIAN_HALF * 2, KERB_HEIGHT + 0.02, medianLength], [0, (KERB_HEIGHT + 0.02) / 2, medianZ], {
    cast: false,
  });
  kit.box(street, "red_laterite_soil_stones", [MEDIAN_HALF * 2 - 0.4, KERB_HEIGHT + 0.04, medianLength], [0, (KERB_HEIGHT + 0.04) / 2, medianZ], {
    tint: "#c99a78",
    cast: false,
  });

  buildMarkings(street);
}

/** Paint is a thin box floating just above the asphalt; polygon offset stops it flickering with the road. */
function buildMarkings(parent: THREE.Group): void {
  const paint = new THREE.MeshStandardMaterial({
    color: "#e9e4d4",
    roughness: 0.85,
    metalness: 0,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
  const yellow = paint.clone();
  yellow.color.set("#d9ad3a");

  const white: InstanceSpec[] = [];
  const centre: InstanceSpec[] = [];
  const PAINT_Y = 0.012;

  // Dashed centre line on the near avenue (the far avenue has a median).
  for (let z = AVENUE_START_Z - 2; z > CROSS_NEAR_Z + 2; z -= 9) {
    centre.push({ position: [0, PAINT_Y, z], scale: [0.16, 1, 3.6] });
  }

  // Stop line and zebra crossing on the avenue, just short of the junction.
  white.push({ position: [0, PAINT_Y, CROSS_NEAR_Z + 4.6], scale: [ROAD_HALF * 2 - 0.6, 1, 0.45] });
  for (let x = -ROAD_HALF + 0.9; x < ROAD_HALF - 0.5; x += 1.15) {
    white.push({ position: [x, PAINT_Y, CROSS_NEAR_Z + 2.5], scale: [0.6, 1, 3.2] });
  }

  // Zebra crossing on each arm of the cross street.
  for (const side of [-1, 1]) {
    for (let z = CROSS_FAR_Z + 1.2; z < CROSS_NEAR_Z - 0.6; z += 1.15) {
      white.push({ position: [side * (ROAD_HALF + 3.4), PAINT_Y, z], scale: [3.2, 1, 0.6] });
    }
  }

  // Dashed lane line on the cross street arms.
  for (const side of [-1, 1]) {
    for (let x = ROAD_HALF + 8; x < CROSS_HALF_LENGTH - 2; x += 8) {
      centre.push({ position: [side * x, PAINT_Y, (CROSS_NEAR_Z + CROSS_FAR_Z) / 2], scale: [3.2, 1, 0.16] });
    }
  }

  // Yellow edge lines along the far avenue.
  for (const side of [-1, 1]) {
    yellowEdge(parent, yellow, side * (ROAD_HALF - 0.35));
  }

  // Market street, south road and the westward cross street. Same paint mesh as the junction.
  for (let z = 20; z > -14; z -= 8) {
    centre.push({ position: [-86, PAINT_Y, z], scale: [0.16, 1, 3.2] });
  }
  for (let z = -34; z > -94; z -= 8) {
    centre.push({ position: [-86, PAINT_Y, z], scale: [0.16, 1, 3.2] });
  }
  for (let x = -78; x > -118; x -= 8) {
    centre.push({ position: [x, PAINT_Y, -24], scale: [3.2, 1, 0.16] });
  }
  // Zebra where the market street meets the cross street.
  for (let z = -28.4; z < -19.4; z += 1.25) {
    white.push({ position: [-86, PAINT_Y, z], scale: [7.4, 1, 0.42] });
  }
  for (let x = -40; x > -112; x -= 8) {
    if (x < -80 && x > -92) {
      continue;
    }
    centre.push({ position: [x, PAINT_Y, -102], scale: [3.2, 1, 0.16] });
  }
  yellowRun(parent, yellow, [-81.4, PAINT_Y, 3], [0.12, 0.006, 36]);
  yellowRun(parent, yellow, [-90.6, PAINT_Y, 3], [0.12, 0.006, 36]);
  yellowRun(parent, yellow, [-81.4, PAINT_Y, -63.5], [0.12, 0.006, 62]);
  yellowRun(parent, yellow, [-90.6, PAINT_Y, -63.5], [0.12, 0.006, 62]);
  yellowRun(parent, yellow, [-104, PAINT_Y, -97.35], [22, 0.006, 0.12]);
  yellowRun(parent, yellow, [-104, PAINT_Y, -106.65], [22, 0.006, 0.12]);
  yellowRun(parent, yellow, [-55, PAINT_Y, -97.35], [48, 0.006, 0.12]);
  yellowRun(parent, yellow, [-55, PAINT_Y, -106.65], [48, 0.006, 0.12]);

  const flat = new THREE.BoxGeometry(1, 0.006, 1);
  addInstances(parent, flat, paint, [...white, ...centre], { cast: false, name: "road-paint" });
}

function yellowRun(parent: THREE.Group, material: THREE.Material, position: [number, number, number], size: [number, number, number]): void {
  const edge = new THREE.Mesh(new THREE.BoxGeometry(size[0], size[1], size[2]), material);
  edge.position.set(position[0], position[1], position[2]);
  edge.castShadow = false;
  edge.receiveShadow = true;
  parent.add(edge);
}

function yellowEdge(parent: THREE.Group, material: THREE.Material, x: number): void {
  const length = CROSS_FAR_Z - AVENUE_END_Z - 2;
  const edge = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.006, length), material);
  edge.position.set(x, 0.012, (CROSS_FAR_Z + AVENUE_END_Z) / 2);
  edge.receiveShadow = true;
  parent.add(edge);
}
