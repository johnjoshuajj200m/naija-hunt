import type * as THREE from "three";

import type { JunctionKit } from "../scenes/junction/junctionKit";
import { buildInterior } from "./interiorBuilder";
import { MAMA_PUT_INTERIOR } from "./mamaPut";

/**
 * Ground floor of Mama Put. The room code is generic (interiorBuilder.ts); this stays as the Mama Put
 * entry point so the first shop keeps its own name.
 */
export function buildMamaPutInterior(kit: JunctionKit): THREE.Group {
  return buildInterior(kit, MAMA_PUT_INTERIOR).room;
}
