import { DOOR_HALF_OPEN } from "./entrances";
import type { Aabb } from "./movement";

/**
 * The brain of an automatic sliding glass door. Pure maths, no rendering: glassDoor.ts draws the panels
 * and the explore controller feeds it the player's position every frame.
 *
 * A door lives in its own frame: u is metres from the face of the wall (negative is outside on the street,
 * positive is inside the shop) and s is metres along the wall from the middle of the doorway. Two zones
 * decide what it does.
 *
 *   approach  a wide patch of floor on both sides. Stepping into it opens the door. Once the player has
 *             been in it the patch grows a little, so standing on its edge cannot make the door chatter.
 *   doorway   the door line itself plus room for the player's body either side. While anyone is in it
 *             the door is held open and cannot close, so it never shuts through the player.
 *
 * After the player leaves both zones the door waits DOOR_HOLD_SECONDS, then closes. Re-entering a zone
 * at any moment, even halfway through closing, turns it around.
 */

export const DOOR_OPEN_SECONDS = 0.45;
export const DOOR_CLOSE_SECONDS = 0.7;
export const DOOR_HOLD_SECONDS = 0.9;

export const APPROACH_HALF_WIDTH = 2.2;
export const APPROACH_REACH = 3;
/** Extra margin a zone gets once the player has been in it. */
export const APPROACH_STICKY = 0.7;

/** Half-width and depth of the doorway zone: the opening plus room for the body, and a little either side of the panels. */
export const DOORWAY_HALF_WIDTH = DOOR_HALF_OPEN + 0.6;
export const DOORWAY_OUTSIDE = 0.55;
export const DOORWAY_INSIDE = 0.95;

/** Where the sliding panels sit, in metres in from the face. */
export const PANEL_DEPTH = 0.2;
const PANEL_THICKNESS = 0.12;

/** A door's own frame: the centre of its opening on the face plane, and two unit axes. */
export type DoorFrame = {
  x: number;
  z: number;
  /** Unit vector pointing into the shop. */
  inward: readonly [number, number];
  /** Unit vector along the wall, positive to the right as you walk in. */
  tangent: readonly [number, number];
  /** Half the width of the opening. */
  half: number;
};

export function localOf(frame: DoorFrame, x: number, z: number): { u: number; s: number } {
  const dx = x - frame.x;
  const dz = z - frame.z;
  return { u: dx * frame.inward[0] + dz * frame.inward[1], s: dx * frame.tangent[0] + dz * frame.tangent[1] };
}

export type Presence = { approach: boolean; doorway: boolean };

/** Where the player is relative to a door. `wasApproach` makes the approach patch a little bigger, so it cannot flicker at its edge. */
export function presenceAt(frame: DoorFrame, x: number, z: number, wasApproach: boolean): Presence {
  const { u, s } = localOf(frame, x, z);
  const grow = wasApproach ? APPROACH_STICKY : 0;
  return {
    approach: Math.abs(s) <= APPROACH_HALF_WIDTH + grow && Math.abs(u) <= APPROACH_REACH + grow,
    doorway: Math.abs(s) <= DOORWAY_HALF_WIDTH && u >= -DOORWAY_OUTSIDE && u <= DOORWAY_INSIDE,
  };
}

export type DoorState = {
  /** 0 is shut, 1 is fully open. Linear in time; use `eased` for where the panels are. */
  openness: number;
  /** Seconds left before a door nobody is near starts to close. */
  hold: number;
};

export const SHUT: DoorState = { openness: 0, hold: 0 };

/** Advance a door by dt seconds. Never closes while the doorway is occupied. */
export function stepDoor(state: DoorState, presence: Presence, dt: number): DoorState {
  const step = Math.min(Math.max(dt, 0), 0.1);
  const wanted = presence.approach || presence.doorway;
  const hold = wanted ? DOOR_HOLD_SECONDS : Math.max(0, state.hold - step);
  const open = wanted || hold > 0;
  const openness = open ? Math.min(1, state.openness + step / DOOR_OPEN_SECONDS) : Math.max(0, state.openness - step / DOOR_CLOSE_SECONDS);
  return { openness, hold };
}

/** The panels' position for a given openness: slow at both ends, so they start and stop smoothly. */
export function eased(openness: number): number {
  const t = Math.min(1, Math.max(0, openness));
  return t * t * (3 - 2 * t);
}

/** How far each panel has slid from the closed position, in metres. Left panels go to -s, right panels to +s. */
export function panelSlide(openness: number, half: number): number {
  return eased(openness) * half;
}

/** The clear width of the opening, in metres. */
export function openingWidth(openness: number, half: number): number {
  return 2 * panelSlide(openness, half);
}

const rectOf = (frame: DoorFrame, u0: number, u1: number, s0: number, s1: number): Aabb => {
  const corner = (u: number, s: number) => ({
    x: frame.x + frame.inward[0] * u + frame.tangent[0] * s,
    z: frame.z + frame.inward[1] * u + frame.tangent[1] * s,
  });
  const a = corner(u0, s0);
  const b = corner(u1, s1);
  return { minX: Math.min(a.x, b.x), maxX: Math.max(a.x, b.x), minZ: Math.min(a.z, b.z), maxZ: Math.max(a.z, b.z) };
};

/**
 * What a door that is not fully open blocks: the part of each panel that is still across the opening.
 * A closed door blocks the whole opening; a half-open one leaves a gap in the middle; an open one blocks nothing.
 */
export function doorBlockers(frame: DoorFrame, openness: number): Aabb[] {
  const gap = panelSlide(openness, frame.half);
  if (gap >= frame.half - 0.005) {
    return [];
  }
  const u0 = PANEL_DEPTH - PANEL_THICKNESS / 2;
  const u1 = PANEL_DEPTH + PANEL_THICKNESS / 2;
  return [rectOf(frame, u0, u1, -frame.half, -gap), rectOf(frame, u0, u1, gap, frame.half)];
}
