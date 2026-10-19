import { interiorById } from "./interiorRegistry";
import { interiorBoxes } from "./interiors";
import { EXPLORER_RADIUS } from "./movement";
import { startPatrol, stationOf, stepNpc, stepPatrol, type NpcPose, type Patrol } from "./npcZone";
import { SELLER, SELLER_INTERIOR_ID, SELLER_ZONE } from "./shopkeeper";

/**
 * What the Mama Put seller does. She works the kitchen behind the counter: stands at a station, waits,
 * and shuffles to the next one along the counter. That is all the behaviour there is, and every step goes
 * through the zone's rules (npcZone.ts), so she stays in the kitchen, stops at furniture and does not
 * walk into the player. In a conversation she stops where she is and turns toward the player, as far as
 * the zone lets her.
 */
export type SellerState = { pose: NpcPose; patrol: Patrol; moving: boolean };

const WALLS_AND_FURNITURE = (() => {
  const room = interiorById(SELLER_INTERIOR_ID);
  if (!room) {
    throw new Error("The seller's room is missing.");
  }
  return interiorBoxes(room);
})();

export function startSeller(): SellerState {
  return { pose: { x: SELLER.x, z: SELLER.z, yaw: SELLER.yaw }, patrol: startPatrol(), moving: false };
}

export function stepSeller(
  state: SellerState,
  args: { dt: number; talking: boolean; player: { x: number; z: number } },
): SellerState {
  const { dt, talking, player } = args;
  const { patrol, goal } = stepPatrol(SELLER_ZONE, state.patrol, state.pose, dt, talking);
  const obstacles = {
    solids: WALLS_AND_FURNITURE,
    people: [{ x: player.x, z: player.z, radius: EXPLORER_RADIUS }],
  };
  const home = stationOf(SELLER_ZONE, patrol).yaw;
  const result = stepNpc(SELLER_ZONE, state.pose, goal, talking ? player : null, home, obstacles, dt);
  return { pose: result.pose, patrol, moving: result.moving };
}
