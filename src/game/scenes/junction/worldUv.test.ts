import * as THREE from "three";
import { describe, expect, it } from "vitest";

import { applyWorldUv } from "./worldUv";

function uvRange(geometry: THREE.BufferGeometry, normalAxis: "x" | "y" | "z", sign: 1 | -1) {
  const uv = geometry.getAttribute("uv");
  const normal = geometry.getAttribute("normal");
  const us: number[] = [];
  const vs: number[] = [];
  for (let i = 0; i < uv.count; i += 1) {
    const n = normalAxis === "x" ? normal.getX(i) : normalAxis === "y" ? normal.getY(i) : normal.getZ(i);
    if (n === sign) {
      us.push(uv.getX(i));
      vs.push(uv.getY(i));
    }
  }
  return { u: Math.max(...us) - Math.min(...us), v: Math.max(...vs) - Math.min(...vs) };
}

describe("applyWorldUv", () => {
  it("makes one UV unit equal one tile, whatever the box size", () => {
    // A 12 m x 6 m x 0.2 m slab with a 3 m tile: the top face spans 4 x 2 tiles.
    const slab = applyWorldUv(new THREE.BoxGeometry(12, 0.2, 6), 3);
    const top = uvRange(slab, "y", 1);
    expect(top.u).toBeCloseTo(4);
    expect(top.v).toBeCloseTo(2);
  });

  it("keeps the same density on the sides of a wall", () => {
    // A 10 m wide, 8 m tall, 0.5 m thick wall with a 2 m tile: front face is 5 x 4 tiles.
    const wall = applyWorldUv(new THREE.BoxGeometry(10, 8, 0.5), 2);
    const front = uvRange(wall, "z", 1);
    expect(front.u).toBeCloseTo(5);
    expect(front.v).toBeCloseTo(4);
    // The end face is 0.5 m deep: a quarter of a tile across.
    const end = uvRange(wall, "x", 1);
    expect(end.u).toBeCloseTo(0.25);
    expect(end.v).toBeCloseTo(4);
  });

  it("refuses geometry without normals instead of producing garbage", () => {
    const bare = new THREE.BufferGeometry();
    bare.setAttribute("position", new THREE.Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 1, 0], 3));
    expect(() => applyWorldUv(bare, 2)).toThrow(/normals/);
  });
});
