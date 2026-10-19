import * as THREE from "three";
import { describe, expect, it } from "vitest";

import { cameraLimit } from "./cameraRig";
import { collisionBoxes, STREET_CAMERA } from "./collision";
import { ENTER_PLANE, EXIT_PLANE, spaceAfterMove } from "./doorway";
import { WORLD_ENTRANCES } from "./entranceWorld";
import type { ResolvedEntrance } from "./entrances";
import { createGlassDoors, type GlassDoorSet } from "./glassDoor";
import { INTERIORS } from "./interiorRegistry";
import { inwardOf, interiorBounds, interiorBoxes, STREET, type ShopSpace } from "./interiors";
import { blocked, EXPLORER_RADIUS, PLAY_BOUNDS, type ExplorerPose } from "./movement";
import { walkFrame } from "./walkFrame";

const DT = 1 / 60;
const street = collisionBoxes();
const rooms = new Map(INTERIORS.map((def) => [def.id, { boxes: interiorBoxes(def), bounds: interiorBounds(def) }]));
const open = WORLD_ENTRANCES.filter((entrance) => entrance.state === "open");
const shut = WORLD_ENTRANCES.filter((entrance) => entrance.state !== "open");

type Sim = { pose: ExplorerPose; space: ShopSpace; doors: GlassDoorSet; frames: number };

const yawToward = (dx: number, dz: number) => Math.atan2(-dx, -dz);

/** A player `u` metres in from the face of the wall (negative is on the street) and `s` metres along it, facing into the shop. */
function start(entrance: ResolvedEntrance, u: number, s = 0): Sim {
  const inward = inwardOf(entrance.facing);
  return {
    pose: {
      x: entrance.door.x + inward[0] * u - inward[1] * s,
      z: entrance.door.z + inward[1] * u + inward[0] * s,
      yaw: yawToward(inward[0], inward[1]),
    },
    space: STREET,
    doors: createGlassDoors(new THREE.Group(), WORLD_ENTRANCES),
    frames: 0,
  };
}

function run(sim: Sim, seconds: number, forward: number): Sim {
  let { pose, space } = sim;
  const steps = Math.round(seconds / DT);
  for (let i = 0; i < steps; i += 1) {
    const result = walkFrame({ pose, input: { forward, strafe: 0 }, dt: DT, space, street, rooms, doors: sim.doors });
    pose = result.pose;
    space = result.space;
  }
  return { ...sim, pose, space, frames: sim.frames + steps };
}

describe("walking through an open doorway", () => {
  for (const entrance of open) {
    it(`${entrance.id}: walks in from the street and out again without a key press`, () => {
      const inward = inwardOf(entrance.facing);
      const front = start(entrance, -6);
      expect(blocked(front.pose.x, front.pose.z, EXPLORER_RADIUS, street, PLAY_BOUNDS), "start on free street").toBe(false);
      const room = rooms.get(entrance.id);
      expect(room).toBeDefined();

      // Walk in. The player must end up in this room, on free floor, and never stand inside a wall on the way.
      let sim = front;
      let wasBlocked = false;
      let entered = false;
      for (let i = 0; i < 180; i += 1) {
        sim = run(sim, DT, 1);
        const boxes = sim.space === STREET ? street : (rooms.get(sim.space)?.boxes ?? []);
        const bounds = sim.space === STREET ? PLAY_BOUNDS : (rooms.get(sim.space)?.bounds as typeof PLAY_BOUNDS);
        wasBlocked ||= blocked(sim.pose.x, sim.pose.z, EXPLORER_RADIUS - 0.01, boxes, bounds);
        if (sim.space === entrance.id) {
          entered = true;
          break;
        }
      }
      expect(wasBlocked).toBe(false);
      expect(entered).toBe(true);
      // The crossing happens at the doorway, not somewhere along the wall.
      const dx = sim.pose.x - entrance.door.x;
      const dz = sim.pose.z - entrance.door.z;
      expect(dx * inward[0] + dz * inward[1]).toBeGreaterThanOrEqual(ENTER_PLANE - 0.1);
      expect(dx * inward[0] + dz * inward[1]).toBeLessThan(ENTER_PLANE + 0.5);

      // A little further and the player is well inside the room box.
      sim = run(sim, 0.4, 1);
      expect(sim.space).toBe(entrance.id);

      // Turn round and walk out again: the player ends on the street, outside the face.
      sim = { ...sim, pose: { ...sim.pose, yaw: sim.pose.yaw + Math.PI } };
      sim = run(sim, 2, 1);
      expect(sim.space).toBe(STREET);
      const ox = sim.pose.x - entrance.door.x;
      const oz = sim.pose.z - entrance.door.z;
      expect(ox * inward[0] + oz * inward[1]).toBeLessThan(EXIT_PLANE + 0.01);
    });
  }

  it("lets a player who is half a metre off the middle of the door walk straight in", () => {
    // A thumb stick is not exact. The opening is wide enough that a sloppy line still goes through.
    for (const entrance of open) {
      for (const offset of [-0.55, 0.55]) {
        const sim = run(start(entrance, -6, offset), 2.5, 1);
        expect(sim.space, `${entrance.id} at ${offset}`).toBe(entrance.id);
      }
    }
  });

  it("a sliding door is open before the player reaches it and closed again after they clear it", () => {
    const entrance = open.find((candidate) => candidate.doorKind === "sliding-glass") as ResolvedEntrance;
    let sim = start(entrance, -6);
    expect(sim.doors.openness(entrance.id)).toBe(0);
    // Approach: the door opens on its own, before the player's body reaches the glass.
    let sawOpenAtThreshold = false;
    for (let i = 0; i < 240 && sim.space === STREET; i += 1) {
      sim = run(sim, DT, 1);
      const inward = inwardOf(entrance.facing);
      const u = (sim.pose.x - entrance.door.x) * inward[0] + (sim.pose.z - entrance.door.z) * inward[1];
      if (u >= -0.2) {
        sawOpenAtThreshold = (sim.doors.openness(entrance.id) ?? 0) > 0.99;
        break;
      }
    }
    expect(sawOpenAtThreshold).toBe(true);
    // Pass through and walk out the other way, then stop 4 m clear of the glass.
    sim = run(sim, 1.2, 1);
    expect(sim.space).toBe(entrance.id);
    // The turn is instant here, so the velocity reverses over about 0.4 s; allow for it.
    sim = { ...sim, pose: { ...sim.pose, yaw: sim.pose.yaw + Math.PI } };
    sim = run(sim, 1.9, 1);
    expect(sim.space).toBe(STREET);
    // Standing just outside the door the door stays open. Far away it closes.
    expect(sim.doors.openness(entrance.id)).toBeGreaterThan(0);
    sim = run(sim, 1.2, 1);
    sim = run(sim, 3, 0);
    expect(sim.doors.openness(entrance.id)).toBe(0);
  });

  it("never lets the door shut on a player standing in the doorway", () => {
    const entrance = open.find((candidate) => candidate.doorKind === "sliding-glass") as ResolvedEntrance;
    let sim = start(entrance, -6);
    sim = run(sim, 0.8, 1);
    // Stop with the centre a little inside the door line, stand for ten seconds.
    for (let i = 0; i < 240 && sim.space === STREET; i += 1) {
      sim = run(sim, DT, 1);
    }
    expect(sim.space).toBe(entrance.id);
    const standing = run(sim, 10, 0);
    expect(standing.doors.openness(entrance.id)).toBe(1);
    expect(standing.space).toBe(entrance.id);
  });

  it("never traps or crushes a player who stops dead anywhere in the doorway, going in or coming out", () => {
    // The player carries speed now, so they slide a little after letting go. Stop at every point of the
    // crossing, wait with the door free to shut, and check it stayed open and they can still leave.
    const entrance = open.find((candidate) => candidate.doorKind === "sliding-glass") as ResolvedEntrance;
    for (const frames of [30, 38, 44, 50, 56, 62, 70]) {
      let sim = run(start(entrance, -3), frames * DT, 1);
      // Let go of the stick: the body keeps moving for a moment.
      sim = run(sim, 0.6, 0);
      sim = run(sim, 8, 0);
      const where = `stopped after ${frames} frames, in ${sim.space}`;
      const boxes = sim.space === STREET ? street : (rooms.get(sim.space)?.boxes ?? []);
      const bounds = sim.space === STREET ? PLAY_BOUNDS : (rooms.get(sim.space)?.bounds as typeof PLAY_BOUNDS);
      expect(blocked(sim.pose.x, sim.pose.z, EXPLORER_RADIUS - 0.01, boxes, bounds), where).toBe(false);
      if (sim.space === entrance.id) {
        // In the doorway or inside it, near enough for the door to stay open.
        const inward = inwardOf(entrance.facing);
        const u = (sim.pose.x - entrance.door.x) * inward[0] + (sim.pose.z - entrance.door.z) * inward[1];
        if (u < 1) {
          expect(sim.doors.openness(entrance.id), where).toBe(1);
        }
      }
      // Whatever side they stopped on, they can walk on through (turning round if they are outside).
      const walkedIn = run(sim, 2.5, 1);
      expect(walkedIn.space, `${where}: carries on in`).toBe(entrance.id);
      const turned = { ...walkedIn, pose: { ...walkedIn.pose, yaw: walkedIn.pose.yaw + Math.PI } };
      expect(run(turned, 3.5, 1).space, `${where}: and back out`).toBe(STREET);
    }
  });
});

describe("closed and locked doors", () => {
  for (const entrance of shut) {
    it(`${entrance.id} (${entrance.state}) cannot be walked into`, () => {
      const inward = inwardOf(entrance.facing);
      let sim = start(entrance, -3);
      sim = run(sim, 4, 1);
      expect(sim.space).toBe(STREET);
      const u = (sim.pose.x - entrance.door.x) * inward[0] + (sim.pose.z - entrance.door.z) * inward[1];
      expect(u).toBeLessThan(0);
    });
  }

  it("spaceAfterMove only ever offers open entrances", () => {
    for (const entrance of shut) {
      const inward = inwardOf(entrance.facing);
      const x = entrance.door.x + inward[0] * 0.5;
      const z = entrance.door.z + inward[1] * 0.5;
      expect(spaceAfterMove(STREET, x, z, open)).toBe(STREET);
    }
  });
});

describe("the street follow camera", () => {
  it("never follows the player into a doorway pocket and ends up inside the wall", () => {
    for (const entrance of open) {
      const inward = inwardOf(entrance.facing);
      // Walking away from the door, so the camera trails behind the player toward the door.
      const yaw = yawToward(-inward[0], -inward[1]);
      // Also standing right at the door, inside the awning's clearance: the wall itself is the limit then.
      for (const u of [-0.6, -1.8, -3, -5, -9]) {
        const x = entrance.door.x + inward[0] * u;
        const z = entrance.door.z + inward[1] * u;
        const distance = cameraLimit(STREET_CAMERA, x, z, yaw);
        const eyeU = u + distance;
        expect(eyeU, `${entrance.id} u=${u}`).toBeLessThanOrEqual(0.05);
      }
    }
  });
});

describe("spaceAfterMove", () => {
  it("does not flip back and forth on the door line", () => {
    const entrance = open[0] as ResolvedEntrance;
    const inward = inwardOf(entrance.facing);
    const at = (u: number) => [entrance.door.x + inward[0] * u, entrance.door.z + inward[1] * u] as const;
    // Between the two planes the player keeps whichever space they were in.
    const [mx, mz] = at((ENTER_PLANE + EXIT_PLANE) / 2);
    expect(spaceAfterMove(STREET, mx, mz, open)).toBe(STREET);
    expect(spaceAfterMove(entrance.id, mx, mz, open)).toBe(entrance.id);
    const [ix, iz] = at(ENTER_PLANE + 0.1);
    expect(spaceAfterMove(STREET, ix, iz, open)).toBe(entrance.id);
    const [ox, oz] = at(EXIT_PLANE - 0.1);
    expect(spaceAfterMove(entrance.id, ox, oz, open)).toBe(STREET);
  });

  it("does not take a player standing beside the door for one going through it", () => {
    const entrance = open[0] as ResolvedEntrance;
    const inward = inwardOf(entrance.facing);
    const x = entrance.door.x + inward[0] * 0.5 - inward[1] * (entrance.half + 0.5);
    const z = entrance.door.z + inward[1] * 0.5 + inward[0] * (entrance.half + 0.5);
    expect(spaceAfterMove(STREET, x, z, open)).toBe(STREET);
  });
});
