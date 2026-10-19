import * as THREE from "three";

import type { Materials } from "./materials";
import { addMesh, profileGeometry, standard } from "./sceneHelpers";
import { createDanfoSideTexture, createTrainSideTexture } from "./textures";

const DANFO_WIDTH = 1.85;
const DANFO_PROFILE: Array<[number, number]> = [
  [0, 0.35],
  [0, 1.85],
  [0.2, 2.1],
  [3.4, 2.1],
  [4.25, 1.55],
  [4.6, 1.45],
  [4.6, 0.45],
  [4.35, 0.35],
];

/**
 * Danfo-style minibus: yellow body, black waist stripe, boxy cabin. The nose points along +x.
 * Shared geometry and materials are built once, so extra buses cost draw calls but little memory.
 */
export function createDanfoFactory(materials: Pick<Materials, "glass" | "metal" | "frame" | "wood" | "charcoal">) {
  const body = standard({ color: "#d6a229", roughness: 0.5, metalness: 0.1 });
  const sideRight = standard({ map: createDanfoSideTexture(false), alphaTest: 0.5, roughness: 0.55, metalness: 0.08 });
  const sideLeft = standard({ map: createDanfoSideTexture(true), alphaTest: 0.5, roughness: 0.55, metalness: 0.08 });
  const headlight = standard({ color: "#efe5c6", roughness: 0.3, metalness: 0.2, emissive: "#4d4426", emissiveIntensity: 0.4 });
  const taillight = standard({ color: "#8a3125", roughness: 0.4, metalness: 0.1 });
  const stripe = standard({ color: "#171717", roughness: 0.7, metalness: 0.05 });
  const rubber = standard({ color: "#161616", roughness: 0.95, metalness: 0 });

  const bodyGeometry = profileGeometry(DANFO_PROFILE, DANFO_WIDTH);
  const sidePlane = new THREE.PlaneGeometry(4.6, 2.3);
  const windshield = new THREE.PlaneGeometry(1.02, DANFO_WIDTH * 0.84);
  windshield.rotateX(-Math.PI / 2);
  const rearWindow = new THREE.PlaneGeometry(DANFO_WIDTH * 0.78, 0.6);
  const wheelGeometry = new THREE.CylinderGeometry(0.36, 0.36, 0.24, 14);
  wheelGeometry.rotateX(Math.PI / 2);
  const hubGeometry = new THREE.CylinderGeometry(0.16, 0.16, 0.26, 10);
  hubGeometry.rotateX(Math.PI / 2);
  const lightGeometry = new THREE.BoxGeometry(0.06, 0.2, 0.3);
  const stripeGeometry = new THREE.BoxGeometry(0.04, 0.22, DANFO_WIDTH + 0.02);
  const bumperGeometry = new THREE.BoxGeometry(0.16, 0.2, DANFO_WIDTH + 0.06);
  const rackGeometry = new THREE.BoxGeometry(2.2, 0.1, 1.3);
  const luggageGeometry = new THREE.BoxGeometry(0.7, 0.4, 0.55);

  return (detailed: boolean): THREE.Group => {
    const bus = new THREE.Group();
    bus.name = "danfo";
    addMesh(bus, bodyGeometry, body, [0, 0, 0]);

    addMesh(bus, sidePlane, sideRight, [2.3, 1.15, DANFO_WIDTH / 2 + 0.012], { cast: false });
    addMesh(bus, sidePlane, sideLeft, [2.3, 1.15, -DANFO_WIDTH / 2 - 0.012], {
      rotation: [0, Math.PI, 0],
      cast: false,
    });

    const slope = -Math.atan2(0.55, 0.85);
    addMesh(bus, windshield, materials.glass, [3.835, 1.835, 0], { rotation: [0, 0, slope], cast: false });
    addMesh(bus, rearWindow, materials.glass, [-0.012, 1.4, 0], { rotation: [0, -Math.PI / 2, 0], cast: false });
    addMesh(bus, stripeGeometry, stripe, [4.61, 1.08, 0], { cast: false });
    addMesh(bus, stripeGeometry, stripe, [-0.02, 1.08, 0], { cast: false });

    for (const x of [0.95, 3.6]) {
      for (const side of [-1, 1]) {
        const z = side * (DANFO_WIDTH / 2 - 0.02);
        addMesh(bus, wheelGeometry, rubber, [x, 0.36, z]);
        if (detailed) {
          addMesh(bus, hubGeometry, materials.metal, [x, 0.36, z + side * 0.01], { cast: false });
        }
      }
    }

    if (detailed) {
      addMesh(bus, bumperGeometry, rubber, [4.62, 0.5, 0]);
      addMesh(bus, bumperGeometry, rubber, [-0.06, 0.5, 0]);
      for (const side of [-1, 1]) {
        addMesh(bus, lightGeometry, headlight, [4.62, 0.82, side * 0.62], { cast: false });
        addMesh(bus, lightGeometry, taillight, [-0.04, 0.9, side * 0.72], { cast: false });
      }
      addMesh(bus, rackGeometry, materials.frame, [1.9, 2.18, 0]);
      addMesh(bus, luggageGeometry, materials.wood, [1.5, 2.43, 0.1]);
      addMesh(bus, luggageGeometry, materials.charcoal, [2.4, 2.43, -0.15]);
    }
    return bus;
  };
}

/** Two-car train. Cars nose-out at both ends, travelling along -z when the group is yawed by pi/2. */
export function createTrain(materials: Materials): THREE.Group {
  const length = 7.9;
  const width = 2.6;
  const profile: Array<[number, number]> = [
    [0, 0],
    [0, 2.3],
    [7.0, 2.3],
    [length, 1.5],
    [length, 0],
  ];
  const bodyGeometry = profileGeometry(profile, width, 0.05);
  const bodyMaterial = standard({ color: "#e4ddcc", roughness: 0.4, metalness: 0.2 });
  const sidePlane = new THREE.PlaneGeometry(length, 2.3);
  const sideMaterial = standard({ map: createTrainSideTexture(), roughness: 0.4, metalness: 0.2 });
  const windshield = new THREE.PlaneGeometry(1.2, width * 0.8);
  windshield.rotateX(-Math.PI / 2);

  const train = new THREE.Group();
  train.name = "train";

  const buildCar = (): THREE.Group => {
    const car = new THREE.Group();
    addMesh(car, bodyGeometry, bodyMaterial, [0, 0, 0]);
    addMesh(car, sidePlane, sideMaterial, [length / 2, 1.15, width / 2 + 0.012], { cast: false });
    addMesh(car, sidePlane, sideMaterial, [length / 2, 1.15, -width / 2 - 0.012], {
      rotation: [0, Math.PI, 0],
      cast: false,
    });
    addMesh(car, windshield, materials.crownGlass, [7.45, 1.93, 0], {
      rotation: [0, 0, -Math.atan2(0.8, 0.9)],
      cast: false,
    });
    return car;
  };

  const lead = buildCar();
  train.add(lead);
  const tail = buildCar();
  tail.rotation.y = Math.PI;
  tail.position.x = -0.18;
  train.add(tail);
  return train;
}
