import * as THREE from "three";

/**
 * Street props far from the player are not drawn.
 *
 * A GPU-instanced prop set (all the chairs, say) is one object, and the renderer draws every instance of
 * it whenever any part of its bounds is in view. Standing in the market looking east, that meant drawing
 * the junction's chairs, crates, tyres and barrels 70 m away, where each is a few pixels tall and partly
 * lost in the haze, for about 75,000 triangles. Beyond this distance they are skipped. Nothing near the
 * player changes, and the props are drawn again as soon as the player is within range.
 */
export const PROP_CULL_DISTANCE = 66;

export type Cullable = { object: THREE.Object3D; box: THREE.Box3 };

/** The direct children of the named group, with their world bounds. Call once, after the scene is built. */
export function collectCullables(root: THREE.Object3D, groupName: string): Cullable[] {
  const group = root.getObjectByName(groupName);
  if (!group) {
    return [];
  }
  root.updateWorldMatrix(true, true);
  const items: Cullable[] = [];
  for (const child of group.children) {
    const box = new THREE.Box3().setFromObject(child);
    if (!box.isEmpty()) {
      items.push({ object: child, box });
    }
  }
  return items;
}

const point = new THREE.Vector3();

/** Shows each item within `limit` metres of the player and hides the rest. Returns how many are hidden. */
export function applyDistanceCull(items: readonly Cullable[], x: number, z: number, limit = PROP_CULL_DISTANCE): number {
  let hidden = 0;
  point.set(x, 0, z);
  for (const item of items) {
    const near = item.box.distanceToPoint(point) <= limit;
    item.object.visible = near;
    if (!near) {
      hidden += 1;
    }
  }
  return hidden;
}

/** Shows everything again, for example when the street is hidden and the group's own switch takes over. */
export function showAll(items: readonly Cullable[]): void {
  for (const item of items) {
    item.object.visible = true;
  }
}
