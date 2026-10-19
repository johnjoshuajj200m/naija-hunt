import { CALL_BUTTON, CALL_REACH } from "./court/courtGeometry";
import { LEVELS, stripRoomId, type Level } from "./court/courtIds";
import { DOOR_REACH, type EntranceState } from "./entrances";
import { WORLD_ENTRANCES } from "./entranceWorld";
import { interiorById } from "./interiorRegistry";
import { nearExit, STREET, type ShopSpace } from "./interiors";
import { inSellerReach, SELLER_INTERIOR_ID } from "./shopkeeper";

/** What the E key or the on-screen button would do right now, if pressed. */
export type InteractTarget =
  | { kind: "seller" }
  | { kind: "door"; action: "enter" | "exit"; entranceId: string }
  /** A door that does not open: closed for the day, or locked. Pressing does nothing. */
  | { kind: "shut"; state: Exclude<EntranceState, "open">; entranceId: string }
  | { kind: "clue" }
  /** The lift's call button on a landing, at that floor. */
  | { kind: "lift-call"; level: Level }
  | null;

/** The nearest entrance whose prompt point is within reach on the street. */
function entranceInReach(x: number, z: number) {
  let best: (typeof WORLD_ENTRANCES)[number] | null = null;
  let bestDistance = DOOR_REACH * DOOR_REACH;
  for (const entrance of WORLD_ENTRANCES) {
    const dx = x - entrance.enterAnchor.x;
    const dz = z - entrance.enterAnchor.z;
    const distance = dx * dx + dz * dz;
    if (distance <= bestDistance) {
      best = entrance;
      bestDistance = distance;
    }
  }
  return best;
}

/**
 * One place that decides priority. The seller wins only while the player is within reach of them, then a
 * door, then the clue. The seller is only ever inside Mama Put and the clue only on the street, so a door
 * can never be hidden behind either. Indoors, the only door is the exit of the room the player is in.
 * `sellerAt` is where the seller is now (she moves about her kitchen); it defaults to her home station.
 */
export function interactTarget(
  space: ShopSpace,
  x: number,
  z: number,
  clueInReach: boolean,
  sellerAt?: { x: number; z: number },
): InteractTarget {
  if (space === STREET) {
    const entrance = entranceInReach(x, z);
    if (entrance) {
      return entrance.state === "open"
        ? { kind: "door", action: "enter", entranceId: entrance.id }
        : { kind: "shut", state: entrance.state, entranceId: entrance.id };
    }
    return clueInReach ? { kind: "clue" } : null;
  }
  if (space === SELLER_INTERIOR_ID && inSellerReach(x, z, sellerAt)) {
    return { kind: "seller" };
  }
  const level = LEVELS.find((candidate) => stripRoomId(candidate) === space);
  if (level !== undefined && Math.hypot(x - CALL_BUTTON.x, z - CALL_BUTTON.z) <= CALL_REACH) {
    return { kind: "lift-call", level };
  }
  const interior = interiorById(space);
  // Only a street door is an exit you press E for. A room inside a building is left by walking out of its doorway.
  if (interior && interior.outer === undefined && nearExit(interior, x, z)) {
    return { kind: "door", action: "exit", entranceId: interior.id };
  }
  return null;
}

export type InteractAction = "advance-dialogue" | "talk" | "enter" | "exit" | "collect" | "call-lift" | "none";

/** An open conversation takes every press. Otherwise the press goes to whatever is in reach. */
export function interactAction(pressed: boolean, talking: boolean, target: InteractTarget): InteractAction {
  if (!pressed) {
    return "none";
  }
  if (talking) {
    return "advance-dialogue";
  }
  if (!target || target.kind === "shut") {
    return "none";
  }
  if (target.kind === "seller") {
    return "talk";
  }
  if (target.kind === "door") {
    return target.action;
  }
  if (target.kind === "lift-call") {
    return "call-lift";
  }
  return "collect";
}
