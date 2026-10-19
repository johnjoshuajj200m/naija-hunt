import type { Portal } from "./court/portals";
import { spaceAfterPortals } from "./court/portals";
import { spaceAfterMove } from "./doorway";
import { WORLD_ENTRANCES } from "./entranceWorld";
import type { GlassDoorSet } from "./glassDoor";
import { stepLocomotion, type Motion, type Wish } from "./locomotion";
import { blocked, EXPLORER_RADIUS, PLAY_BOUNDS, type Aabb, type ExplorerPose } from "./movement";
import type { ShopSpace } from "./interiors";

/** Only doors that open can be walked through. */
export const OPEN_ENTRANCES = WORLD_ENTRANCES.filter((entrance) => entrance.state === "open");

/** Wide enough that the world edge never matters to the overlap test below. */
const EVERYWHERE: Aabb = { minX: -1e6, maxX: 1e6, minZ: -1e6, maxZ: 1e6 };

/**
 * A door's panels block the player, except a player who is somehow already inside them (which the door's
 * own rules prevent), so a panel can never trap anyone. A player pressed against a panel is 0.4 m from
 * it, so the smaller radius here only catches one who is actually overlapping.
 */
export function liveBlockers(blockers: readonly Aabb[], x: number, z: number): Aabb[] {
  return blockers.filter((box) => !blocked(x, z, EXPLORER_RADIUS - 0.1, [box], EVERYWHERE));
}

/** Collision for one space: the walls and furniture, plus the bounds the player must stay in. */
export type SpaceCollision = { boxes: readonly Aabb[]; bounds: Aabb };

/**
 * What a building with floors adds to a step: the height the player stands at, how to find the floor height
 * under a point in a space (null means there is nothing to stand on, which blocks the step), and the doorways
 * between spaces. Without it the player is at height 0 and only street doors lead anywhere.
 */
export type Elevation = {
  y: number;
  resolve: (space: ShopSpace, x: number, z: number, previous: number) => number | null;
  portals: readonly Portal[];
  passable?: (portal: Portal) => boolean;
};

export type WalkResult = { pose: Motion; space: ShopSpace; moved: boolean; y: number };

/**
 * One frame of walking, in the order the controller runs it: move against the walls (plus any glass panel
 * that has not finished opening, and anyone standing in the way), find the floor under the new position
 * (a step onto nothing is slid along or refused), switch space if the player crossed a doorway, and only then
 * let the doors see where the player ended up. Reading presence after the move means a door never shuts on
 * the step that carries the player into it.
 *
 * The pose carries the player's velocity (`vx`, `vz`), so hand the returned pose back in next frame.
 * `bodies` are people who are in the way this frame; they are only read in the space they are in.
 *
 * Pure apart from `doors.update`, which advances the door animation.
 */
export function walkFrame(args: {
  pose: ExplorerPose & { vx?: number; vz?: number };
  input: Wish;
  dt: number;
  space: ShopSpace;
  street: readonly Aabb[];
  rooms: ReadonlyMap<string, { boxes: readonly Aabb[]; bounds: Aabb }>;
  doors?: Pick<GlassDoorSet, "blockers" | "update">;
  bodies?: readonly Aabb[];
  elevation?: Elevation;
}): WalkResult {
  const { pose, input, dt, space, street, rooms, doors, bodies, elevation } = args;
  const room = rooms.get(space);
  const base = room ? room.boxes : street;
  // Panels and people block, unless the player is already inside one, so neither can ever trap them.
  const extra = liveBlockers([...(doors ? doors.blockers() : []), ...(bodies ?? [])], pose.x, pose.z);
  const boxes = extra.length > 0 ? [...base, ...extra] : base;
  const bounds = room ? room.bounds : PLAY_BOUNDS;
  let next = stepLocomotion(pose, input, dt, boxes, bounds);

  let y = 0;
  if (elevation) {
    const previous = elevation.y;
    const found = elevation.resolve(space, next.x, next.z, previous);
    if (found !== null) {
      y = found;
    } else {
      // Nothing to stand on at the new spot: keep the part of the move that still has a floor.
      const alongX = elevation.resolve(space, next.x, pose.z, previous);
      const alongZ = elevation.resolve(space, pose.x, next.z, previous);
      if (alongX !== null) {
        next = { ...next, z: pose.z, vz: 0 };
        y = alongX;
      } else if (alongZ !== null) {
        next = { ...next, x: pose.x, vx: 0 };
        y = alongZ;
      } else {
        next = { ...next, x: pose.x, z: pose.z, vx: 0, vz: 0 };
        y = previous;
      }
    }
  }

  const moved = Math.hypot(next.x - pose.x, next.z - pose.z) > 0.001;
  const after = elevation
    ? spaceAfterPortals(space, next.x, next.z, y, elevation.portals, elevation.passable)
    : spaceAfterMove(space, next.x, next.z, OPEN_ENTRANCES);
  doors?.update(dt, next.x, next.z);
  return { pose: next, space: after, moved, y };
}
