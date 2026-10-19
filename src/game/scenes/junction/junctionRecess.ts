import * as THREE from "three";

import { paintVertices } from "./junctionKit";
import { applyWorldUv } from "./worldUv";

/**
 * One genuine recessed window: a plaster panel with a hole, extruded out from the wall. The glass
 * sits at the back of the hole, so the opening is actually set back rather than drawn on the wall.
 * Kept to a single window so the cost can be measured and the panel removed on its own.
 */
export function createRecessPanel(
  openingW: number,
  openingH: number,
  margin: number,
  depth: number,
  tint: THREE.ColorRepresentation,
): THREE.BufferGeometry {
  const width = openingW + margin * 2;
  const height = openingH + margin * 2;
  const shape = new THREE.Shape();
  shape.moveTo(-width / 2, -height / 2);
  shape.lineTo(width / 2, -height / 2);
  shape.lineTo(width / 2, height / 2);
  shape.lineTo(-width / 2, height / 2);

  // Opposite winding to the outline, which is what ExtrudeGeometry treats as a hole.
  const hole = new THREE.Path();
  hole.moveTo(-openingW / 2, -openingH / 2);
  hole.lineTo(-openingW / 2, openingH / 2);
  hole.lineTo(openingW / 2, openingH / 2);
  hole.lineTo(openingW / 2, -openingH / 2);
  shape.holes.push(hole);

  const geometry = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 1 });
  geometry.translate(0, 0, -depth / 2);
  applyWorldUv(geometry, 2);
  paintVertices(geometry, tint);
  return geometry;
}

export function recessTriangleCount(geometry: THREE.BufferGeometry): number {
  const count = geometry.index ? geometry.index.count : geometry.getAttribute("position").count;
  return count / 3;
}
