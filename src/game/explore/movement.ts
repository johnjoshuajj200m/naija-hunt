/**
 * Explorer placement and the world's walkable rules, with no rendering. Walls are boxes on the ground
 * plane. How the explorer moves through them (speed, inertia, sliding) is locomotion.ts, and where the
 * camera may stand is cameraRig.ts.
 */

export type Aabb = { minX: number; maxX: number; minZ: number; maxZ: number };

export type ExplorerPose = { x: number; z: number; yaw: number };

export const EXPLORER_RADIUS = 0.4;

/** Where the first clue stands, on the plaza pavement north of the cross street. */
export const TREASURE = { x: -106, z: -10 };
export const COLLECT_RADIUS = 2.2;

export const PLAY_BOUNDS: Aabb = { minX: -136, maxX: 30, minZ: -132, maxZ: 28 };

export const SPAWNS = {
  junction: { x: 3.2, z: 3, yaw: 0 },
  market: { x: -86, z: -40, yaw: 0 },
  plaza: { x: -100, z: -21, yaw: Math.PI },
  clue: { x: -106, z: -12, yaw: Math.PI },
} as const;

export type SpawnName = keyof typeof SPAWNS;

/** Five blocks and the streets that join them. The geometry is built to match these names. */
export const CITY_PLAN = {
  blocks: ["avenue-west", "cross-south", "market-east", "market-west", "palm-plaza"],
  streets: ["avenue", "cross-street", "market-street", "south-road"],
} as const;

export function blocked(x: number, z: number, radius: number, boxes: readonly Aabb[], bounds: Aabb): boolean {
  if (x < bounds.minX + radius || x > bounds.maxX - radius || z < bounds.minZ + radius || z > bounds.maxZ - radius) {
    return true;
  }
  for (const box of boxes) {
    if (x > box.minX - radius && x < box.maxX + radius && z > box.minZ - radius && z < box.maxZ + radius) {
      return true;
    }
  }
  return false;
}

export function canCollect(x: number, z: number, collected: boolean): boolean {
  if (collected) {
    return false;
  }
  const dx = x - TREASURE.x;
  const dz = z - TREASURE.z;
  return dx * dx + dz * dz <= COLLECT_RADIUS * COLLECT_RADIUS;
}
