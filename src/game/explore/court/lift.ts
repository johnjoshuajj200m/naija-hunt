import { FLOOR_PITCH } from "./courtGeometry";
import type { Level } from "./courtIds";

/**
 * The lift, as a state machine with no rendering. One cabin serves the three floors.
 *
 *   closed   doors shut, cabin at `floor`. The only state a call is taken in (besides open at that floor).
 *   opening  doors sliding open at `floor`.
 *   open     doors open. They stay open while anyone is in the doorway, and for LIFT_HOLD seconds after.
 *   closing  doors sliding shut. If anyone steps into the doorway they turn round and open again.
 *   moving   doors shut, cabin travelling from `floor` to `target`. Nothing can be pressed.
 *
 * `open` is how far the doors are open, 0 to 1, and is the only thing the doors' look and their blockers
 * read. A passenger can only cross a landing's doorway while the doors are at least LIFT_PASSABLE open at
 * that landing's floor, so nobody can be left in the shaft or walked into a wall.
 */

export type LiftPhase = "closed" | "opening" | "open" | "closing" | "moving";

export type LiftState = {
  phase: LiftPhase;
  /** The floor the cabin is at, or has just left. */
  floor: Level;
  /** Where it is going: set while it waits for its doors to close, and while it moves. */
  target: Level | null;
  /** The floor it left, for the travel curve. */
  from: Level;
  /** Doors, 0 shut to 1 open. */
  open: number;
  /** Travel progress, 0 to 1. */
  travel: number;
  /** Seconds the doors will stay open with nobody near. */
  hold: number;
  /** The cabin's elevation above the street, metres. */
  y: number;
};

export const LIFT_OPEN_SECONDS = 0.9;
export const LIFT_CLOSE_SECONDS = 1.0;
export const LIFT_HOLD_SECONDS = 6;
/** Travel time per floor, with a floor at least this long however short the trip. */
export const LIFT_SECONDS_PER_FLOOR = 2.2;
/** The doors count as open for passing through from here. */
export const LIFT_PASSABLE = 0.75;

export const floorElevation = (level: Level): number => level * FLOOR_PITCH;

export function startLift(floor: Level = 0): LiftState {
  return { phase: "closed", floor, target: null, from: floor, open: 0, travel: 0, hold: 0, y: floorElevation(floor) };
}

/** Why a press was not taken, for the HUD. */
export type LiftRefusal = "moving" | "doors" | "elsewhere" | "outside";

export type LiftResult = { state: LiftState; accepted: boolean; refusal?: LiftRefusal };

const taken = (state: LiftState): LiftResult => ({ state, accepted: true });
const refused = (state: LiftState, refusal: LiftRefusal): LiftResult => ({ state, accepted: false, refusal });

/**
 * A call button on a landing. Taken when the cabin is idle (it comes, or opens if it is already here) or when
 * its doors are open at this very floor. Not taken while the doors are moving, the cabin is travelling, or
 * the cabin is standing open at another floor (somebody may be in it; its doors close by themselves soon).
 */
export function callLift(state: LiftState, floor: Level): LiftResult {
  if (state.phase === "moving") {
    return refused(state, "moving");
  }
  if (state.phase === "opening" || state.phase === "closing") {
    return refused(state, "doors");
  }
  if (state.floor === floor) {
    return state.phase === "open" ? taken({ ...state, hold: LIFT_HOLD_SECONDS }) : taken({ ...state, phase: "opening" });
  }
  if (state.phase === "open") {
    return refused(state, "elsewhere");
  }
  return taken(leave(state, floor));
}

/**
 * A button inside the cabin. Only from inside, and only while the doors are closed or fully at rest open.
 * From open the doors close first; from closed the cabin goes at once.
 */
export function selectFloor(state: LiftState, floor: Level, inCabin: boolean): LiftResult {
  if (!inCabin) {
    return refused(state, "outside");
  }
  if (state.phase === "moving") {
    return refused(state, "moving");
  }
  if (state.phase === "opening" || state.phase === "closing") {
    return refused(state, "doors");
  }
  if (floor === state.floor) {
    return state.phase === "open" ? taken({ ...state, hold: LIFT_HOLD_SECONDS }) : taken({ ...state, phase: "opening" });
  }
  if (state.phase === "open") {
    return taken({ ...state, phase: "closing", target: floor });
  }
  return taken(leave(state, floor));
}

function leave(state: LiftState, floor: Level): LiftState {
  return { ...state, phase: "moving", target: floor, from: state.floor, travel: 0, open: 0 };
}

export function travelSeconds(from: Level, to: Level): number {
  return Math.max(1.8, Math.abs(to - from) * LIFT_SECONDS_PER_FLOOR);
}

const smooth = (t: number): number => t * t * (3 - 2 * t);

/**
 * One step. `occupied` is whether anyone (the player) is in the doorway at the floor the cabin is at, on
 * either side of the door. Doors never close on an occupied doorway; they turn round.
 */
export function stepLift(state: LiftState, dt: number, occupied: boolean): LiftState {
  const step = Math.min(Math.max(dt, 0), 0.1);
  switch (state.phase) {
    case "closed":
      return state;
    case "opening": {
      const open = Math.min(1, state.open + step / LIFT_OPEN_SECONDS);
      return open >= 1 ? { ...state, open: 1, phase: "open", hold: LIFT_HOLD_SECONDS } : { ...state, open };
    }
    case "open": {
      if (occupied) {
        return { ...state, hold: LIFT_HOLD_SECONDS };
      }
      const hold = state.hold - step;
      return hold <= 0 ? { ...state, hold: 0, phase: "closing" } : { ...state, hold };
    }
    case "closing": {
      if (occupied) {
        return { ...state, phase: "opening" };
      }
      const open = Math.max(0, state.open - step / LIFT_CLOSE_SECONDS);
      if (open > 0) {
        return { ...state, open };
      }
      return state.target !== null && state.target !== state.floor
        ? leave({ ...state, open: 0 }, state.target)
        : { ...state, open: 0, phase: "closed", target: null };
    }
    case "moving": {
      const target = state.target ?? state.floor;
      const travel = Math.min(1, state.travel + step / travelSeconds(state.from, target));
      const y = floorElevation(state.from) + (floorElevation(target) - floorElevation(state.from)) * smooth(travel);
      if (travel >= 1) {
        return { ...state, y: floorElevation(target), floor: target, target: null, from: target, travel: 1, phase: "opening", open: 0 };
      }
      return { ...state, travel, y };
    }
  }
}

/** True when a passenger can cross the doorway of the landing at `floor`: the doors are open there. */
export function liftPassable(state: LiftState, floor: Level): boolean {
  return state.floor === floor && state.phase !== "moving" && state.phase !== "closed" && state.open >= LIFT_PASSABLE;
}

/** The floor the indicator shows: where the cabin is, or the next floor it will reach while it travels. */
export function indicatedFloor(state: LiftState): Level {
  if (state.phase !== "moving") {
    return state.floor;
  }
  const target = state.target ?? state.floor;
  const nearest = (floorElevation(state.from) + (floorElevation(target) - floorElevation(state.from)) * smooth(state.travel)) / FLOOR_PITCH;
  return Math.min(2, Math.max(0, Math.round(nearest))) as Level;
}
