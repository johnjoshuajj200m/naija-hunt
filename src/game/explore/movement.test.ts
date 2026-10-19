import { describe, expect, it } from "vitest";

import { collisionBoxes } from "./collision";
import { blocked, canCollect, CITY_PLAN, EXPLORER_RADIUS, PLAY_BOUNDS, SPAWNS, TREASURE } from "./movement";
import { holdKey, movementWish, releaseAllInput, stepYaw, TURN_RATE } from "./playInput";

const boxes = collisionBoxes();

describe("city plan", () => {
  it("names at least five blocks and three connected streets", () => {
    expect(CITY_PLAN.blocks.length).toBeGreaterThanOrEqual(5);
    expect(CITY_PLAN.streets.length).toBeGreaterThanOrEqual(3);
  });
});

describe("the playable bounds", () => {
  it("refuses to leave the playable bounds", () => {
    expect(blocked(PLAY_BOUNDS.maxX, 0, EXPLORER_RADIUS, [], PLAY_BOUNDS)).toBe(true);
    expect(blocked(0, 0, EXPLORER_RADIUS, [], PLAY_BOUNDS)).toBe(false);
  });
});

describe("the walk from the junction to the clue", () => {
  it("keeps the avenue, the cross street, the market street and the plaza clear", () => {
    const samples: Array<[number, number]> = [];
    for (let z = 3; z >= -21; z -= 2) {
      samples.push([2, z]);
    }
    for (let x = 2; x >= -100; x -= 2) {
      samples.push([x, -21]);
    }
    for (let z = -21; z >= -100; z -= 2) {
      samples.push([-86, z]);
    }
    samples.push([SPAWNS.plaza.x, SPAWNS.plaza.z], [SPAWNS.clue.x, SPAWNS.clue.z], [TREASURE.x, TREASURE.z]);
    for (const [x, z] of samples) {
      expect(blocked(x, z, EXPLORER_RADIUS, boxes, PLAY_BOUNDS), `${x},${z}`).toBe(false);
    }
  });

  it("collects only from within reach, and only once", () => {
    expect(canCollect(TREASURE.x, TREASURE.z + 1, false)).toBe(true);
    expect(canCollect(SPAWNS.junction.x, SPAWNS.junction.z, false)).toBe(false);
    expect(canCollect(TREASURE.x, TREASURE.z, true)).toBe(false);
  });
});

describe("turning and focus", () => {
  it("caps a stalled frame so a turn cannot spin through a large angle", () => {
    expect(stepYaw(0, 1, 1)).toBeCloseTo(TURN_RATE * 0.05, 5);
    expect(Math.abs(stepYaw(0, 1, 0.05))).toBeLessThan(0.1);
  });

  it("drops held movement when input is released", () => {
    holdKey("KeyW");
    holdKey("ArrowLeft");
    expect(movementWish().forward).toBe(1);
    releaseAllInput();
    expect(movementWish()).toEqual({ forward: 0, strafe: 0, turn: 0, run: false });
  });

  it("reads Shift as a request to run, and drops it with the other keys", () => {
    holdKey("ShiftLeft");
    expect(movementWish().run).toBe(true);
    releaseAllInput();
    expect(movementWish().run).toBe(false);
  });
});
