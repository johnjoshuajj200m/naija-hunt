import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

import { paintVertices } from "../scenes/junction/junctionKit";

const CLOTH = "#1d3226";
const CLOTH_DARK = "#163026";
const CREAM = "#efe6d0";
const GOLD = "#d9b04a";
const SKIN = "#8d5a3c";
const TROUSER = "#2a312e";
const CUFF = "#1a1f1c";
const SHOE = "#1a1816";
const SOLE = "#100e0c";
const EYE = "#241c16";

export function paint(geometry: THREE.BufferGeometry, color: string): THREE.BufferGeometry {
  if (!geometry.getAttribute("normal")) {
    geometry.computeVertexNormals();
  }
  if (!geometry.getAttribute("uv")) {
    const count = geometry.getAttribute("position").count;
    geometry.setAttribute("uv", new THREE.BufferAttribute(new Float32Array(count * 2), 2));
  }
  paintVertices(geometry, color);
  return geometry;
}

export function merged(parts: THREE.BufferGeometry[], material: THREE.Material, name: string): THREE.Mesh {
  const geometry = parts.length === 1 ? parts[0] : mergeGeometries(parts);
  if (!geometry) {
    throw new Error("The explorer geometry could not be built.");
  }
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = name;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/** A vertical tapered tube. Its top sits on the local origin and it hangs toward -y. */
export function tube(radiusTop: number, radiusBottom: number, height: number, color: string): THREE.BufferGeometry {
  const geometry = new THREE.CylinderGeometry(radiusTop, radiusBottom, height, 8);
  geometry.translate(0, -height / 2, 0);
  return paint(geometry, color);
}

/**
 * PLACEHOLDER explorer, still procedural. A tapered tunic, rounded head and fitted fila replace the
 * box stack. Limbs stay on the original pivot names so the walk can swing them. Not finished character art.
 * The body faces -z, which is yaw 0. Soles rest on y = 0.
 */
export function createExplorer(): THREE.Group {
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.72, metalness: 0.02 });
  const group = new THREE.Group();
  group.name = "PLACEHOLDER_explorer";

  group.add(leg("explorer-left-leg", "explorer-left-knee", -0.09, material));
  group.add(leg("explorer-right-leg", "explorer-right-knee", 0.09, material));
  group.add(arm("explorer-left-arm", -0.23, material));
  group.add(arm("explorer-right-arm", 0.23, material));
  group.add(merged(bodyParts(), material, "explorer-body"));
  return group;
}

function leg(hipName: string, kneeName: string, x: number, material: THREE.Material): THREE.Group {
  const hip = new THREE.Group();
  hip.name = hipName;
  hip.position.set(x, 0.8, 0);
  hip.add(merged([tube(0.075, 0.058, 0.4, TROUSER)], material, `${hipName}-mesh`));

  const knee = new THREE.Group();
  knee.name = kneeName;
  knee.position.set(0, -0.38, 0);
  const shin = tube(0.055, 0.042, 0.34, TROUSER);
  const cuff = tube(0.046, 0.044, 0.06, CUFF);
  cuff.translate(0, -0.3, 0);
  const upper = new THREE.BoxGeometry(0.09, 0.055, 0.2);
  upper.translate(0, -0.378, -0.035);
  const sole = new THREE.BoxGeometry(0.1, 0.022, 0.22);
  sole.translate(0, -0.409, -0.04);
  knee.add(
    merged(
      [shin, cuff, paint(upper, SHOE), paint(sole, SOLE)],
      material,
      `${kneeName}-mesh`,
    ),
  );
  hip.add(knee);
  return hip;
}

function arm(name: string, x: number, material: THREE.Material): THREE.Group {
  const pivot = new THREE.Group();
  pivot.name = name;
  pivot.position.set(x, 1.3, 0);
  const sleeve = tube(0.052, 0.044, 0.24, CLOTH);
  sleeve.translate(0, 0.02, 0);
  const forearm = tube(0.04, 0.034, 0.22, SKIN);
  forearm.translate(0, -0.22, 0);
  const hand = new THREE.BoxGeometry(0.07, 0.075, 0.04);
  hand.translate(0, -0.45, -0.008);
  pivot.add(merged([sleeve, forearm, paint(hand, SKIN)], material, `${name}-mesh`));
  return pivot;
}

function bodyParts(): THREE.BufferGeometry[] {
  const hem = new THREE.LatheGeometry(
    [
      new THREE.Vector2(0.15, 0.62),
      new THREE.Vector2(0.195, 0.66),
      new THREE.Vector2(0.175, 0.72),
    ],
    10,
  );
  const tunic = new THREE.LatheGeometry(
    [
      new THREE.Vector2(0.15, 0.68),
      new THREE.Vector2(0.165, 0.8),
      new THREE.Vector2(0.132, 0.96),
      new THREE.Vector2(0.15, 1.12),
      new THREE.Vector2(0.2, 1.28),
      new THREE.Vector2(0.16, 1.36),
    ],
    10,
  );
  const collar = new THREE.CylinderGeometry(0.1, 0.115, 0.045, 10);
  collar.translate(0, 1.33, 0);
  const placket = new THREE.BoxGeometry(0.028, 0.42, 0.02);
  placket.translate(0, 1.05, -0.155);
  const neck = new THREE.CylinderGeometry(0.05, 0.062, 0.08, 8);
  neck.translate(0, 1.39, 0);

  const head = new THREE.SphereGeometry(0.112, 12, 10);
  head.scale(1, 1.08, 0.95);
  head.translate(0, 1.5, 0);
  head.computeVertexNormals();

  const ear = (side: number) => {
    const geometry = new THREE.SphereGeometry(0.04, 6, 5);
    geometry.scale(0.7, 1.05, 0.75);
    geometry.translate(side * 0.125, 1.49, 0.015);
    geometry.computeVertexNormals();
    return paint(geometry, SKIN);
  };
  const eye = (side: number) => {
    const geometry = new THREE.SphereGeometry(0.016, 6, 5);
    geometry.translate(side * 0.038, 1.515, -0.1);
    return paint(geometry, EYE);
  };
  const brow = new THREE.BoxGeometry(0.09, 0.012, 0.02);
  brow.translate(0, 1.535, -0.095);
  const nose = new THREE.ConeGeometry(0.016, 0.04, 6);
  nose.rotateX(-Math.PI / 2);
  nose.translate(0, 1.485, -0.112);

  const fila = new THREE.LatheGeometry(
    [
      new THREE.Vector2(0, 1.56),
      new THREE.Vector2(0.1, 1.575),
      new THREE.Vector2(0.145, 1.6),
      new THREE.Vector2(0.09, 1.64),
      new THREE.Vector2(0.055, 1.71),
      new THREE.Vector2(0, 1.735),
    ],
    10,
  );

  return [
    paint(hem, CLOTH_DARK),
    paint(tunic, CLOTH),
    paint(collar, CREAM),
    paint(placket, GOLD),
    paint(neck, SKIN),
    paint(head, SKIN),
    ear(-1),
    ear(1),
    eye(-1),
    eye(1),
    paint(brow, SKIN),
    paint(nose, SKIN),
    paint(fila, GOLD),
  ];
}
