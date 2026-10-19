import { interiorById } from "./interiorRegistry";
import type { InteriorDef } from "./interiors";
import { roomName } from "./interiors";

/**
 * Cold Room, the second enterable shop. Building market-east-south, west doorway on the market street.
 * Planned from its business row (businesses.ts) and the "cold-store" recipe (interiorLayouts.ts).
 */

export const COLD_ROOM_INTERIOR: InteriorDef = (() => {
  const interior = interiorById("cold-room");
  if (!interior) {
    throw new Error("The Cold Room has no room.");
  }
  return interior;
})();

export const COLD_ROOM = COLD_ROOM_INTERIOR.room;

export const COLD_ROOM_NAME = roomName(COLD_ROOM_INTERIOR);
