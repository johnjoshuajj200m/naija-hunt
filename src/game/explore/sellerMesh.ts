import * as THREE from "three";

import { merged, paint, tube } from "./explorerMesh";

const WRAPPER = "#b5452a";
const BLOUSE = "#f0e4c8";
const APRON = "#2f5d8a";
const HEAD_TIE = "#d99a2b";
const SKIN = "#7a4a30";
const EYE = "#241c16";

/** The pivot height of the head, so the nod and turn happen at the neck. */
const NECK_Y = 1.42;

/**
 * PLACEHOLDER shopkeeper, procedural like the explorer and just as unfinished. It reuses the explorer's
 * helpers but has its own outfit and a wider silhouette (flared wrapper, apron, head tie, no legs), so
 * the two figures cannot be confused. A real rigged character belongs to a later asset milestone.
 * Faces -z at yaw 0, soles on y = 0. Add it to the room group, not the district root.
 */
export function createSeller(): THREE.Group {
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.72, metalness: 0.02 });
  const group = new THREE.Group();
  group.name = "PLACEHOLDER_seller";

  const torso = new THREE.Group();
  torso.name = "seller-torso";
  torso.add(merged(bodyParts(), material, "seller-body"));
  torso.add(arm("seller-left-arm", -0.21, material));
  torso.add(arm("seller-right-arm", 0.21, material));

  const head = new THREE.Group();
  head.name = "seller-head";
  head.position.set(0, NECK_Y, 0);
  head.add(merged(headParts(), material, "seller-head-mesh"));
  torso.add(head);
  group.add(torso);

  // The shop sits west of the shadow frustum, so a shadow caster would only add a pass for nothing.
  group.traverse((object) => {
    if (object instanceof THREE.Mesh) {
      object.castShadow = false;
      object.receiveShadow = false;
    }
  });
  return group;
}

function arm(name: string, x: number, material: THREE.Material): THREE.Group {
  const pivot = new THREE.Group();
  pivot.name = name;
  pivot.position.set(x, 1.28, 0);
  // Hands rest forward, on the counter, instead of hanging straight down.
  pivot.rotation.x = 0.5;
  const sleeve = tube(0.058, 0.05, 0.22, BLOUSE);
  sleeve.translate(0, 0.02, 0);
  const forearm = tube(0.042, 0.036, 0.22, SKIN);
  forearm.translate(0, -0.2, 0);
  const hand = new THREE.BoxGeometry(0.07, 0.075, 0.04);
  hand.translate(0, -0.43, 0);
  pivot.add(merged([sleeve, forearm, paint(hand, SKIN)], material, `${name}-mesh`));
  return pivot;
}

function bodyParts(): THREE.BufferGeometry[] {
  const wrapper = new THREE.LatheGeometry(
    [
      new THREE.Vector2(0.32, 0.04),
      new THREE.Vector2(0.29, 0.3),
      new THREE.Vector2(0.22, 0.62),
      new THREE.Vector2(0.16, 0.9),
    ],
    10,
  );
  const blouse = new THREE.LatheGeometry(
    [
      new THREE.Vector2(0.16, 0.88),
      new THREE.Vector2(0.15, 1.0),
      new THREE.Vector2(0.15, 1.12),
      new THREE.Vector2(0.215, 1.27),
      new THREE.Vector2(0.15, 1.37),
    ],
    10,
  );
  const neck = new THREE.CylinderGeometry(0.05, 0.062, 0.08, 8);
  neck.translate(0, 1.39, 0);
  // A short tilt so the lower edge stands proud of the flared wrapper.
  const apron = new THREE.BoxGeometry(0.3, 0.5, 0.02);
  apron.rotateX(0.2);
  apron.translate(0, 0.66, -0.245);

  return [paint(wrapper, WRAPPER), paint(blouse, BLOUSE), paint(neck, SKIN), paint(apron, APRON)];
}

function headParts(): THREE.BufferGeometry[] {
  const skull = new THREE.SphereGeometry(0.115, 12, 10);
  skull.scale(1, 1.08, 0.95);
  skull.translate(0, 1.5 - NECK_Y, 0);
  skull.computeVertexNormals();

  const eye = (side: number) => {
    const geometry = new THREE.SphereGeometry(0.016, 6, 5);
    geometry.translate(side * 0.038, 1.515 - NECK_Y, -0.103);
    return paint(geometry, EYE);
  };

  const wrap = new THREE.LatheGeometry(
    [
      new THREE.Vector2(0.115, 1.53 - NECK_Y),
      new THREE.Vector2(0.155, 1.6 - NECK_Y),
      new THREE.Vector2(0.145, 1.68 - NECK_Y),
      new THREE.Vector2(0.085, 1.75 - NECK_Y),
      new THREE.Vector2(0, 1.775 - NECK_Y),
    ],
    10,
  );
  const knot = new THREE.SphereGeometry(0.065, 8, 6);
  knot.scale(1.2, 0.8, 0.9);
  knot.translate(0.1, 1.75 - NECK_Y, 0);
  knot.computeVertexNormals();

  return [paint(skull, SKIN), eye(-1), eye(1), paint(wrap, HEAD_TIE), paint(knot, HEAD_TIE)];
}

/** Idle: a slow breath, a faint sway, a head that turns and nods a little. Call every frame while visible. */
export function animateSeller(seller: THREE.Object3D, seconds: number): void {
  const torso = seller.getObjectByName("seller-torso");
  const head = seller.getObjectByName("seller-head");
  const left = seller.getObjectByName("seller-left-arm");
  const right = seller.getObjectByName("seller-right-arm");
  if (torso) {
    torso.position.y = Math.sin(seconds * 1.7) * 0.005;
    torso.rotation.z = Math.sin(seconds * 0.8) * 0.012;
  }
  if (head) {
    head.rotation.y = Math.sin(seconds * 0.6) * 0.28;
    head.rotation.x = Math.sin(seconds * 0.9 + 1) * 0.04;
  }
  if (left && right) {
    left.rotation.x = 0.5 + Math.sin(seconds * 1.3) * 0.04;
    right.rotation.x = 0.5 + Math.sin(seconds * 1.3 + 0.6) * 0.04;
  }
}

export function disposeSeller(seller: THREE.Object3D): void {
  const materials = new Set<THREE.Material>();
  seller.traverse((object) => {
    if (object instanceof THREE.Mesh) {
      object.geometry.dispose();
      const list = Array.isArray(object.material) ? object.material : [object.material];
      for (const material of list) {
        materials.add(material);
      }
    }
  });
  for (const material of materials) {
    material.dispose();
  }
}
