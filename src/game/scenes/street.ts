import * as THREE from "three";

import {
  GUIDEWAY_HEIGHT,
  LEFT_FACE,
  MARKER_Z,
  MEDIAN_HALF,
  PIER_Z,
  RIGHT_FACE,
  ROAD_HALF,
  STREET_CENTER_Z,
  STREET_LENGTH,
} from "./layout";
import type { Materials } from "./materials";
import { addInstances, addMesh, type InstanceSpec } from "./sceneHelpers";
import { createTrain } from "./vehicles";

/** Ground, road, kerbs, the elevated guideway and street furniture. Returns the train for animation. */
export function buildStreet(parent: THREE.Group, materials: Materials): { train: THREE.Group } {
  const flat = (x: number, y: number, z: number): [number, number, number] => [x, y, z];
  const centerZ = STREET_CENTER_Z;

  // Ground and road
  addMesh(parent, new THREE.CircleGeometry(160, 40), materials.sand, flat(0, -0.06, -40), {
    rotation: [-Math.PI / 2, 0, 0],
    cast: false,
    name: "ground",
  });
  addMesh(parent, new THREE.PlaneGeometry(ROAD_HALF * 2, STREET_LENGTH), materials.asphalt, flat(0, 0, centerZ), {
    rotation: [-Math.PI / 2, 0, 0],
    cast: false,
    name: "road",
  });

  // Median planter that carries the guideway piers.
  addMesh(parent, new THREE.BoxGeometry(MEDIAN_HALF * 2, 0.2, STREET_LENGTH), materials.darkConcrete, flat(0, 0.1, centerZ), {
    cast: false,
  });
  addMesh(parent, new THREE.PlaneGeometry(MEDIAN_HALF * 2 - 0.2, STREET_LENGTH), materials.verge, flat(0, 0.205, centerZ), {
    rotation: [-Math.PI / 2, 0, 0],
    cast: false,
  });

  // Sidewalks. The left one is wider because it holds the market plaza.
  const leftWidth = ROAD_HALF - LEFT_FACE;
  const rightWidth = RIGHT_FACE - ROAD_HALF;
  addMesh(
    parent,
    new THREE.BoxGeometry(leftWidth, 0.16, STREET_LENGTH),
    materials.paver(leftWidth, STREET_LENGTH),
    flat(-(ROAD_HALF + leftWidth / 2), 0.08, centerZ),
    { cast: false },
  );
  addMesh(
    parent,
    new THREE.BoxGeometry(rightWidth, 0.16, STREET_LENGTH),
    materials.paver(rightWidth, STREET_LENGTH),
    flat(ROAD_HALF + rightWidth / 2, 0.08, centerZ),
    { cast: false },
  );
  // Terracotta-toned plaza paving under the market.
  addMesh(parent, new THREE.PlaneGeometry(leftWidth - 0.4, 16.4), materials.paver(leftWidth, 16, "#d9b79a"), flat(-(ROAD_HALF + leftWidth / 2), 0.165, -10.3), {
    rotation: [-Math.PI / 2, 0, 0],
    cast: false,
  });

  // Lane edges and a crosswalk.
  for (const side of [-1, 1]) {
    addMesh(parent, new THREE.PlaneGeometry(0.12, STREET_LENGTH), materials.lineGold, flat(side * (ROAD_HALF - 0.3), 0.012, centerZ), {
      rotation: [-Math.PI / 2, 0, 0],
      cast: false,
    });
  }
  const zebra: InstanceSpec[] = [];
  for (const side of [-1, 1]) {
    for (let i = 0; i < 4; i += 1) {
      zebra.push({ position: [side * (MEDIAN_HALF + 0.55 + i * 0.7), 0.02, -21.6] });
    }
  }
  addInstances(parent, new THREE.BoxGeometry(0.4, 0.02, 2.4), materials.lineWhite, zebra, { cast: false });

  // Elevated guideway running over the median, like the real Blue Line over the Badagry Expressway.
  const beamY = GUIDEWAY_HEIGHT;
  addMesh(parent, new THREE.BoxGeometry(3.0, 0.9, STREET_LENGTH), materials.concrete, flat(0, beamY, centerZ));
  for (const side of [-1, 1]) {
    addMesh(parent, new THREE.BoxGeometry(0.16, 0.5, STREET_LENGTH), materials.darkConcrete, flat(side * 1.42, beamY + 0.7, centerZ));
    addMesh(parent, new THREE.BoxGeometry(0.1, 0.1, STREET_LENGTH), materials.gold, flat(side * 1.52, beamY - 0.2, centerZ), {
      cast: false,
    });
  }
  const piers: InstanceSpec[] = [];
  const caps: InstanceSpec[] = [];
  for (const z of PIER_Z) {
    piers.push({ position: [0, (beamY - 0.45) / 2, z] });
    caps.push({ position: [0, beamY - 0.7, z] });
  }
  addInstances(parent, new THREE.BoxGeometry(1.0, beamY - 0.45, 1.0), materials.concrete, piers);
  addInstances(parent, new THREE.BoxGeometry(2.2, 0.5, 1.7), materials.concrete, caps);

  // Median shrubs, kept clear of the piers and the marker island.
  const shrubs: InstanceSpec[] = [];
  const shrubColors = ["#ffffff", "#e3eed6", "#f1f5e6", "#d5e4c9"];
  for (let z = 8; z > -118; z -= 2.5) {
    const nearPier = PIER_Z.some((pierZ) => Math.abs(z - pierZ) < 1.4);
    const nearMarker = Math.abs(z - MARKER_Z) < 3;
    if (nearPier || nearMarker) {
      continue;
    }
    const wobble = Math.sin(z * 12.9898) * 0.5 + 0.5;
    shrubs.push({
      position: [Math.sin(z * 3.1) * 0.12, 0.42, z],
      scale: [0.8 + wobble * 0.4, 0.55 + wobble * 0.35, 0.8 + wobble * 0.4],
      color: shrubColors[Math.floor(wobble * shrubColors.length) % shrubColors.length] ?? "#ffffff",
    });
  }
  addInstances(parent, new THREE.IcosahedronGeometry(0.38, 1), materials.shrub, shrubs, { cast: false });

  // Solar-leaf lamp posts along both kerbs.
  const poles: InstanceSpec[] = [];
  const arms: InstanceSpec[] = [];
  const panels: InstanceSpec[] = [];
  const lamps: InstanceSpec[] = [];
  for (const side of [-1, 1]) {
    for (let z = 6; z > -110; z -= 11) {
      const x = side * (ROAD_HALF + 0.2);
      poles.push({ position: [x, 2.75, z] });
      arms.push({ position: [x - side * 0.65, 5.45, z] });
      panels.push({ position: [x - side * 1.35, 5.62, z], rotation: [0, 0, side * 0.12] });
      lamps.push({ position: [x - side * 0.7, 5.3, z] });
    }
  }
  addInstances(parent, new THREE.CylinderGeometry(0.06, 0.09, 5.5, 8), materials.charcoal, poles);
  addInstances(parent, new THREE.BoxGeometry(1.3, 0.08, 0.08), materials.charcoal, arms);
  addInstances(parent, new THREE.CylinderGeometry(0.85, 0.85, 0.06, 18), materials.solar, panels);
  addInstances(parent, new THREE.SphereGeometry(0.1, 8, 6), materials.gold, lamps, { cast: false });

  const train = createTrain(materials);
  train.rotation.y = Math.PI / 2;
  train.position.set(0, beamY + 0.45, -14);
  parent.add(train);
  return { train };
}
