import { describe, expect, it } from "vitest";

import { FLOOR_PITCH } from "./courtGeometry";
import {
  callLift,
  floorElevation,
  indicatedFloor,
  liftPassable,
  selectFloor,
  startLift,
  stepLift,
  type LiftState,
} from "./lift";

/** Run the lift for up to `seconds` with nobody in the doorway, stopping early when `until` is true. */
function run(state: LiftState, seconds: number, until: (state: LiftState) => boolean = () => false, occupied = false): LiftState {
  let current = state;
  for (let t = 0; t < seconds && !until(current); t += 0.05) {
    current = stepLift(current, 0.05, occupied);
  }
  return current;
}

const settled = (state: LiftState): boolean => state.phase === "open" || state.phase === "closed";

describe("the lift", () => {
  it("starts closed at the ground floor, and opens there when called there", () => {
    const state = startLift();
    expect(state.phase).toBe("closed");
    expect(state.floor).toBe(0);
    expect(liftPassable(state, 0)).toBe(false);
    const called = callLift(state, 0);
    expect(called.accepted).toBe(true);
    const open = run(called.state, 3, (s) => s.phase === "open");
    expect(open.phase).toBe("open");
    expect(liftPassable(open, 0)).toBe(true);
    expect(liftPassable(open, 1)).toBe(false);
  });

  it("travels to a called floor with its doors shut, and arrives with them opening", () => {
    const called = callLift(startLift(), 2);
    expect(called.accepted).toBe(true);
    expect(called.state.phase).toBe("moving");
    expect(called.state.open).toBe(0);
    let state = called.state;
    let last = state.y;
    while (state.phase === "moving") {
      expect(liftPassable(state, 0)).toBe(false);
      expect(liftPassable(state, 2)).toBe(false);
      state = stepLift(state, 0.05, false);
      expect(state.y).toBeGreaterThanOrEqual(last - 1e-9);
      last = state.y;
    }
    expect(state.floor).toBe(2);
    expect(state.y).toBe(floorElevation(2));
    expect(state.y).toBe(2 * FLOOR_PITCH);
    expect(state.phase).toBe("opening");
    const open = run(state, 3, (s) => s.phase === "open");
    expect(liftPassable(open, 2)).toBe(true);
    expect(liftPassable(open, 0)).toBe(false);
  });

  it("takes no button while it is moving or its doors are moving", () => {
    const moving = callLift(startLift(), 1).state;
    for (const press of [callLift(moving, 0), selectFloor(moving, 2, true)]) {
      expect(press.accepted).toBe(false);
      expect(press.refusal).toBe("moving");
      expect(press.state).toBe(moving);
    }
    const opening = callLift(startLift(), 0).state;
    expect(opening.phase).toBe("opening");
    expect(selectFloor(opening, 1, true).refusal).toBe("doors");
    expect(callLift(opening, 1).refusal).toBe("doors");
  });

  it("only takes a floor button from inside the cabin", () => {
    const open = run(callLift(startLift(), 0).state, 3, (s) => s.phase === "open");
    const outside = selectFloor(open, 1, false);
    expect(outside.accepted).toBe(false);
    expect(outside.refusal).toBe("outside");
  });

  it("closes its doors, then goes, when a floor is chosen from inside", () => {
    const open = run(callLift(startLift(), 0).state, 3, (s) => s.phase === "open");
    const chosen = selectFloor(open, 2, true);
    expect(chosen.accepted).toBe(true);
    expect(chosen.state.phase).toBe("closing");
    let state = chosen.state;
    let sawMoving = false;
    for (let t = 0; t < 30 && !(sawMoving && settled(state)); t += 0.05) {
      state = stepLift(state, 0.05, false);
      if (state.phase === "moving") {
        sawMoving = true;
        expect(state.open).toBe(0);
      }
    }
    expect(sawMoving).toBe(true);
    expect(state.floor).toBe(2);
    expect(state.phase).toBe("open");
  });

  it("never closes on someone in the doorway: it opens again", () => {
    let state = run(callLift(startLift(), 0).state, 3, (s) => s.phase === "open");
    // Let the hold run out with nobody there, so the doors start to close.
    state = run(state, 10, (s) => s.phase === "closing");
    expect(state.phase).toBe("closing");
    const half = run(state, 0.4);
    expect(half.open).toBeGreaterThan(0);
    expect(half.open).toBeLessThan(1);
    const blocked = stepLift(half, 0.05, true);
    expect(blocked.phase).toBe("opening");
    // And while someone stands there it stays open, however long.
    let held = run(blocked, 3, (s) => s.phase === "open");
    held = run(held, 30, () => false, true);
    expect(held.phase).toBe("open");
    expect(liftPassable(held, 0)).toBe(true);
  });

  it("turns a call from another floor away while it stands open somewhere else", () => {
    const open = run(callLift(startLift(), 0).state, 3, (s) => s.phase === "open");
    const call = callLift(open, 2);
    expect(call.accepted).toBe(false);
    expect(call.refusal).toBe("elsewhere");
  });

  it("shows the floor it is passing on the indicator while it travels", () => {
    let state = callLift(startLift(), 2).state;
    const seen = new Set<number>();
    while (state.phase === "moving") {
      seen.add(indicatedFloor(state));
      state = stepLift(state, 0.05, false);
    }
    expect(seen.has(0)).toBe(true);
    expect(seen.has(1)).toBe(true);
    expect(seen.has(2)).toBe(true);
    expect(indicatedFloor(state)).toBe(2);
  });
});
