import * as THREE from "three";
import { describe, expect, it } from "vitest";

import { applyDistanceCull, collectCullables, PROP_CULL_DISTANCE, showAll } from "./distanceCull";

function prop(name: string, x: number, z: number): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(2, 1, 2));
  mesh.name = name;
  mesh.position.set(x, 0.5, z);
  return mesh;
}

function district(): { root: THREE.Group; near: THREE.Mesh; far: THREE.Mesh } {
  const root = new THREE.Group();
  const group = new THREE.Group();
  group.name = "street-props";
  const near = prop("near", 0, 0);
  const far = prop("far", 200, 0);
  group.add(near, far);
  root.add(group, prop("elsewhere", 5, 5));
  return { root, near, far };
}

describe("distance cull", () => {
  it("collects only the children of the named group", () => {
    const { root } = district();
    expect(collectCullables(root, "street-props")).toHaveLength(2);
    expect(collectCullables(root, "missing")).toEqual([]);
  });

  it("hides props beyond the limit and shows those within it", () => {
    const { root, near, far } = district();
    const items = collectCullables(root, "street-props");
    expect(applyDistanceCull(items, 0, 0)).toBe(1);
    expect(near.visible).toBe(true);
    expect(far.visible).toBe(false);
    // Walking toward the far prop brings it back, measured to the edge of its bounds, not its centre.
    expect(applyDistanceCull(items, 200 - PROP_CULL_DISTANCE - 0.9, 0)).toBe(1);
    expect(far.visible).toBe(true);
    expect(near.visible).toBe(false);
    showAll(items);
    expect(near.visible && far.visible).toBe(true);
  });

  it("keeps the limit well past the point where a prop is still readable", () => {
    // The market doors are about 70 m from the nearest junction props. The limit must be inside that, and
    // outside the width of a street, so nothing a player can walk up to ever pops.
    expect(PROP_CULL_DISTANCE).toBeGreaterThan(50);
    expect(PROP_CULL_DISTANCE).toBeLessThan(70);
  });
});
