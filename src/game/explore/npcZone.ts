import { blocked, type Aabb } from "./movement";

/**
 * Where a non-player character may be. A zone belongs to a room and is data, so a seller, a customer or a
 * cleaner is the same kind of thing with a different zone. This is a movement rule only: it has no goals,
 * schedule or intelligence. Whoever drives the character picks where it goes; the rules here decide
 * whether each step is allowed.
 *
 * A step is refused if it would leave the zone's areas, enter a wall or a piece of furniture, or press
 * into another person (the player, or anyone in `others`). The character slides along an obstacle the
 * same way the player does, so it never jams on a corner, and it never needs a path search because a
 * zone is small and convex enough to cross in a straight line.
 */

export type NpcRole = "seller" | "customer" | "visitor";

export type NpcStation = { x: number; z: number; yaw: number };

export type NpcZone = {
  id: string;
  /** The room (space id) this zone is in. */
  roomId: string;
  role: NpcRole;
  /** Where the character's centre may be. A union of rectangles; each already keeps clear of walls and furniture. */
  areas: readonly Aabb[];
  /** Places the character stands and turns to face from. The first is home. */
  stations: readonly NpcStation[];
  /** Body radius, metres. */
  radius: number;
  /** How far from a station's facing the character may turn to look at someone, in radians. */
  facingLimit: number;
};

export type NpcPose = { x: number; z: number; yaw: number };

export const NPC_WALK_SPEED = 0.55;
export const NPC_TURN_RATE = 3;

const EVERYWHERE: Aabb = { minX: -1e6, maxX: 1e6, minZ: -1e6, maxZ: 1e6 };

/** The square a character takes up, for collision against the player and others. */
export function npcBody(x: number, z: number, radius: number): Aabb {
  return { minX: x - radius, maxX: x + radius, minZ: z - radius, maxZ: z + radius };
}

export function inZone(zone: Pick<NpcZone, "areas">, x: number, z: number): boolean {
  return zone.areas.some((area) => x >= area.minX && x <= area.maxX && z >= area.minZ && z <= area.maxZ);
}

export type Obstacles = {
  /** Walls and furniture. */
  solids: readonly Aabb[];
  /** Other people, as circles. */
  people?: readonly { x: number; z: number; radius: number }[];
};

function allowed(zone: NpcZone, obstacles: Obstacles, from: NpcPose, x: number, z: number): boolean {
  if (!inZone(zone, x, z)) {
    return false;
  }
  if (blocked(x, z, zone.radius, obstacles.solids, EVERYWHERE)) {
    return false;
  }
  for (const person of obstacles.people ?? []) {
    const reach = zone.radius + person.radius;
    const now = Math.hypot(x - person.x, z - person.z);
    // Already touching is not a trap: a step that does not close the gap is fine.
    if (now < reach && now < Math.hypot(from.x - person.x, from.z - person.z)) {
      return false;
    }
  }
  return true;
}

const wrap = (angle: number): number => Math.atan2(Math.sin(angle), Math.cos(angle));

const yawToward = (fromX: number, fromZ: number, toX: number, toZ: number): number => Math.atan2(-(toX - fromX), -(toZ - fromZ));

function turn(yaw: number, target: number, dt: number): number {
  const difference = wrap(target - yaw);
  const most = NPC_TURN_RATE * dt;
  return yaw + Math.max(-most, Math.min(most, difference));
}

export type NpcStep = { pose: NpcPose; moving: boolean };

/**
 * One frame for one character. `goal` is where it is walking to (null to stand), `look` is somebody it
 * should face when standing (the player, during a conversation), and `home` is the facing it returns to.
 */
export function stepNpc(
  zone: NpcZone,
  pose: NpcPose,
  goal: { x: number; z: number } | null,
  look: { x: number; z: number } | null,
  home: number,
  obstacles: Obstacles,
  dt: number,
): NpcStep {
  const step = Math.min(Math.max(dt, 0), 0.05);
  let { x, z } = pose;
  let moving = false;
  let heading: number | null = null;
  if (goal) {
    const dx = goal.x - x;
    const dz = goal.z - z;
    const distance = Math.hypot(dx, dz);
    if (distance > 0.02) {
      const travel = Math.min(distance, NPC_WALK_SPEED * step);
      const mx = (dx / distance) * travel;
      const mz = (dz / distance) * travel;
      let nx = x;
      let nz = z;
      if (allowed(zone, obstacles, pose, x + mx, z)) {
        nx = x + mx;
      }
      if (allowed(zone, obstacles, pose, nx, z + mz)) {
        nz = z + mz;
      }
      moving = Math.hypot(nx - x, nz - z) > 1e-4;
      if (moving) {
        heading = yawToward(x, z, nx, nz);
      }
      x = nx;
      z = nz;
    }
  }
  let target: number;
  if (heading !== null) {
    target = heading;
  } else if (look) {
    // Face the person, but only so far: she turns her head and shoulders toward them, not her back to the counter.
    const wanted = yawToward(x, z, look.x, look.z);
    target = home + Math.max(-zone.facingLimit, Math.min(zone.facingLimit, wrap(wanted - home)));
  } else {
    target = home;
  }
  return { pose: { x, z, yaw: turn(pose.yaw, target, step) }, moving };
}

/**
 * A slow round of the zone's stations: stand, wait, walk to the next. Time is the only input, so the same
 * frames give the same walk. It stands still while `hold` is true (a conversation).
 */
export type Patrol = { index: number; wait: number };

export const PATROL_ORDER = [0, 1, 0, 2] as const;
export const PATROL_WAIT = 7;

export function startPatrol(): Patrol {
  return { index: 0, wait: PATROL_WAIT };
}

export function stationOf(zone: NpcZone, patrol: Patrol): NpcStation {
  const order = PATROL_ORDER[patrol.index % PATROL_ORDER.length] ?? 0;
  return zone.stations[order % zone.stations.length] ?? (zone.stations[0] as NpcStation);
}

/** Advances the patrol and says where to walk now. Arrival starts the wait; the wait ending picks the next station. */
export function stepPatrol(zone: NpcZone, patrol: Patrol, pose: NpcPose, dt: number, hold: boolean): { patrol: Patrol; goal: NpcStation | null } {
  const station = stationOf(zone, patrol);
  if (hold) {
    return { patrol, goal: null };
  }
  const arrived = Math.hypot(station.x - pose.x, station.z - pose.z) <= 0.05;
  if (!arrived) {
    return { patrol, goal: station };
  }
  const wait = patrol.wait - Math.min(Math.max(dt, 0), 0.05);
  if (wait > 0) {
    return { patrol: { ...patrol, wait }, goal: null };
  }
  const next = { index: (patrol.index + 1) % PATROL_ORDER.length, wait: PATROL_WAIT };
  return { patrol: next, goal: stationOf(zone, next) };
}
