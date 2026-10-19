import { describe, expect, it } from "vitest";

import { BUILDINGS } from "../scenes/junction/junctionBuildings";
import { MARKET_POLE_X, MARKET_POLE_Z } from "../scenes/junction/junctionStructures";
import { collisionBoxes } from "./collision";
import { WORLD_ENTRANCES } from "./entranceWorld";
import { BUSINESSES } from "./businesses";
import { ENTER_PLANE } from "./doorway";
import { ENTRANCES, DOOR_REACH, entranceBayExists, entranceForBay, NOTCH_DEPTH } from "./entrances";
import { interactAction, interactTarget } from "./interaction";
import { INTERIORS, interiorById, STREET_INTERIORS } from "./interiorRegistry";
import { interiorBounds, interiorBoxes, nearExit, ROOM_HEIGHT, STREET, type ShopSpace } from "./interiors";
import { stepLocomotion } from "./locomotion";
import { blocked, EXPLORER_RADIUS, PLAY_BOUNDS, type Aabb } from "./movement";
import { SELLER_INTERIOR_ID } from "./shopkeeper";
import { walkFrame } from "./walkFrame";

const street = collisionBoxes();
const roomCollision = new Map(INTERIORS.map((def) => [def.id, { boxes: interiorBoxes(def), bounds: interiorBounds(def) }]));
const open = WORLD_ENTRANCES.filter((entrance) => entrance.state === "open");
const shut = WORLD_ENTRANCES.filter((entrance) => entrance.state !== "open");

function reachable(boxes: readonly Aabb[], bounds: Aabb, from: { x: number; z: number }, to: { x: number; z: number }): boolean {
  const step = 0.2;
  const key = (ix: number, iz: number) => `${ix},${iz}`;
  const start = [Math.round(from.x / step), Math.round(from.z / step)] as const;
  const goal = [Math.round(to.x / step), Math.round(to.z / step)] as const;
  const seen = new Set<string>([key(...start)]);
  const queue: (readonly [number, number])[] = [start];
  while (queue.length > 0) {
    const [ix, iz] = queue.shift() as readonly [number, number];
    if (ix === goal[0] && iz === goal[1]) {
      return true;
    }
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = ix + dx;
      const nz = iz + dz;
      const id = key(nx, nz);
      if (seen.has(id) || blocked(nx * step, nz * step, EXPLORER_RADIUS, boxes, bounds)) {
        continue;
      }
      seen.add(id);
      queue.push([nx, nz]);
    }
  }
  return false;
}

describe("entrance table", () => {
  it("names real buildings and real bays, one door per bay, with unique ids", () => {
    const ids = new Set<string>();
    for (const entrance of ENTRANCES) {
      expect(ids.has(entrance.id), entrance.id).toBe(false);
      ids.add(entrance.id);
      const building = BUILDINGS.find((entry) => entry.id === entrance.buildingId);
      expect(building, entrance.id).toBeDefined();
      expect(entranceBayExists(entrance, building as (typeof BUILDINGS)[number]), entrance.id).toBe(true);
      expect(entranceForBay(entrance.buildingId, entrance.facing, entrance.bay)?.id, entrance.id).toBe(entrance.id);
    }
  });

  it("opens exactly the businesses in the business table, and keeps every residential door locked", () => {
    expect(open.map((entrance) => entrance.id).sort()).toEqual(BUSINESSES.map((business) => business.id).sort());
    expect(open.map((entrance) => entrance.id)).toEqual(expect.arrayContaining(["mama-put", "cold-room"]));
    for (const entrance of ENTRANCES.filter((row) => row.type === "residential")) {
      expect(entrance.state, entrance.id).toBe("locked");
    }
    // One enterable door per building at most, except Palm Court, which has three businesses on its ground floor.
    const perBuilding = new Map<string, number>();
    for (const entrance of open) {
      perBuilding.set(entrance.buildingId, (perBuilding.get(entrance.buildingId) ?? 0) + 1);
    }
    for (const [buildingId, count] of perBuilding) {
      expect(count, buildingId).toBe(buildingId === "palm-court" ? 3 : 1);
    }
  });

  it("gives every closed or locked door a prompt that says why, and no interior", () => {
    for (const entrance of shut) {
      expect(entrance.prompts.blocked?.length ?? 0, entrance.id).toBeGreaterThan(8);
      expect(entrance.prompts.enter, entrance.id).toBeUndefined();
      expect(entrance.interiorId, entrance.id).toBeUndefined();
      expect(interiorById(entrance.id), entrance.id).toBeUndefined();
    }
  });
});

describe("every open entrance has a complete interior", () => {
  it("lists one interior per open door and none without a door", () => {
    // The rooms inside Palm Court are reached from other rooms, not from the street, so they have no entrance of their own.
    expect(STREET_INTERIORS.map((interior) => interior.id).sort()).toEqual(open.map((entrance) => entrance.id).sort());
    for (const entrance of open) {
      expect(entrance.interiorId).toBe(entrance.id);
      expect(entrance.prompts.enter && entrance.prompts.exit, entrance.id).toBeTruthy();
    }
  });

  for (const entrance of open) {
    describe(entrance.id, () => {
      const interior = interiorById(entrance.id);
      it("has an interior with walls, an entry spot and an exit", () => {
        expect(interior).toBeDefined();
        if (!interior) {
          return;
        }
        const boxes = interiorBoxes(interior);
        const bounds = interiorBounds(interior);
        expect(boxes.length).toBeGreaterThan(6);
        expect(ROOM_HEIGHT).toBeGreaterThan(3);
        expect(interior.furniture.length).toBeGreaterThan(0);
        // You arrive on free floor, and you do not arrive inside the exit prompt, or one press would bounce you out.
        expect(blocked(interior.insidePose.x, interior.insidePose.z, EXPLORER_RADIUS, boxes, bounds)).toBe(false);
        expect(nearExit(interior, interior.insidePose.x, interior.insidePose.z)).toBe(false);
        // The exit spot is free floor and the player can walk to it from the entry spot.
        expect(blocked(interior.exitAnchor.x, interior.exitAnchor.z, EXPLORER_RADIUS, boxes, bounds)).toBe(false);
        expect(nearExit(interior, interior.exitAnchor.x, interior.exitAnchor.z)).toBe(true);
        expect(reachable(boxes, bounds, interior.insidePose, interior.exitAnchor)).toBe(true);
      });

      it("keeps the player inside the walls", () => {
        if (!interior) {
          return;
        }
        // Walk hard in eight directions from the entry spot for 5 s, through the same frame step the game uses.
        // Every frame the player is either inside the room box, or (having left by the door) on free street.
        // They are never inside a wall, and never in a room they did not enter.
        for (let k = 0; k < 8; k += 1) {
          let pose = { ...interior.insidePose, yaw: (k * Math.PI) / 4 };
          let space: ShopSpace = entrance.id;
          for (let i = 0; i < 300; i += 1) {
            const step = walkFrame({ pose, input: { forward: 1, strafe: 0 }, dt: 1 / 60, space, street, rooms: roomCollision });
            pose = step.pose;
            space = step.space;
            if (space === STREET) {
              expect(blocked(pose.x, pose.z, EXPLORER_RADIUS - 0.01, street, PLAY_BOUNDS)).toBe(false);
            } else {
              expect(space).toBe(entrance.id);
              // A room with doorways to other rooms can be walked a little way out through them, never further.
              const slack = (interior.openings?.length ?? 0) > 0 ? 0.8 : 0;
              expect(pose.x).toBeGreaterThan(interior.room.minX - slack);
              expect(pose.x).toBeLessThan(interior.room.maxX + slack);
              expect(pose.z).toBeGreaterThan(interior.room.minZ - slack);
              expect(pose.z).toBeLessThan(interior.room.maxZ + slack);
            }
          }
        }
      });

      it("blocks the furniture", () => {
        if (!interior) {
          return;
        }
        const boxes = interiorBoxes(interior);
        const bounds = interiorBounds(interior);
        for (const piece of interior.furniture) {
          const cx = (piece.minX + piece.maxX) / 2;
          const cz = (piece.minZ + piece.maxZ) / 2;
          expect(blocked(cx, cz, EXPLORER_RADIUS, boxes, bounds)).toBe(true);
        }
      });

      it("keeps the whole building solid from the street apart from the doorway notch", () => {
        const building = BUILDINGS.find((entry) => entry.id === entrance.buildingId);
        expect(building).toBeDefined();
        const [nx, nz] = entrance.outward;
        const at = (u: number, s: number) => [entrance.door.x - nx * u - nz * s, entrance.door.z - nz * u + nx * s] as const;
        // The doorstep is free and the door can be reached all the way to the door plane and a little past it,
        // where the room takes over. Further in than the notch the street is solid: it is not a tunnel.
        expect(blocked(entrance.enterAnchor.x, entrance.enterAnchor.z, EXPLORER_RADIUS, street, PLAY_BOUNDS)).toBe(false);
        for (const u of [0, 0.3, ENTER_PLANE + 0.3]) {
          expect(blocked(...at(u, 0), EXPLORER_RADIUS, street, PLAY_BOUNDS), `u=${u}`).toBe(false);
        }
        expect(blocked(...at(NOTCH_DEPTH + 0.5, 0), EXPLORER_RADIUS, street, PLAY_BOUNDS)).toBe(true);
        // Beside the door the wall is solid, so the doorway is the only way in.
        expect(blocked(...at(0.5, entrance.half + 0.6), EXPLORER_RADIUS, street, PLAY_BOUNDS)).toBe(true);
        expect(blocked(...at(0.5, -(entrance.half + 0.6)), EXPLORER_RADIUS, street, PLAY_BOUNDS)).toBe(true);
        // The exit pose is outside on free street.
        expect(blocked(entrance.outsidePose.x, entrance.outsidePose.z, EXPLORER_RADIUS, street, PLAY_BOUNDS)).toBe(false);
      });
    });
  }

  it("offers an enter prompt at each open door and an exit prompt inside, and only the right seller", () => {
    for (const entrance of open) {
      const interior = interiorById(entrance.id);
      expect(interactTarget("street", entrance.outsidePose.x, entrance.outsidePose.z, false)).toEqual({
        kind: "door",
        action: "enter",
        entranceId: entrance.id,
      });
      if (interior) {
        expect(interactTarget(entrance.id, interior.exitAnchor.x, interior.exitAnchor.z, false)).toEqual({
          kind: "door",
          action: "exit",
          entranceId: entrance.id,
        });
      }
    }
    expect(SELLER_INTERIOR_ID).toBe("mama-put");
    const cold = interiorById("cold-room");
    expect(cold).toBeDefined();
    expect(interactTarget("cold-room", -70, -48.3, false)).toBeNull();
  });
});

describe("what stands in front of a door", () => {
  it("keeps every utility pole at least 3.5 m from every door and from the sign above it", () => {
    for (const x of MARKET_POLE_X) {
      for (const z of MARKET_POLE_Z) {
        for (const entrance of WORLD_ENTRANCES) {
          const distance = Math.hypot(entrance.door.x - x, entrance.door.z - z);
          expect(distance, `pole ${x},${z} near ${entrance.id}`).toBeGreaterThanOrEqual(3.5);
        }
      }
    }
  });
});

describe("closed and locked doors", () => {
  for (const entrance of shut) {
    it(`${entrance.id} shows why it does not open and cannot be walked into`, () => {
      const target = interactTarget("street", entrance.outsidePose.x, entrance.outsidePose.z, false);
      expect(target).toEqual({ kind: "shut", state: entrance.state, entranceId: entrance.id });
      expect(interactAction(true, false, target)).toBe("none");
      expect(Math.hypot(entrance.enterAnchor.x - entrance.outsidePose.x, entrance.enterAnchor.z - entrance.outsidePose.z)).toBeLessThan(DOOR_REACH);

      // Walk straight at the door for 4 s from the street. The player stops outside the face.
      let pose = { ...entrance.outsidePose };
      for (let i = 0; i < 240; i += 1) {
        pose = stepLocomotion(pose, { forward: 1, strafe: 0 }, 1 / 60, street, PLAY_BOUNDS);
      }
      const [nx, nz] = entrance.outward;
      const depthPastFace = -((pose.x - entrance.door.x) * nx + (pose.z - entrance.door.z) * nz);
      expect(depthPastFace, entrance.id).toBeLessThan(0);
    });
  }

  it("is not reachable by a door press from a dozen metres away", () => {
    for (const entrance of shut) {
      const far = { x: entrance.door.x + entrance.outward[0] * 12, z: entrance.door.z + entrance.outward[1] * 12 };
      expect(interactTarget("street", far.x, far.z, false)?.kind === "shut", entrance.id).toBe(false);
    }
  });
});
