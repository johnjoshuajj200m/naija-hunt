import { interiorById } from "./interiorRegistry";
import type { InteriorBlock, InteriorDef } from "./interiors";
import { roomName } from "./interiors";

/**
 * Mama Put, the first enterable shop. Building market-east-corner, west doorway on the market street.
 * The room itself is planned from its business row (businesses.ts) and the "buka" recipe
 * (interiorLayouts.ts); this file only gives the first shop its own names.
 */

export const MAMA_PUT_INTERIOR: InteriorDef = (() => {
  const interior = interiorById("mama-put");
  if (!interior) {
    throw new Error("Mama Put has no room.");
  }
  return interior;
})();

/** The serving counter the seller stands behind. */
export const COUNTER: InteriorBlock = (() => {
  const counter = MAMA_PUT_INTERIOR.furniture.find((piece) => piece.kind === "counter" && piece.look?.items === "food");
  if (!counter) {
    throw new Error("Mama Put has no serving counter.");
  }
  return counter;
})();

export const ROOM_NAME = roomName(MAMA_PUT_INTERIOR);
