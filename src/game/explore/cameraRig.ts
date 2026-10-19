import type { Aabb } from "./movement";

/**
 * The follow camera, with no rendering. It sits behind the player, on the player's facing, at a distance
 * that is clamped to the space the player is in: the camera never leaves that space and never goes
 * through a solid, whether or not it was somewhere else a frame ago.
 *
 * Two rules do the work:
 *  - A volume says where the lens may be (`regions`, a union) and what it may not touch (`solids`). A room's
 *    volume is its inner walls plus its doorway; the street's is the playable ground minus the buildings.
 *  - The distance is cut to the volume's limit at once, and only grows back smoothly. So when the player
 *    crosses a threshold the camera is already in the new space on that frame, and it eases out from there.
 */

export const CAMERA_HEIGHT = 3.1;
export const LOOK_HEIGHT = 1.35;
export const CAMERA_DISTANCE = 7;

/** A camera that has been pulled all the way in sits this much lower and looks this far ahead of the player. */
const PULLED_IN_DROP = 0.8;
const PULLED_IN_LEAD = 0.5;

/** The lens never comes closer to a solid than this (about the near plane), and samples the line this finely. */
const LENS_CLEARANCE = 0.1;
const SAMPLE = 0.1;

/** How quickly the distance grows back, per second. Cutting in is immediate. */
const GROW_RATE = 6;
/** How quickly the camera swings round to a new facing, per second. */
const SWING_RATE = 9;

/**
 * Something the lens may not enter. `top` is how high it is, in metres; with none it is a wall or a building,
 * which is always in the way. Anything lower than CAMERA_OCCLUDER_TOP (a table, a counter, a chest freezer)
 * is not: the lens is well above it and the player can be seen over it, so it does not push the camera in.
 */
export type CameraSolid = Aabb & { top?: number };

export const CAMERA_OCCLUDER_TOP = 1.5;

export type CameraVolume = {
  /** Where the lens may be: any of these. */
  regions: readonly Aabb[];
  /** What it may not be in. Either a fixed list or one that depends on where the player stands. */
  solids: readonly CameraSolid[] | ((x: number, z: number) => readonly CameraSolid[]);
};

export type CameraState = {
  /** The direction the camera looks from, as a yaw. It trails the player's facing while turning. */
  yaw: number;
  /** Horizontal distance behind the player. */
  distance: number;
};

export type CameraView = {
  /** Where the lens is. */
  eye: { x: number; y: number; z: number };
  /** What it looks at. */
  target: { x: number; y: number; z: number };
};

const wrap = (angle: number): number => Math.atan2(Math.sin(angle), Math.cos(angle));

function inside(box: Aabb, x: number, z: number, pad = 0): boolean {
  return x > box.minX - pad && x < box.maxX + pad && z > box.minZ - pad && z < box.maxZ + pad;
}

/** True when the lens may be at this point of the volume. */
export function lensAllowed(volume: CameraVolume, x: number, z: number, solids?: readonly CameraSolid[]): boolean {
  if (!volume.regions.some((region) => x >= region.minX && x <= region.maxX && z >= region.minZ && z <= region.maxZ)) {
    return false;
  }
  const list = solids ?? (typeof volume.solids === "function" ? volume.solids(x, z) : volume.solids);
  return !list.some((box) => (box.top === undefined || box.top > CAMERA_OCCLUDER_TOP) && inside(box, x, z, LENS_CLEARANCE));
}

/**
 * How far back from (x, z) along the camera's direction the lens can go, up to `desired`. The line is
 * walked from the player outward and stops at the first point that is outside the volume or in a solid,
 * so a thin wall between the player and the far end is never stepped over.
 */
export function cameraLimit(volume: CameraVolume, x: number, z: number, yaw: number, desired = CAMERA_DISTANCE): number {
  const fx = -Math.sin(yaw);
  const fz = -Math.cos(yaw);
  // Solids that suit the player's own spot (a building's padding is dropped when the player is inside it).
  const solids = typeof volume.solids === "function" ? volume.solids(x, z) : volume.solids;
  let good = 0;
  for (let distance = 0; distance <= desired + 1e-9; distance += SAMPLE) {
    if (!lensAllowed(volume, x - fx * distance, z - fz * distance, solids)) {
      return good;
    }
    good = distance;
  }
  return desired;
}

export function startCamera(yaw: number, distance = 0): CameraState {
  return { yaw, distance };
}

/**
 * One frame. `pose` is where the player is and which way they face; `volume` is the space they are in.
 * Pass `reset` on the frame the space changes, so the camera is placed in the new space at once and not
 * carried over from the old one.
 */
export function stepCamera(
  state: CameraState,
  pose: { x: number; z: number; yaw: number },
  volume: CameraVolume,
  dt: number,
  reset = false,
  desired = CAMERA_DISTANCE,
): CameraState {
  const step = Math.min(Math.max(dt, 0), 0.05);
  const yaw = reset ? pose.yaw : state.yaw + wrap(pose.yaw - state.yaw) * (1 - Math.exp(-SWING_RATE * step));
  const limit = cameraLimit(volume, pose.x, pose.z, yaw, desired);
  const wanted = Math.min(desired, limit);
  let distance: number;
  if (reset) {
    distance = wanted;
  } else if (wanted <= state.distance) {
    distance = wanted;
  } else {
    distance = Math.min(wanted, state.distance + (wanted - state.distance) * (1 - Math.exp(-GROW_RATE * step)) + 0.02);
  }
  return { yaw, distance };
}

/**
 * The lens position and what it looks at. When the camera had to come in close (a doorway, a wall behind
 * the player) it also drops a little and looks a little ahead of the player, so a camera 0.3 m behind
 * them is not staring straight down at the top of their head with the room out of view.
 */
export function cameraView(state: CameraState, pose: { x: number; z: number; yaw: number }, desired = CAMERA_DISTANCE): CameraView {
  const fx = -Math.sin(state.yaw);
  const fz = -Math.cos(state.yaw);
  const pulledIn = 1 - Math.min(1, state.distance / desired);
  const lead = pulledIn * PULLED_IN_LEAD;
  const pfx = -Math.sin(pose.yaw);
  const pfz = -Math.cos(pose.yaw);
  return {
    eye: { x: pose.x - fx * state.distance, y: CAMERA_HEIGHT - pulledIn * PULLED_IN_DROP, z: pose.z - fz * state.distance },
    target: { x: pose.x + pfx * lead, y: LOOK_HEIGHT, z: pose.z + pfz * lead },
  };
}
