import { stepLocomotion, type Motion, type Wish } from "./locomotion";
import type { Aabb, ExplorerPose } from "./movement";
import { PLAY_BOUNDS } from "./movement";

/** Test helper: walk a pose for some seconds at 60 frames a second. Velocity carries from frame to frame. */
export function walk(
  pose: ExplorerPose & { vx?: number; vz?: number },
  wish: Wish,
  seconds: number,
  boxes: readonly Aabb[],
  bounds: Aabb = PLAY_BOUNDS,
  dt = 1 / 60,
): Motion {
  let state: ExplorerPose & { vx?: number; vz?: number } = pose;
  const frames = Math.round(seconds / dt);
  for (let index = 0; index < frames; index += 1) {
    state = stepLocomotion(state, wish, dt, boxes, bounds);
  }
  return stepLocomotion(state, { forward: 0, strafe: 0 }, 0, boxes, bounds);
}
