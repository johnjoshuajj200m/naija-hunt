import { describe, expect, it } from "vitest";

import {
  APPROACH_HALF_WIDTH,
  APPROACH_REACH,
  APPROACH_STICKY,
  DOOR_CLOSE_SECONDS,
  DOOR_HOLD_SECONDS,
  DOOR_OPEN_SECONDS,
  doorBlockers,
  eased,
  openingWidth,
  presenceAt,
  SHUT,
  stepDoor,
  type DoorFrame,
  type DoorState,
} from "./automaticDoor";

// A door on the line z = 0 facing +z (the street), with the shop at negative z. Inward is -z, and the
// tangent runs along +x, the way the facade tables define it.
const frame: DoorFrame = { x: 0, z: 0, inward: [0, -1], tangent: [1, 0], half: 0.85 };
const DT = 1 / 60;

/** Where a player `u` metres in and `s` metres along stands. */
const at = (u: number, s = 0) => ({ x: s, z: -u });

function simulate(state: DoorState, x: number, z: number, seconds: number, wasApproach = false): { state: DoorState; approach: boolean } {
  let current = state;
  let approach = wasApproach;
  for (let t = 0; t < seconds; t += DT) {
    const presence = presenceAt(frame, x, z, approach);
    approach = presence.approach;
    current = stepDoor(current, presence, DT);
  }
  return { state: current, approach };
}

describe("presence", () => {
  it("sees a player in the approach patch on either side, and not one beside or far off", () => {
    expect(presenceAt(frame, at(-2).x, at(-2).z, false).approach).toBe(true);
    expect(presenceAt(frame, at(2).x, at(2).z, false).approach).toBe(true);
    expect(presenceAt(frame, at(-APPROACH_REACH - 0.1).x, at(-APPROACH_REACH - 0.1).z, false).approach).toBe(false);
    expect(presenceAt(frame, at(-1, APPROACH_HALF_WIDTH + 0.1).x, at(-1, APPROACH_HALF_WIDTH + 0.1).z, false).approach).toBe(false);
  });

  it("finds a player in the doorway only while they are in the opening", () => {
    expect(presenceAt(frame, at(0).x, at(0).z, false).doorway).toBe(true);
    expect(presenceAt(frame, at(0.9).x, at(0.9).z, false).doorway).toBe(true);
    expect(presenceAt(frame, at(-0.5).x, at(-0.5).z, false).doorway).toBe(true);
    expect(presenceAt(frame, at(-1.2).x, at(-1.2).z, false).doorway).toBe(false);
    expect(presenceAt(frame, at(2).x, at(2).z, false).doorway).toBe(false);
    expect(presenceAt(frame, at(0, 2).x, at(0, 2).z, false).doorway).toBe(false);
  });

  it("makes the approach patch a little bigger once the player has been in it", () => {
    const edge = at(-(APPROACH_REACH + APPROACH_STICKY / 2));
    expect(presenceAt(frame, edge.x, edge.z, false).approach).toBe(false);
    expect(presenceAt(frame, edge.x, edge.z, true).approach).toBe(true);
  });
});

describe("opening and closing", () => {
  it("starts shut, opens fully in the open time while someone is in the approach patch", () => {
    expect(SHUT.openness).toBe(0);
    const near = at(-2);
    const half = simulate(SHUT, near.x, near.z, DOOR_OPEN_SECONDS / 2).state;
    expect(half.openness).toBeGreaterThan(0.4);
    expect(half.openness).toBeLessThan(0.6);
    const full = simulate(SHUT, near.x, near.z, DOOR_OPEN_SECONDS + 0.05).state;
    expect(full.openness).toBe(1);
  });

  it("stays open the hold time after the player leaves, then closes in the close time", () => {
    const open: DoorState = { openness: 1, hold: DOOR_HOLD_SECONDS };
    const away = at(-10);
    const during = simulate(open, away.x, away.z, DOOR_HOLD_SECONDS - 0.1).state;
    expect(during.openness).toBe(1);
    const closing = simulate(open, away.x, away.z, DOOR_HOLD_SECONDS + DOOR_CLOSE_SECONDS / 2).state;
    expect(closing.openness).toBeGreaterThan(0.2);
    expect(closing.openness).toBeLessThan(0.8);
    const shut = simulate(open, away.x, away.z, DOOR_HOLD_SECONDS + DOOR_CLOSE_SECONDS + 0.1).state;
    expect(shut.openness).toBe(0);
  });

  it("never closes while the doorway is occupied, however long the player stands there", () => {
    const stand = at(0.3);
    const state = simulate({ openness: 1, hold: 0 }, stand.x, stand.z, 30).state;
    expect(state.openness).toBe(1);
  });

  it("never closes while the player stands between the panels' line and the approach patch's edge, outside or in", () => {
    for (const u of [-2.5, -1, 0, 1, 2, 3]) {
      const spot = at(u);
      const { state } = simulate({ openness: 1, hold: 0 }, spot.x, spot.z, 10, true);
      expect(state.openness, `u=${u}`).toBe(1);
    }
  });

  it("turns round halfway through closing when the player comes back", () => {
    const away = at(-10);
    const closing = simulate({ openness: 1, hold: DOOR_HOLD_SECONDS }, away.x, away.z, DOOR_HOLD_SECONDS + 0.3).state;
    expect(closing.openness).toBeLessThan(1);
    expect(closing.openness).toBeGreaterThan(0);
    const near = at(-2);
    const reopened = simulate(closing, near.x, near.z, 0.1).state;
    expect(reopened.openness).toBeGreaterThan(closing.openness);
  });

  it("does not flicker when a player jitters across the edge of the approach patch", () => {
    // Walk back and forth across the patch edge 40 times. Once open the door must not start to close.
    const edgeIn = at(-(APPROACH_REACH - 0.1));
    const edgeOut = at(-(APPROACH_REACH + 0.2));
    let state: DoorState = SHUT;
    let approach = false;
    let reversals = 0;
    let last = 0;
    for (let i = 0; i < 40 * 20; i += 1) {
      const spot = Math.floor(i / 20) % 2 === 0 ? edgeIn : edgeOut;
      const presence = presenceAt(frame, spot.x, spot.z, approach);
      approach = presence.approach;
      state = stepDoor(state, presence, DT);
      const delta = state.openness - last;
      if (delta < 0) {
        reversals += 1;
      }
      last = state.openness;
    }
    expect(reversals).toBe(0);
    expect(state.openness).toBe(1);
  });

  it("is smooth: the panels start and stop gently", () => {
    expect(eased(0)).toBe(0);
    expect(eased(1)).toBe(1);
    expect(eased(0.05)).toBeLessThan(0.05);
    expect(eased(0.95)).toBeGreaterThan(0.95);
    expect(eased(0.5)).toBeCloseTo(0.5, 5);
  });

  it("ignores a huge time step instead of jumping the door", () => {
    const next = stepDoor(SHUT, { approach: true, doorway: false }, 5);
    expect(next.openness).toBeLessThan(0.5);
  });
});

describe("what a door that is not fully open blocks", () => {
  it("blocks the whole opening when shut and nothing when open", () => {
    const shut = doorBlockers(frame, 0);
    expect(shut).toHaveLength(2);
    const span = Math.min(...shut.map((box) => box.minX));
    const spanMax = Math.max(...shut.map((box) => box.maxX));
    expect(span).toBeCloseTo(-0.85, 5);
    expect(spanMax).toBeCloseTo(0.85, 5);
    expect(doorBlockers(frame, 1)).toEqual([]);
  });

  it("leaves a growing gap in the middle, and the gap is as wide as the opening", () => {
    const widths = [0, 0.25, 0.5, 0.75].map((openness) => openingWidth(openness, frame.half));
    for (let i = 1; i < widths.length; i += 1) {
      expect(widths[i] as number).toBeGreaterThan(widths[i - 1] as number);
    }
    const half = doorBlockers(frame, 0.5);
    const left = half.find((box) => box.maxX < 0.01) as { minX: number; maxX: number };
    const right = half.find((box) => box.minX > -0.01) as { minX: number; maxX: number };
    expect(right.minX - left.maxX).toBeCloseTo(openingWidth(0.5, frame.half), 5);
  });

  it("keeps the panels thin and on the door line", () => {
    for (const box of doorBlockers(frame, 0)) {
      expect(box.maxZ - box.minZ).toBeLessThan(0.2);
      expect((box.minZ + box.maxZ) / 2).toBeCloseTo(-0.2, 5);
    }
  });
});
