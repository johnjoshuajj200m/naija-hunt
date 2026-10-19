import { describe, expect, it } from "vitest";

import { interiorById } from "./interiorRegistry";
import {
  ACCELERATION,
  atRest,
  BACKWARD_FACTOR,
  BRAKING,
  GAIT_SPEED,
  gaitOf,
  RUN_UNLOCKED,
  speedOf,
  STRAFE_FACTOR,
  stepLocomotion,
  wantedVelocity,
  type Motion,
} from "./locomotion";
import { interiorBoxes, interiorBounds } from "./interiors";
import { EXPLORER_RADIUS, PLAY_BOUNDS, type Aabb } from "./movement";
import { walk } from "./testKit";

const DT = 1 / 60;
const OPEN_GROUND: Aabb = { minX: -500, maxX: 500, minZ: -500, maxZ: 500 };
const start = (yaw = 0) => atRest({ x: 0, z: 0, yaw });

describe("input and facing", () => {
  it("walks the way the body faces: yaw 0 is -z, and a quarter turn left is -x", () => {
    expect(wantedVelocity(0, { forward: 1, strafe: 0 }).vz).toBeLessThan(0);
    const left = wantedVelocity(Math.PI / 2, { forward: 1, strafe: 0 });
    expect(left.vx).toBeLessThan(0);
    expect(Math.abs(left.vz)).toBeLessThan(1e-9);
  });

  it("backs up without turning round, and sidesteps to the body's right and left", () => {
    const back = wantedVelocity(0, { forward: -1, strafe: 0 });
    expect(back.vz).toBeGreaterThan(0);
    const right = wantedVelocity(0, { forward: 0, strafe: 1 });
    expect(right.vx).toBeGreaterThan(0);
    const left = wantedVelocity(0, { forward: 0, strafe: -1 });
    expect(left.vx).toBeLessThan(0);
  });

  it("never changes the facing: movement leaves yaw alone", () => {
    const end = walk(start(1.2), { forward: 1, strafe: 1 }, 1, [], OPEN_GROUND);
    expect(end.yaw).toBe(1.2);
  });

  it("has the speeds it says: walking forward is the old speed, backing up and sidestepping are slower", () => {
    expect(Math.hypot(...Object.values(wantedVelocity(0, { forward: 1, strafe: 0 })))).toBeCloseTo(GAIT_SPEED.walk);
    expect(Math.hypot(...Object.values(wantedVelocity(0, { forward: -1, strafe: 0 })))).toBeCloseTo(GAIT_SPEED.walk * BACKWARD_FACTOR);
    expect(Math.hypot(...Object.values(wantedVelocity(0, { forward: 0, strafe: 1 })))).toBeCloseTo(GAIT_SPEED.walk * STRAFE_FACTOR);
  });

  it("is no faster along a diagonal than straight", () => {
    const straight = Math.hypot(...Object.values(wantedVelocity(0.4, { forward: 1, strafe: 0 })));
    const diagonal = Math.hypot(...Object.values(wantedVelocity(0.4, { forward: 1, strafe: 1 })));
    expect(diagonal).toBeLessThanOrEqual(straight + 1e-9);
    // A stick pushed past its rim is no faster than at the rim.
    const hard = Math.hypot(...Object.values(wantedVelocity(0, { forward: 5, strafe: 0 })));
    expect(hard).toBeCloseTo(GAIT_SPEED.walk);
  });
});

describe("acceleration and braking", () => {
  it("builds speed over a few frames and does not jump to full speed", () => {
    let motion: Motion = start();
    motion = stepLocomotion(motion, { forward: 1, strafe: 0 }, DT, [], OPEN_GROUND);
    expect(speedOf(motion)).toBeGreaterThan(0);
    expect(speedOf(motion)).toBeLessThan(GAIT_SPEED.walk * 0.5);
    expect(speedOf(motion)).toBeCloseTo(ACCELERATION * DT, 5);
    const frames = Math.ceil(GAIT_SPEED.walk / ACCELERATION / DT) + 1;
    for (let frame = 0; frame < frames; frame += 1) {
      motion = stepLocomotion(motion, { forward: 1, strafe: 0 }, DT, [], OPEN_GROUND);
    }
    expect(speedOf(motion)).toBeCloseTo(GAIT_SPEED.walk, 5);
  });

  it("slows down over a few frames after the input is released, and slides a short way", () => {
    let motion = walk(start(), { forward: 1, strafe: 0 }, 1, [], OPEN_GROUND);
    expect(speedOf(motion)).toBeCloseTo(GAIT_SPEED.walk, 5);
    const before = motion.z;
    motion = stepLocomotion(motion, { forward: 0, strafe: 0 }, DT, [], OPEN_GROUND);
    expect(speedOf(motion)).toBeGreaterThan(0);
    expect(speedOf(motion)).toBeCloseTo(GAIT_SPEED.walk - BRAKING * DT, 5);
    for (let frame = 0; frame < 12; frame += 1) {
      motion = stepLocomotion(motion, { forward: 0, strafe: 0 }, DT, [], OPEN_GROUND);
    }
    expect(speedOf(motion)).toBe(0);
    const slide = before - motion.z;
    expect(slide).toBeGreaterThan(0.1);
    expect(slide).toBeLessThan(0.6);
  });

  it("takes the same path whatever the frame rate", () => {
    const at60 = walk(start(), { forward: 1, strafe: 0 }, 1, [], OPEN_GROUND, 1 / 60);
    const at30 = walk(start(), { forward: 1, strafe: 0 }, 1, [], OPEN_GROUND, 1 / 30);
    const at144 = walk(start(), { forward: 1, strafe: 0 }, 1, [], OPEN_GROUND, 1 / 144);
    expect(at30.z).toBeCloseTo(at60.z, 0);
    expect(at144.z).toBeCloseTo(at60.z, 0);
  });

  it("caps a long frame, so a stall cannot throw the player across the map", () => {
    const motion = stepLocomotion(start(), { forward: 1, strafe: 0 }, 5, [], OPEN_GROUND);
    expect(Math.abs(motion.z)).toBeLessThan(0.5);
  });

  it("turns round and comes back through zero speed", () => {
    let motion = walk(start(), { forward: 1, strafe: 0 }, 1, [], OPEN_GROUND);
    const z = motion.z;
    motion = walk({ ...motion }, { forward: -1, strafe: 0 }, 0.05, [], OPEN_GROUND);
    expect(motion.vz).toBeLessThan(GAIT_SPEED.walk);
    expect(motion.z).toBeLessThan(z);
  });
});

describe("gaits", () => {
  it("has a run speed for later, but running is off until the figure has a run cycle", () => {
    expect(GAIT_SPEED.run).toBeGreaterThan(GAIT_SPEED.walk);
    expect(RUN_UNLOCKED).toBe(false);
    expect(gaitOf({ run: true })).toBe("walk");
    expect(gaitOf({})).toBe("walk");
    const held = walk(start(), { forward: 1, strafe: 0, run: true }, 1, [], OPEN_GROUND);
    expect(speedOf(held)).toBeCloseTo(GAIT_SPEED.walk, 5);
  });
});

describe("collision", () => {
  const wall: Aabb = { minX: -5, maxX: 5, minZ: -6, maxZ: -5 };

  it("stops dead at a wall and never ends inside it, at any speed", () => {
    for (const dt of [1 / 144, 1 / 60, 1 / 30, 0.05]) {
      const end = walk(start(), { forward: 1, strafe: 0 }, 3, [wall], OPEN_GROUND, dt);
      expect(end.z).toBeGreaterThanOrEqual(wall.maxZ + EXPLORER_RADIUS - 1e-6);
      expect(Math.abs(end.vz)).toBe(0);
    }
  });

  it("slides along a wall instead of sticking to it, and keeps its speed along the wall", () => {
    // Walk into a long wall at 45 degrees: stopped on one axis, free on the other.
    const long: Aabb = { minX: -50, maxX: 50, minZ: -6, maxZ: -5 };
    const end = walk(atRest({ x: 0, z: 0, yaw: Math.PI / 4 }), { forward: 1, strafe: 0 }, 1.5, [long], OPEN_GROUND);
    expect(end.z).toBeGreaterThanOrEqual(long.maxZ + EXPLORER_RADIUS - 1e-6);
    expect(end.x).toBeLessThan(-1);
    expect(end.vx).not.toBe(0);
  });

  it("does not tunnel through a thin wall in one long frame", () => {
    const thin: Aabb = { minX: -5, maxX: 5, minZ: -1.1, maxZ: -1.05 };
    let motion: Motion = { ...start(), vz: -GAIT_SPEED.walk };
    for (let frame = 0; frame < 30; frame += 1) {
      motion = stepLocomotion(motion, { forward: 1, strafe: 0 }, 0.05, [thin], OPEN_GROUND);
    }
    expect(motion.z).toBeGreaterThan(thin.maxZ);
  });

  it("is stopped by the world edge", () => {
    const end = walk(atRest({ x: PLAY_BOUNDS.maxX - 1, z: 0, yaw: -Math.PI / 2 }), { forward: 1, strafe: 0 }, 2, [], PLAY_BOUNDS);
    expect(end.x).toBeLessThanOrEqual(PLAY_BOUNDS.maxX);
  });
});

describe("collision with furniture in Mama Put", () => {
  const def = interiorById("mama-put");
  if (!def) {
    throw new Error("Mama Put is missing");
  }
  const boxes = interiorBoxes(def);
  const bounds = interiorBounds(def);
  const furniture = def.furniture.filter((block) => block.kind !== "wall");

  it("cannot be walked through from any side: counters, shelves, tables and stoves all stop the player", () => {
    expect(furniture.length).toBeGreaterThan(3);
    for (const piece of furniture) {
      const cx = (piece.minX + piece.maxX) / 2;
      const cz = (piece.minZ + piece.maxZ) / 2;
      // Four approaches, straight at the middle of each face from 3 m away.
      for (const [dx, dz] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ] as const) {
        const x = cx + dx * (3 + (piece.maxX - piece.minX) / 2);
        const z = cz + dz * (3 + (piece.maxZ - piece.minZ) / 2);
        if (x < bounds.minX || x > bounds.maxX || z < bounds.minZ || z > bounds.maxZ) {
          continue;
        }
        const yaw = Math.atan2(dx, dz);
        const end = walk(atRest({ x, z, yaw }), { forward: 1, strafe: 0 }, 2.5, boxes, bounds);
        const inside = end.x > piece.minX + 0.01 && end.x < piece.maxX - 0.01 && end.z > piece.minZ + 0.01 && end.z < piece.maxZ - 0.01;
        expect(inside, `${piece.kind} ${dx},${dz}`).toBe(false);
        // The body, not just its centre, stays out.
        const overlap =
          end.x + EXPLORER_RADIUS - 0.001 > piece.minX && end.x - EXPLORER_RADIUS + 0.001 < piece.maxX && end.z + EXPLORER_RADIUS - 0.001 > piece.minZ && end.z - EXPLORER_RADIUS + 0.001 < piece.maxZ;
        expect(overlap, `${piece.kind} ${dx},${dz} body`).toBe(false);
      }
    }
  });

  it("cannot be walked out of the room through a wall", () => {
    // Run in each direction for long enough to cross the room twice.
    for (const yaw of [0, Math.PI / 2, Math.PI, -Math.PI / 2, 0.6, 2.4, -0.7, -2.2]) {
      // Start on free floor on the player's side of the counter.
      const origin = { x: def.room.minX + 2, z: 0 };
      const end = walk(atRest({ ...origin, yaw }), { forward: 1, strafe: 0 }, 6, boxes, bounds);
      const outside = end.x < def.room.minX - 0.8 || end.x > def.room.maxX || end.z < def.room.minZ || end.z > def.room.maxZ;
      expect(outside, `yaw ${yaw}`).toBe(false);
    }
  });
});
