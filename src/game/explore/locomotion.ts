import { blocked, EXPLORER_RADIUS, PLAY_BOUNDS, type Aabb, type ExplorerPose } from "./movement";

/**
 * How the explorer moves. One rule ties input to facing: the body always faces the way the camera looks
 * (its yaw), W walks that way, S backs up without turning round, and A and D sidestep. Turning is a
 * separate input (arrows, Look stick, a drag), so the body never snaps toward the direction of travel.
 *
 * Speed is not instant. The velocity eases toward what the input asks for, which is what makes starts
 * and stops read as a person and not a cursor. Walls still stop the player dead on the blocked axis and
 * let them slide along the other one.
 *
 * There are two gaits so a run can be switched on later. It is not: the figure has one walking cycle
 * and no run cycle, so RUN_UNLOCKED stays false until an animation exists. Nothing here jumps or climbs.
 */

export type Gait = "walk" | "run";

/** Metres per second at full stick. "walk" keeps the speed the game has always had. */
export const GAIT_SPEED: Readonly<Record<Gait, number>> = { walk: 5.5, run: 8 };

/** Running needs a run animation. Flip this when the figure has one. */
export const RUN_UNLOCKED = false;

/** Backing up and sidestepping are slower than walking forward, as for a person. */
export const BACKWARD_FACTOR = 0.6;
export const STRAFE_FACTOR = 0.8;

/** Metres per second squared. Speeding up takes about 0.2 s and stopping about 0.1 s. */
export const ACCELERATION = 28;
export const BRAKING = 55;

/** No single collision step moves further than this, so a fast frame can never hop a thin wall. */
const MAX_STEP = 0.1;
const MAX_FRAME = 0.05;

export type Motion = ExplorerPose & { vx: number; vz: number };

export type Wish = { forward: number; strafe: number; run?: boolean };

export const atRest = (pose: ExplorerPose): Motion => ({ x: pose.x, z: pose.z, yaw: pose.yaw, vx: 0, vz: 0 });

export function gaitOf(wish: Pick<Wish, "run">): Gait {
  return wish.run === true && RUN_UNLOCKED ? "run" : "walk";
}

const clamp = (value: number): number => Math.max(-1, Math.min(1, value));

/** The velocity (world metres per second) the input is asking for at this facing. */
export function wantedVelocity(yaw: number, wish: Wish): { vx: number; vz: number } {
  let forward = clamp(wish.forward);
  let strafe = clamp(wish.strafe);
  // Two keys at once must not be faster than one: the pair is a direction, not two speeds.
  const length = Math.hypot(forward, strafe);
  if (length > 1) {
    forward /= length;
    strafe /= length;
  }
  const along = forward >= 0 ? forward : forward * BACKWARD_FACTOR;
  const across = strafe * STRAFE_FACTOR;
  const speed = GAIT_SPEED[gaitOf(wish)];
  // Yaw 0 faces -z. Positive yaw turns toward -x (west).
  const fx = -Math.sin(yaw);
  const fz = -Math.cos(yaw);
  const rx = Math.cos(yaw);
  const rz = -Math.sin(yaw);
  return { vx: (fx * along + rx * across) * speed, vz: (fz * along + rz * across) * speed };
}

/** Moves the velocity toward the wanted one by at most `rate * dt`. Braking is firmer than speeding up. */
function approach(current: number, wanted: number, other: number, otherWanted: number, dt: number): [number, number] {
  const wantsSpeed = Math.hypot(wanted, otherWanted);
  const hasSpeed = Math.hypot(current, other);
  const rate = wantsSpeed >= hasSpeed ? ACCELERATION : BRAKING;
  const dx = wanted - current;
  const dz = otherWanted - other;
  const gap = Math.hypot(dx, dz);
  const reach = rate * dt;
  if (gap <= reach) {
    return [wanted, otherWanted];
  }
  return [current + (dx / gap) * reach, other + (dz / gap) * reach];
}

/**
 * One frame of movement. `boxes` are the solids (walls, furniture, panels, people); `bounds` is where the
 * centre may be. Pure.
 */
export function stepLocomotion(
  motion: ExplorerPose & { vx?: number; vz?: number },
  wish: Wish,
  dt: number,
  boxes: readonly Aabb[],
  bounds: Aabb = PLAY_BOUNDS,
): Motion {
  const step = Math.min(Math.max(dt, 0), MAX_FRAME);
  const wanted = wantedVelocity(motion.yaw, wish);
  let [vx, vz] = approach(motion.vx ?? 0, wanted.vx, motion.vz ?? 0, wanted.vz, step);

  let x = motion.x;
  let z = motion.z;
  const travel = Math.hypot(vx, vz) * step;
  const pieces = Math.max(1, Math.ceil(travel / MAX_STEP));
  const dx = (vx * step) / pieces;
  const dz = (vz * step) / pieces;
  for (let index = 0; index < pieces; index += 1) {
    if (dx !== 0) {
      if (blocked(x + dx, z, EXPLORER_RADIUS, boxes, bounds)) {
        vx = 0;
      } else {
        x += dx;
      }
    }
    if (dz !== 0) {
      if (blocked(x, z + dz, EXPLORER_RADIUS, boxes, bounds)) {
        vz = 0;
      } else {
        z += dz;
      }
    }
  }
  return { x, z, yaw: motion.yaw, vx, vz };
}

export const speedOf = (motion: Pick<Motion, "vx" | "vz">): number => Math.hypot(motion.vx, motion.vz);
