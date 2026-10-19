import { STRIP_X, Z } from "./courtGeometry";
import type { Opening } from "../interiors";

/**
 * The ids of Palm Court's rooms and floors, and the gaps in the strip's walls. A leaf module (it imports
 * only the plan's numbers), so the business table, the court plan and the portals can all read it.
 */

/** Floor index: 0 ground, 1 second, 2 third. */
export type Level = 0 | 1 | 2;
export const LEVELS: readonly Level[] = [0, 1, 2];
export const FLOOR_IDS = ["ground", "second", "third"] as const;
/** What a person calls a floor, for the lift's buttons and the HUD. */
export const FLOOR_LABELS = ["G", "2", "3"] as const;
export const FLOOR_NAMES = ["Ground floor", "Second floor", "Third floor"] as const;

export type UnitLetter = "a" | "b" | "c";

export const ROOM = {
  stairs: "palm-court-stairs",
  lift: "palm-court-lift",
} as const;

/** The strip's room on a floor: the lobby on the ground floor, a hall above. */
export function stripRoomId(level: Level): string {
  return level === 0 ? "palm-court-lobby" : `palm-court-hall-${level + 1}`;
}

/** The unit room on a floor. On the ground floor these are the pharmacy, the phone shop and provisions. */
export function unitRoomId(level: Level, letter: UnitLetter): string {
  if (level === 0) {
    return { a: "glow-pharmacy", b: "naija-phones", c: "bola-provisions" }[letter];
  }
  return `unit-${level + 1}${letter}`;
}

export const DOOR_HALF = { doorway: 1, stairs: 1.2, lift: 0.95 } as const;

/**
 * The gaps in the strip's walls on one floor. The east wall (x = stripE) leads to the east units and the west
 * wall to the west ones and the lift; the north end leads to the stair core. On the ground floor the shops at
 * the front have street doors only, so only the back unit, the lift and the stairs open off the lobby.
 */
export function stripOpenings(level: Level): Opening[] {
  const east: Opening = { facing: "+x", along: Z.side, half: DOOR_HALF.doorway, leadsTo: unitRoomId(level, "c") };
  const lift: Opening = { facing: "-x", along: Z.side, half: DOOR_HALF.lift, leadsTo: ROOM.lift };
  const stairs: Opening = { facing: "+z", along: STRIP_X, half: DOOR_HALF.stairs, leadsTo: ROOM.stairs };
  if (level === 0) {
    return [east, lift, stairs];
  }
  return [
    east,
    { facing: "+x", along: Z.frontSide, half: DOOR_HALF.doorway, leadsTo: unitRoomId(level, "a") },
    { facing: "-x", along: Z.frontSide, half: DOOR_HALF.doorway, leadsTo: unitRoomId(level, "b") },
    lift,
    stairs,
  ];
}