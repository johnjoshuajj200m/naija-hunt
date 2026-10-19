import * as THREE from "three";
import { describe, expect, it } from "vitest";

import { BUILDINGS } from "../scenes/junction/junctionBuildings";
import {
  CAMERA_DISTANCE,
  CAMERA_HEIGHT,
  CAMERA_OCCLUDER_TOP,
  cameraLimit,
  cameraView,
  lensAllowed,
  startCamera,
  stepCamera,
  type CameraVolume,
} from "./cameraRig";
import { collisionBoxes, STREET_CAMERA } from "./collision";
import { WORLD_ENTRANCES } from "./entranceWorld";
import { footprintBox } from "./entrances";
import { createGlassDoors } from "./glassDoor";
import { INTERIORS } from "./interiorRegistry";
import {
  BLOCK_TOP,
  inwardOf,
  interiorBlocks,
  interiorBounds,
  interiorBoxes,
  interiorCameraVolume,
  STREET,
  type InteriorDef,
  type ShopSpace,
} from "./interiors";
import { blocked, EXPLORER_RADIUS, PLAY_BOUNDS, type Aabb } from "./movement";
import { walkFrame } from "./walkFrame";

const DT = 1 / 60;
const YAWS = Array.from({ length: 16 }, (_, index) => (index / 16) * Math.PI * 2);

/** A box of free floor on a grid, for sampling where a player might stand. */
function freeSpots(boxes: readonly Aabb[], bounds: Aabb, step: number): { x: number; z: number }[] {
  const spots: { x: number; z: number }[] = [];
  for (let x = bounds.minX; x <= bounds.maxX; x += step) {
    for (let z = bounds.minZ; z <= bounds.maxZ; z += step) {
      if (!blocked(x, z, EXPLORER_RADIUS, boxes, bounds)) {
        spots.push({ x, z });
      }
    }
  }
  return spots;
}

const within = (box: Aabb, x: number, z: number, pad = 0): boolean =>
  x > box.minX - pad && x < box.maxX + pad && z > box.minZ - pad && z < box.maxZ + pad;

const eyeOf = (x: number, z: number, yaw: number, distance: number) => ({
  x: x + Math.sin(yaw) * distance,
  z: z + Math.cos(yaw) * distance,
});

describe("the camera inside a room", () => {
  for (const def of INTERIORS) {
    it(`${def.id}: the lens stays in the room, out of the walls and out of the furniture, from anywhere the player can stand`, () => {
      const volume = interiorCameraVolume(def);
      const walls = interiorBlocks(def).filter((block) => block.kind === "wall");
      const furniture = interiorBlocks(def).filter((block) => block.kind !== "wall");
      const spots = freeSpots(interiorBoxes(def), interiorBounds(def), 0.5).filter((spot) => within(def.room, spot.x, spot.z));
      // The lift cabin is a small room: two metres by two and a half.
      expect(spots.length).toBeGreaterThan(def.id === "palm-court-lift" ? 3 : 10);
      const faults: string[] = [];
      for (const spot of spots) {
        for (const yaw of YAWS) {
          const distance = cameraLimit(volume, spot.x, spot.z, yaw);
          const eye = eyeOf(spot.x, spot.z, yaw, distance);
          const where = `${def.id} at ${spot.x.toFixed(1)},${spot.z.toFixed(1)} yaw ${yaw.toFixed(2)}`;
          // Never outside the room's outer footprint, so no other building or street can be in frame.
          if (!within(def.room, eye.x, eye.z)) {
            faults.push(`${where}: outside the room`);
          }
          // Never in a wall (the doorway is the one gap).
          if (walls.some((wall) => within(wall, eye.x, eye.z))) {
            faults.push(`${where}: in a wall`);
          }
          // Never in a piece of furniture, except over a low free-standing one, below the lens.
          const view = cameraView({ yaw, distance }, { x: spot.x, z: spot.z, yaw });
          for (const piece of furniture) {
            if (within(piece, eye.x, eye.z) && !(BLOCK_TOP[piece.kind] <= CAMERA_OCCLUDER_TOP && BLOCK_TOP[piece.kind] < view.eye.y)) {
              faults.push(`${where}: in ${piece.kind}`);
            }
          }
        }
      }
      expect(faults.slice(0, 5)).toEqual([]);
    });
  }

  it("never lets a tall thing or a counter stand between the lens and the player", () => {
    for (const def of INTERIORS) {
      const volume = interiorCameraVolume(def);
      const blocks = interiorBlocks(def).filter((block) => block.kind !== "wall" && (BLOCK_TOP[block.kind] > CAMERA_OCCLUDER_TOP || block.kind === "counter"));
      const faults: string[] = [];
      for (const spot of freeSpots(interiorBoxes(def), interiorBounds(def), 1).filter((candidate) => within(def.room, candidate.x, candidate.z))) {
        for (const yaw of YAWS.filter((_, index) => index % 2 === 0)) {
          const distance = cameraLimit(volume, spot.x, spot.z, yaw);
          for (let along = 0; along <= distance; along += 0.1) {
            const point = eyeOf(spot.x, spot.z, yaw, along);
            // The player themself can be touching a block; the line only has to clear the rest.
            const hit = blocks.find((block) => within(block, point.x, point.z) && !within(block, spot.x, spot.z, EXPLORER_RADIUS + 0.05));
            if (hit) {
              faults.push(`${def.id} at ${spot.x.toFixed(1)},${spot.z.toFixed(1)} yaw ${yaw.toFixed(2)} ${along.toFixed(2)} m in ${hit.kind}`);
            }
          }
        }
      }
      expect(faults.slice(0, 5), def.id).toEqual([]);
    }
  });

  it("passes over a low table but not over a counter or a shelf", () => {
    const volume: CameraVolume = {
      regions: [{ minX: 0, maxX: 10, minZ: 0, maxZ: 10 }],
      solids: [
        { minX: 4, maxX: 5, minZ: 4, maxZ: 6, top: 0.9 },
        { minX: 7, maxX: 8, minZ: 4, maxZ: 6 },
      ],
    };
    // Yaw 0 faces -z, so the lens trails to +z of the player.
    expect(lensAllowed(volume, 4.5, 5)).toBe(true);
    expect(lensAllowed(volume, 7.5, 5)).toBe(false);
    expect(lensAllowed(volume, 4.5, 5, [{ minX: 4, maxX: 5, minZ: 4, maxZ: 6, top: 2 }])).toBe(false);
  });

  it("is already in the doorway pocket on the frame the player crosses the threshold, and eases out from there", () => {
    const entrance = WORLD_ENTRANCES.find((candidate) => candidate.state === "open") as (typeof WORLD_ENTRANCES)[number];
    const def = INTERIORS.find((candidate) => candidate.id === entrance.id) as InteriorDef;
    const inward = inwardOf(entrance.facing);
    const yaw = Math.atan2(-inward[0], -inward[1]);
    // The player is just over the threshold. The old (street) camera trailed 7 m out on the street.
    const pose = { x: entrance.door.x + inward[0] * 0.25, z: entrance.door.z + inward[1] * 0.25, yaw };
    const roomCamera = interiorCameraVolume(def);
    const arrived = stepCamera(startCamera(yaw, CAMERA_DISTANCE), pose, roomCamera, DT, true);
    const eye = eyeOf(pose.x, pose.z, arrived.yaw, arrived.distance);
    const u = (eye.x - entrance.door.x) * inward[0] + (eye.z - entrance.door.z) * inward[1];
    expect(u).toBeGreaterThanOrEqual(0);
    // And it grows as the player walks in, never jumping.
    let state = arrived;
    let last = state.distance;
    let at = pose;
    for (let frame = 0; frame < 120; frame += 1) {
      at = { ...at, x: at.x + inward[0] * 0.04, z: at.z + inward[1] * 0.04 };
      state = stepCamera(state, at, roomCamera, DT);
      expect(state.distance - last).toBeLessThan(0.5);
      last = state.distance;
    }
    expect(state.distance).toBeGreaterThan(arrived.distance);
  });
});

describe("the camera on the street", () => {
  const raw = BUILDINGS.map((building) => footprintBox(building));

  it("stays on the ground and out of every building, tower and bus, from anywhere the player can stand", () => {
    const others = collisionBoxes().slice(BUILDINGS.length);
    const spots = freeSpots(collisionBoxes(), PLAY_BOUNDS, 6);
    expect(spots.length).toBeGreaterThan(200);
    const faults: string[] = [];
    for (const spot of spots) {
      for (const yaw of YAWS) {
        const distance = cameraLimit(STREET_CAMERA, spot.x, spot.z, yaw);
        const eye = eyeOf(spot.x, spot.z, yaw, distance);
        const where = `${spot.x.toFixed(0)},${spot.z.toFixed(0)} yaw ${yaw.toFixed(2)}`;
        // A player at the edge of the ground has the lens at their own feet, so allow for rounding there.
        if (!within(PLAY_BOUNDS, eye.x, eye.z, 1e-6)) {
          faults.push(`${where}: off the ground`);
        }
        if (distance > 0 && [...raw, ...others].some((box) => within(box, eye.x, eye.z))) {
          faults.push(`${where}: in a building`);
        }
      }
    }
    expect(faults.slice(0, 5)).toEqual([]);
  });

  it("keeps clear of a market awning that stands a metre and more out from the wall", () => {
    const market = BUILDINGS.find((building) => building.id.startsWith("market-"));
    expect(market).toBeDefined();
    const base = footprintBox(market as (typeof BUILDINGS)[number]);
    // Stand well in front of the building's long face, looking along it, and with the back to it.
    const x = (base.minX + base.maxX) / 2;
    for (const z of [base.minZ - 3, base.maxZ + 3]) {
      const toward = z < base.minZ ? 0 : Math.PI;
      const distance = cameraLimit(STREET_CAMERA, x, z, toward);
      const eye = eyeOf(x, z, toward, distance);
      expect(within(base, eye.x, eye.z, 1.3)).toBe(false);
    }
  });
});

describe("switching between the street and a room", () => {
  const rooms = new Map(INTERIORS.map((def) => [def.id, { boxes: interiorBoxes(def), bounds: interiorBounds(def) }]));
  const volumes = new Map(INTERIORS.map((def) => [def.id, interiorCameraVolume(def)]));
  const street = collisionBoxes();
  const open = WORLD_ENTRANCES.filter((entrance) => entrance.state === "open");

  for (const entrance of open) {
    it(`${entrance.id}: on every frame of walking in and back out, the lens is in the space the player is in`, () => {
      const inward = inwardOf(entrance.facing);
      const yaw = Math.atan2(-inward[0], -inward[1]);
      const doors = createGlassDoors(new THREE.Group(), WORLD_ENTRANCES);
      let pose = { x: entrance.door.x - inward[0] * 7, z: entrance.door.z - inward[1] * 7, yaw, vx: 0, vz: 0 };
      let space: ShopSpace = STREET;
      let camera = startCamera(yaw, CAMERA_DISTANCE);
      const seen = new Set<ShopSpace>();
      const lastSpaces: ShopSpace[] = [];
      for (let frame = 0; frame < 60 * 9; frame += 1) {
        // Walk in for five seconds, turn, walk out.
        if (frame === 60 * 5) {
          pose = { ...pose, yaw: yaw + Math.PI };
        }
        const result = walkFrame({ pose, input: { forward: 1, strafe: 0 }, dt: DT, space, street, rooms, doors });
        const changed = result.space !== space;
        pose = result.pose as typeof pose;
        space = result.space;
        seen.add(space);
        lastSpaces.push(space);
        const volume = space === STREET ? STREET_CAMERA : (volumes.get(space) as CameraVolume);
        camera = stepCamera(camera, pose, volume, DT, changed);
        const eye = eyeOf(pose.x, pose.z, camera.yaw, camera.distance);
        // Either the lens is where the volume allows, or it is right at the player's head (a player standing in
        // a doorway notch has the camera at their own position, which is always theirs to be in).
        const solids = typeof volume.solids === "function" ? volume.solids(pose.x, pose.z) : undefined;
        const ok = camera.distance === 0 || lensAllowed(volume, eye.x, eye.z, solids);
        expect(ok, `${entrance.id} frame ${frame} in ${space}, distance ${camera.distance.toFixed(2)}`).toBe(true);
      }
      expect(seen.has(entrance.id) && seen.has(STREET)).toBe(true);
    });
  }

  it("eases a camera that has been pulled in back out, and shortens at once when something is in the way", () => {
    const wide: CameraVolume = { regions: [{ minX: -50, maxX: 50, minZ: -50, maxZ: 50 }], solids: [{ minX: -1, maxX: 1, minZ: 3, maxZ: 4 }] };
    const pose = { x: 0, z: 0, yaw: 0 };
    let state = startCamera(0, CAMERA_DISTANCE);
    // A wall 3 m behind the player: the camera is there on the same frame.
    state = stepCamera(state, pose, wide, DT);
    expect(state.distance).toBeLessThan(3);
    // Once clear, it grows, and gradually.
    const clear: CameraVolume = { ...wide, solids: [] };
    const first = stepCamera(state, pose, clear, DT);
    expect(first.distance).toBeGreaterThan(state.distance);
    expect(first.distance - state.distance).toBeLessThan(0.5);
  });

  it("lifts and leans a camera that had to come in close, so it does not stare at the player's head", () => {
    const pose = { x: 0, z: 0, yaw: 0 };
    const far = cameraView(startCamera(0, CAMERA_DISTANCE), pose);
    const near = cameraView(startCamera(0, 0.3), pose);
    expect(far.eye.y).toBeCloseTo(CAMERA_HEIGHT);
    expect(near.eye.y).toBeLessThan(far.eye.y);
    expect(near.target.z).toBeLessThan(far.target.z);
  });
});
