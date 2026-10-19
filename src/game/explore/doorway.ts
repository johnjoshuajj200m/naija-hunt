import type { DoorFrame } from "./automaticDoor";
import { localOf } from "./automaticDoor";
import { inwardOf, STREET, type ShopSpace } from "./interiors";
import { FACING } from "../scenes/junction/frontage";
import type { ResolvedEntrance } from "./entrances";

/**
 * Walking through a door. The street and each room are separate spaces with their own collision, but they
 * share one set of world coordinates: a room sits exactly where its building's ground floor is. So going
 * in or out is not a teleport. The moment the player's centre crosses the door line the space changes and
 * the position stays exactly where it is.
 *
 * The two crossings are on different sides of the line, so a player standing on it does not flip back and
 * forth: walking in switches at ENTER_PLANE (just inside the wall), walking out at EXIT_PLANE (just outside it).
 */

/** Metres in from the face of the wall at which the street hands over to the room. */
export const ENTER_PLANE = 0.2;
/** Metres in from the face of the wall at which the room hands over to the street. */
export const EXIT_PLANE = 0.0;
/** A player further in than this, on the street side, is not walking through the door (a teleport or a bug). */
export const ENTER_LIMIT = 1.6;

export function frameOfEntrance(entrance: Pick<ResolvedEntrance, "door" | "facing" | "half">): DoorFrame {
  const inward = inwardOf(entrance.facing);
  return {
    x: entrance.door.x,
    z: entrance.door.z,
    inward: [inward[0], inward[1]],
    tangent: FACING[entrance.facing].tangent,
    half: entrance.half,
  };
}

/**
 * The space the player is in after this frame's movement. Pure: give it where the player is and it says
 * whether they have just walked in through an open door, just walked out of the room they were in, or
 * neither. Closed and locked doors are not in the list, so they can never be walked through.
 */
export function spaceAfterMove(
  space: ShopSpace,
  x: number,
  z: number,
  open: readonly Pick<ResolvedEntrance, "id" | "door" | "facing" | "half">[],
): ShopSpace {
  if (space === STREET) {
    for (const entrance of open) {
      const { u, s } = localOf(frameOfEntrance(entrance), x, z);
      if (u >= ENTER_PLANE && u <= ENTER_LIMIT && Math.abs(s) <= entrance.half) {
        return entrance.id;
      }
    }
    return STREET;
  }
  const entrance = open.find((candidate) => candidate.id === space);
  if (!entrance) {
    return STREET;
  }
  const { u, s } = localOf(frameOfEntrance(entrance), x, z);
  return u <= EXIT_PLANE && Math.abs(s) <= entrance.half + 0.3 ? STREET : space;
}
