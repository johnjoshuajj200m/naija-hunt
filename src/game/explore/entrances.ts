import { bayWorldPoint, FACING, frontageLength, bayCountOf, type Facing, type Footprint } from "../scenes/junction/frontage";
import { BUSINESSES, type BusinessDef, type DoorKind } from "./businesses";
import type { Aabb, ExplorerPose } from "./movement";

/**
 * The entrance table. One row per building door the district has, whether or not it opens.
 *
 * A row says what the door is (building, kind of business, which bay of which frontage) and what it
 * does (open, closed for now, or locked). The facade generator draws the door from it, the collision
 * list cuts the doorway from it, and the interaction code reads the prompt from it. Nothing else decides
 * whether a door can be used.
 *
 * A door is only "open" if it also has an interior (see interiorRegistry.ts) with walls, furniture
 * collision, an exit and a hidden-district switch. Cutting a hole in a wall is not enough, and the
 * tests in entrances.test.ts fail if an open row has no complete interior behind it. Every open row is
 * made from a business (businesses.ts), so a door and the room behind it cannot drift apart.
 */

export type EntranceState = "open" | "closed" | "locked";
export type BuildingType = "shop" | "workshop" | "residential";

export type EntranceDef = {
  /** Also the id of the interior when the door is open. */
  id: string;
  buildingId: string;
  type: BuildingType;
  /** The name shown in prompts. */
  name: string;
  facing: Facing;
  /** Which bay of the frontage holds the door. */
  bay: number;
  state: EntranceState;
  /** Required when the state is "open". */
  interiorId?: string;
  /** How an open door works: it slides open by itself, or it is a doorway with a leaf hooked back. */
  doorKind?: DoorKind;
  prompts: {
    enter?: string;
    exit?: string;
    /** Shown beside a door that does not open. */
    blocked?: string;
  };
};

/** Ground floor wall thickness, the doorway and the reach of a door prompt, in metres. */
export const WALL = 0.4;
/**
 * Half the clear width of a door that opens. The player is 0.8 m across, so a 2 m opening leaves 0.6 m
 * either side of the middle to line up with (a 1.7 m one left only 0.45, which is fiddly on a thumb stick).
 */
export const DOOR_HALF_OPEN = 1.0;
export const DOOR_HALF_SHUT = 0.65;
export const DOOR_HEAD = 2.6;
export const DOOR_HEAD_SHUT = 2.25;
export const DOOR_REACH = 3.2;
/** The player stands this far out from the face after leaving, so the prompt can show again. */
export const OUTSIDE_DISTANCE = 1.8;
/** The enter prompt is measured from a point this far out from the face. */
export const ENTER_ANCHOR_DISTANCE = 0.5;

const closedShop = (id: string, buildingId: string, name: string, facing: Facing, bay: number, type: BuildingType = "shop"): EntranceDef => ({
  id,
  buildingId,
  type,
  name,
  facing,
  bay,
  state: "closed",
  prompts: { blocked: `${name} is closed for now. Come back later.` },
});

const lockedHome = (id: string, buildingId: string, facing: Facing, bay: number): EntranceDef => ({
  id,
  buildingId,
  type: "residential",
  name: "Private home",
  facing,
  bay,
  state: "locked",
  prompts: { blocked: "Locked. Someone lives here." },
});

/** An open door, made from the business behind it. */
function openShop(business: BusinessDef): EntranceDef {
  const how = business.doorKind === "sliding-glass" ? "Step up to the glass doors" : "Walk in through the door";
  return {
    id: business.id,
    buildingId: business.buildingId,
    type: business.kind,
    name: business.name,
    facing: business.facing,
    bay: business.bay,
    state: "open",
    interiorId: business.id,
    doorKind: business.doorKind,
    prompts: {
      enter: `${business.name} is open. ${how}, or press E.`,
      exit: "Walk out through the door, or press E.",
    },
  };
}

export const ENTRANCES: readonly EntranceDef[] = [
  ...BUSINESSES.map(openShop),
  // Shops that look the part but have no interior yet. Closed, not locked: the roller shutter is down.
  closedShop("ade-and-sons-door", "ade-and-sons", "Ade & Sons", "+x", 2),
  closedShop("glory-fabrics-door", "glory-fabrics", "Glory Fabrics", "+z", 1),
  closedShop("zion-tyres-door", "zion-tyres", "Zion Tyres", "+z", 2, "workshop"),
  closedShop("left-lean-to-door", "left-lean-to", "Welding Works", "+x", 0, "workshop"),
  closedShop("right-lean-to-door", "right-lean-to", "Carpentry", "-x", 1, "workshop"),
  // Homes stay locked. There is no residential interior in this build.
  lockedHome("market-home-door", "market-east-far", "-x", 3),
  lockedHome("left-far-door", "left-far", "+x", 2),
  lockedHome("right-far-door", "right-far", "-x", 3),
  lockedHome("cross-far-left-door", "cross-far-left", "+z", 4),
  lockedHome("cross-far-right-door", "cross-far-right", "+z", 5),
  lockedHome("south-row-door", "south-road-row", "+z", 10),
];

export function entranceById(id: string): EntranceDef | undefined {
  return ENTRANCES.find((entrance) => entrance.id === id);
}

/** The door on a given bay of a given frontage, if there is one. */
export function entranceForBay(buildingId: string, facing: Facing, bay: number): EntranceDef | undefined {
  return ENTRANCES.find((entrance) => entrance.buildingId === buildingId && entrance.facing === facing && entrance.bay === bay);
}

export function entrancesOnFrontage(buildingId: string, facing: Facing): EntranceDef[] {
  return ENTRANCES.filter((entrance) => entrance.buildingId === buildingId && entrance.facing === facing);
}

export function enterableEntranceOf(buildingId: string): EntranceDef | undefined {
  return ENTRANCES.find((entrance) => entrance.buildingId === buildingId && entrance.state === "open");
}

export function doorHalf(state: EntranceState): number {
  return state === "open" ? DOOR_HALF_OPEN : DOOR_HALF_SHUT;
}

/** An entrance placed in the world. */
export type ResolvedEntrance = EntranceDef & {
  /** Centre of the opening on the face plane. */
  door: { x: number; z: number };
  /** Unit vector pointing away from the building. */
  outward: [number, number];
  /** The point the enter prompt is measured from, just outside the door. */
  enterAnchor: { x: number; z: number };
  /** Where the player stands after leaving, facing the building. */
  outsidePose: ExplorerPose;
  half: number;
};

export function resolveEntrance(def: EntranceDef, building: Footprint): ResolvedEntrance {
  const door = bayWorldPoint(building, def.facing, def.bay);
  const outward = FACING[def.facing].normal;
  return {
    ...def,
    door,
    outward,
    enterAnchor: {
      x: door.x + outward[0] * ENTER_ANCHOR_DISTANCE,
      z: door.z + outward[1] * ENTER_ANCHOR_DISTANCE,
    },
    outsidePose: {
      x: door.x + outward[0] * OUTSIDE_DISTANCE,
      z: door.z + outward[1] * OUTSIDE_DISTANCE,
      yaw: Math.atan2(outward[0], outward[1]),
    },
    half: doorHalf(def.state),
  };
}

/** Resolves every row against the building list. A row whose building does not exist is a data error. */
export function resolveEntrances(buildings: readonly (Footprint & { id: string })[]): ResolvedEntrance[] {
  return ENTRANCES.map((def) => {
    const building = buildings.find((entry) => entry.id === def.buildingId);
    if (!building) {
      throw new Error(`Entrance "${def.id}" names a building that does not exist: ${def.buildingId}.`);
    }
    return resolveEntrance(def, building);
  });
}

/** True when the row's bay exists on its frontage. */
export function entranceBayExists(def: EntranceDef, building: Footprint): boolean {
  return def.bay >= 0 && def.bay < bayCountOf(frontageLength(building, def.facing));
}

/**
 * An axis-aligned box placed relative to a building face. u runs inward from the face plane (negative
 * is outside), v is the world coordinate along the face. The same four lines serve all four facings.
 */
export function placeOnFace(rect: Aabb, facing: Facing, u0: number, u1: number, v0: number, v1: number): Aabb {
  const [lo, hi] = u0 <= u1 ? [u0, u1] : [u1, u0];
  const [vLo, vHi] = v0 <= v1 ? [v0, v1] : [v1, v0];
  switch (facing) {
    case "-x":
      return { minX: rect.minX + lo, maxX: rect.minX + hi, minZ: vLo, maxZ: vHi };
    case "+x":
      return { minX: rect.maxX - hi, maxX: rect.maxX - lo, minZ: vLo, maxZ: vHi };
    case "-z":
      return { minX: vLo, maxX: vHi, minZ: rect.minZ + lo, maxZ: rect.minZ + hi };
    case "+z":
      return { minX: vLo, maxX: vHi, minZ: rect.maxZ - hi, maxZ: rect.maxZ - lo };
  }
}

/** The extent of a rectangle along its door wall (z for x-facing walls, x for z-facing walls). */
export function alongRange(rect: Aabb, facing: Facing): [number, number] {
  return facing === "-x" || facing === "+x" ? [rect.minZ, rect.maxZ] : [rect.minX, rect.maxX];
}

/** The extent of a rectangle perpendicular to its door wall. */
export function depthOf(rect: Aabb, facing: Facing): number {
  return facing === "-x" || facing === "+x" ? rect.maxX - rect.minX : rect.maxZ - rect.minZ;
}

/** The world coordinate along the door wall of a point. */
export function alongOf(point: { x: number; z: number }, facing: Facing): number {
  return facing === "-x" || facing === "+x" ? point.z : point.x;
}

export function footprintBox(building: Footprint): Aabb {
  return {
    minX: Math.min(building.x0, building.x1),
    maxX: Math.max(building.x0, building.x1),
    minZ: Math.min(building.z0, building.z1),
    maxZ: Math.max(building.z0, building.z1),
  };
}

/**
 * How far the street's doorway notch runs past the face. It covers the wall and then enough floor for the
 * player to step fully through the door line before the room takes over (doorway.ts). Past it the street
 * collision is solid again, so the notch is only ever the way into the room, never a path through the building.
 */
export const NOTCH_DEPTH = WALL + 0.9;

/**
 * Street collision for a building that has an open door: the whole footprint except the doorway notch.
 * The room behind the door is a separate space entered by walking through the notch, and nothing else
 * about the building can be walked through.
 */
export function doorwaysCollision(building: Footprint, entrances: readonly ResolvedEntrance[]): Aabb[] {
  const [first] = entrances;
  if (!first) {
    return [footprintBox(building)];
  }
  if (entrances.length === 1) {
    return doorwayCollision(building, first);
  }
  // Several doors in one frontage (Palm Court): the footprint is solid between and behind the notches.
  const box = footprintBox(building);
  const facing = first.facing;
  const depth = depthOf(box, facing);
  const [v0, v1] = alongRange(box, facing);
  const doors = entrances
    .filter((entrance) => entrance.facing === facing)
    .map((entrance) => ({ along: alongOf(entrance.door, facing), half: entrance.half }))
    .sort((a, b) => a.along - b.along);
  const out: Aabb[] = [];
  let at = v0;
  for (const door of doors) {
    out.push(placeOnFace(box, facing, 0, depth, at, door.along - door.half));
    out.push(placeOnFace(box, facing, NOTCH_DEPTH, depth, door.along - door.half, door.along + door.half));
    at = door.along + door.half;
  }
  out.push(placeOnFace(box, facing, 0, depth, at, v1));
  return out;
}

export function doorwayCollision(building: Footprint, entrance: ResolvedEntrance): Aabb[] {
  const box = footprintBox(building);
  const depth = depthOf(box, entrance.facing);
  const along = alongOf(entrance.door, entrance.facing);
  const [v0, v1] = alongRange(box, entrance.facing);
  return [
    placeOnFace(box, entrance.facing, 0, depth, v0, along - entrance.half),
    placeOnFace(box, entrance.facing, 0, depth, along + entrance.half, v1),
    placeOnFace(box, entrance.facing, NOTCH_DEPTH, depth, along - entrance.half, along + entrance.half),
  ];
}
