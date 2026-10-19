import { describe, expect, it } from "vitest";

import { interiorById } from "./interiorRegistry";
import { interiorBoxes, interiorBounds, STREET } from "./interiors";
import { blocked, EXPLORER_RADIUS, TREASURE, type Aabb } from "./movement";
import {
  inZone,
  NPC_WALK_SPEED,
  PATROL_ORDER,
  PATROL_WAIT,
  startPatrol,
  stationOf,
  stepNpc,
  stepPatrol,
  type NpcPose,
  type NpcZone,
} from "./npcZone";
import { startSeller, stepSeller, type SellerState } from "./sellerBehaviour";
import { inSellerReach, SELLER, SELLER_REACH, SELLER_ZONE, sellerBody } from "./shopkeeper";
import { interactTarget } from "./interaction";
import { atRest } from "./locomotion";
import { walk } from "./testKit";

const DT = 1 / 60;
const EVERYWHERE: Aabb = { minX: -1e6, maxX: 1e6, minZ: -1e6, maxZ: 1e6 };
const wrap = (angle: number): number => Math.atan2(Math.sin(angle), Math.cos(angle));
const yawToward = (fromX: number, fromZ: number, toX: number, toZ: number): number => Math.atan2(-(toX - fromX), -(toZ - fromZ));

const room = interiorById("mama-put");
if (!room) {
  throw new Error("Mama Put is missing");
}
const solids = interiorBoxes(room);
/** The serving counter: the long one that runs across the room between the customers and the kitchen. */
const serving = room.furniture
  .filter((block) => block.kind === "counter")
  .reduce((best, block) => (block.maxZ - block.minZ > best.maxZ - best.minZ ? block : best));

function simulate(seconds: number, player: { x: number; z: number }, talking = false, from: SellerState = startSeller()): SellerState[] {
  const frames: SellerState[] = [];
  let state = from;
  for (let frame = 0; frame < Math.round(seconds / DT); frame += 1) {
    state = stepSeller(state, { dt: DT, talking, player });
    frames.push(state);
  }
  return frames;
}

describe("a movement zone", () => {
  const box: Aabb = { minX: 0, maxX: 4, minZ: 0, maxZ: 2 };
  const zone: NpcZone = {
    id: "test",
    roomId: "r",
    role: "customer",
    areas: [box],
    stations: [{ x: 1, z: 1, yaw: 0 }],
    radius: 0.3,
    facingLimit: 1,
  };
  const pose: NpcPose = { x: 3.5, z: 1, yaw: 0 };

  it("walks toward a goal at walking pace and no faster", () => {
    let current = pose;
    for (let frame = 0; frame < 60; frame += 1) {
      current = stepNpc(zone, current, { x: 1, z: 1 }, null, 0, { solids: [] }, DT).pose;
    }
    expect(pose.x - current.x).toBeCloseTo(NPC_WALK_SPEED, 1);
  });

  it("stops at the edge of the zone, even when the goal is beyond it", () => {
    let current = pose;
    for (let frame = 0; frame < 60 * 20; frame += 1) {
      current = stepNpc(zone, current, { x: 9, z: 1 }, null, 0, { solids: [] }, DT).pose;
      expect(inZone(zone, current.x, current.z)).toBe(true);
    }
    expect(current.x).toBeLessThanOrEqual(box.maxX);
  });

  it("will not walk into furniture or a wall, and slides along it", () => {
    const table: Aabb = { minX: 2, maxX: 2.6, minZ: 0.4, maxZ: 1.6 };
    let current: NpcPose = { x: 3.5, z: 1.7, yaw: 0 };
    for (let frame = 0; frame < 60 * 20; frame += 1) {
      current = stepNpc(zone, current, { x: 1, z: 1 }, null, 0, { solids: [table] }, DT).pose;
      expect(blocked(current.x, current.z, zone.radius, [table], EVERYWHERE)).toBe(false);
    }
    // It came up to the table's face, slid along it to the goal's height, and did not go through. (It does
    // not look for a way round: a zone is small, and whoever drives the character picks reachable goals.)
    expect(current.x).toBeGreaterThanOrEqual(table.maxX + zone.radius - 1e-6);
    expect(current.z).toBeCloseTo(1, 1);
  });

  it("will not walk into a person, and is not trapped by one who walks into it", () => {
    const person = { x: 2, z: 1, radius: EXPLORER_RADIUS };
    let current = pose;
    let closest = Infinity;
    for (let frame = 0; frame < 60 * 10; frame += 1) {
      current = stepNpc(zone, current, { x: 1, z: 1 }, null, 0, { solids: [], people: [person] }, DT).pose;
      closest = Math.min(closest, Math.hypot(current.x - person.x, current.z - person.z));
    }
    expect(closest).toBeGreaterThanOrEqual(zone.radius + person.radius - 0.02);
    // A person already overlapping it: it may step away, so it is never frozen there.
    const overlapped = stepNpc(zone, { x: 2.3, z: 1, yaw: 0 }, { x: 3.5, z: 1 }, null, 0, { solids: [], people: [person] }, DT);
    expect(overlapped.moving).toBe(true);
  });

  it("faces someone it is talking to, but only as far as the zone allows", () => {
    // A person directly behind it, 180 degrees from home: it turns toward them as far as the limit and no further.
    let current: NpcPose = { x: 2, z: 1, yaw: 0 };
    for (let frame = 0; frame < 60 * 5; frame += 1) {
      current = stepNpc(zone, current, null, { x: 2, z: 9 }, 0, { solids: [] }, DT).pose;
    }
    expect(Math.abs(wrap(current.yaw))).toBeLessThanOrEqual(zone.facingLimit + 1e-6);
    expect(Math.abs(wrap(current.yaw))).toBeGreaterThan(zone.facingLimit - 0.05);
  });

  it("turns at a steady rate and does not snap", () => {
    const next = stepNpc(zone, { x: 2, z: 1, yaw: 0 }, null, { x: 0, z: 1 }, 0, { solids: [] }, DT).pose;
    expect(Math.abs(next.yaw)).toBeGreaterThan(0);
    expect(Math.abs(next.yaw)).toBeLessThan(0.1);
  });

  it("round-robins its stations by time alone, and holds still while told to", () => {
    let patrol = startPatrol();
    const at = { x: stationOf(zone, patrol).x, z: stationOf(zone, patrol).z, yaw: 0 };
    // Waiting at the first station: no goal until the wait runs out.
    for (let frame = 0; frame < 60 * (PATROL_WAIT - 1); frame += 1) {
      const next = stepPatrol(zone, patrol, at, DT, false);
      expect(next.goal).toBeNull();
      patrol = next.patrol;
    }
    expect(patrol.index).toBe(0);
    // Held, the wait does not run out.
    for (let frame = 0; frame < 60 * 30; frame += 1) {
      patrol = stepPatrol(zone, patrol, at, DT, true).patrol;
    }
    expect(patrol.index).toBe(0);
    expect(PATROL_ORDER.length).toBeGreaterThan(1);
  });
});

describe("the Mama Put seller's zone", () => {
  it("is a seller zone in her own room, behind the serving counter, with walls and furniture clear of every part of it", () => {
    expect(SELLER_ZONE.role).toBe("seller");
    expect(SELLER_ZONE.roomId).toBe(room.id);
    for (const area of SELLER_ZONE.areas) {
      // Every corner, and the middle of every edge, of the area is somewhere her body fits.
      const xs = [area.minX, (area.minX + area.maxX) / 2, area.maxX];
      const zs = [area.minZ, (area.minZ + area.maxZ) / 2, area.maxZ];
      for (const x of xs) {
        for (const z of zs) {
          expect(blocked(x, z, SELLER_ZONE.radius, solids, EVERYWHERE), `${x.toFixed(2)},${z.toFixed(2)}`).toBe(false);
          // Behind the counter: on the kitchen side of its far face.
          expect(x - SELLER_ZONE.radius).toBeGreaterThanOrEqual(serving.maxX - 1e-6);
        }
      }
    }
    for (const station of SELLER_ZONE.stations) {
      expect(inZone(SELLER_ZONE, station.x, station.z)).toBe(true);
    }
  });

  it("is a different zone from the player's side: the player's bounds are not hers and the counter separates them", () => {
    const customerSide = { x: serving.minX - 1, z: 0 };
    expect(inZone(SELLER_ZONE, customerSide.x, customerSide.z)).toBe(false);
    expect(interiorBounds(room).minX).toBeLessThan(serving.minX);
  });
});

describe("the seller over time", () => {
  const player = { x: serving.minX - 0.8, z: (serving.minZ + serving.maxZ) / 2 };

  it("starts at her mark, behind the counter, facing the customers", () => {
    const state = startSeller();
    expect(state.pose).toMatchObject({ x: SELLER.x, z: SELLER.z, yaw: SELLER.yaw });
    expect(state.pose.x).toBeGreaterThan(serving.maxX);
  });

  it("stays in her zone, off the furniture and behind the counter for two minutes, and visits every station", () => {
    const frames = simulate(120, player);
    const reached = new Set<number>();
    let travelled = 0;
    let last = frames[0] as SellerState;
    for (const state of frames) {
      const { x, z } = state.pose;
      expect(inZone(SELLER_ZONE, x, z), `in zone at ${x.toFixed(2)},${z.toFixed(2)}`).toBe(true);
      expect(blocked(x, z, SELLER_ZONE.radius - 0.001, solids, EVERYWHERE), "off the furniture").toBe(false);
      expect(x - SELLER_ZONE.radius).toBeGreaterThanOrEqual(serving.maxX - 1e-6);
      expect(Math.hypot(x - player.x, z - player.z)).toBeGreaterThan(SELLER_ZONE.radius + EXPLORER_RADIUS);
      travelled += Math.hypot(x - last.pose.x, z - last.pose.z);
      last = state;
      SELLER_ZONE.stations.forEach((station, index) => {
        if (Math.hypot(station.x - x, station.z - z) < 0.06) {
          reached.add(index);
        }
      });
    }
    expect([...reached].sort()).toEqual(SELLER_ZONE.stations.map((_, index) => index));
    // She actually moves, and slowly: this is a shuffle along the counter, not a patrol of the room.
    expect(travelled).toBeGreaterThan(2);
    expect(travelled).toBeLessThan(NPC_WALK_SPEED * 120);
  });

  it("does not walk into a player who is standing in her way, and keeps going once they leave", () => {
    // The player is (somehow) in the kitchen, on her walk between the first two stations.
    const first = SELLER_ZONE.stations[0] as { x: number; z: number };
    const second = SELLER_ZONE.stations[1] as { x: number; z: number };
    const inWay = { x: first.x, z: (first.z + second.z) / 2 };
    let minimum = Infinity;
    for (const state of simulate(60, inWay)) {
      minimum = Math.min(minimum, Math.hypot(state.pose.x - inWay.x, state.pose.z - inWay.z));
    }
    expect(minimum).toBeGreaterThanOrEqual(SELLER_ZONE.radius + EXPLORER_RADIUS - 0.03);
    const frames = simulate(60, { x: serving.minX - 2, z: 0 });
    expect(frames.some((state) => state.moving)).toBe(true);
  });

  it("stops where she is in a conversation, faces the player as far as her zone lets her, and carries on afterwards", () => {
    // Let her start walking, then talk to her.
    const walking = simulate(PATROL_WAIT + 1, player);
    const midWalk = walking[walking.length - 1] as SellerState;
    const talking = simulate(4, player, true, midWalk);
    const settled = talking[talking.length - 1] as SellerState;
    // She does not move at all while she is being spoken to.
    for (const state of talking) {
      expect(state.pose.x).toBeCloseTo(midWalk.pose.x, 6);
      expect(state.pose.z).toBeCloseTo(midWalk.pose.z, 6);
      expect(state.moving).toBe(false);
    }
    // She looks at the player, within the zone's limit of her station's facing.
    const home = stationOf(SELLER_ZONE, settled.patrol).yaw;
    const wanted = yawToward(settled.pose.x, settled.pose.z, player.x, player.z);
    const allowed = home + Math.max(-SELLER_ZONE.facingLimit, Math.min(SELLER_ZONE.facingLimit, wrap(wanted - home)));
    expect(Math.abs(wrap(settled.pose.yaw - allowed))).toBeLessThan(0.05);
    expect(Math.abs(wrap(settled.pose.yaw - home))).toBeLessThanOrEqual(SELLER_ZONE.facingLimit + 1e-6);
    // Afterwards the patrol picks up where it was.
    const after = simulate(30, player, false, settled);
    expect(after.some((state) => state.moving)).toBe(true);
  });

  it("is reachable wherever she is: the reach follows her, not her mark", () => {
    const far = SELLER_ZONE.stations[2] as { x: number; z: number };
    const nearFar = { x: far.x - SELLER_REACH + 0.2, z: far.z };
    expect(inSellerReach(nearFar.x, nearFar.z, far)).toBe(true);
    expect(inSellerReach(nearFar.x, nearFar.z, { x: far.x + 4, z: far.z })).toBe(false);
    expect(inSellerReach(SELLER.x, SELLER.z)).toBe(true);
  });

  it("cannot be walked through by the player: her body is in the way wherever she stands", () => {
    // The player, standing where she is (in the kitchen, were they able to get there), is pushed out by her body.
    const kitchen = { x: SELLER.x - 1.4, z: SELLER.z };
    // Yaw -90 degrees faces +x, toward her.
    const end = walk(atRest({ ...kitchen, yaw: -Math.PI / 2 }), { forward: 1, strafe: 0 }, 2, [sellerBody(SELLER.x, SELLER.z)], EVERYWHERE);
    expect(end.x).toBeLessThanOrEqual(SELLER.x - SELLER_ZONE.radius - EXPLORER_RADIUS + 1e-6);
    expect(end.x).toBeGreaterThan(kitchen.x);
  });
});

describe("the seller's dialogue and the clue still work", () => {
  it("lets the player talk to her from her side of the counter, wherever she stands", () => {
    for (const station of SELLER_ZONE.stations) {
      const standing = { x: serving.minX - 0.5, z: station.z };
      const target = interactTarget(room.id, standing.x, standing.z, false, station);
      expect(target?.kind, `at station z=${station.z}`).toBe("seller");
    }
  });

  it("does not offer a conversation to a player who is out of her reach, and then offers the exit", () => {
    const target = interactTarget(room.id, SELLER.x - SELLER_REACH - 2, SELLER.z, false, SELLER);
    expect(target?.kind).not.toBe("seller");
  });

  it("still offers the street clue to a player standing on it, and never the seller", () => {
    const target = interactTarget(STREET, TREASURE.x, TREASURE.z, true);
    expect(target?.kind).toBe("clue");
    expect(interactTarget(STREET, SELLER.x, SELLER.z, false, SELLER)?.kind).not.toBe("seller");
  });
});