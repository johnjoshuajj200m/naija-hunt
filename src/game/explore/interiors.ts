import type { Facing } from "../scenes/junction/frontage";
import { FACING } from "../scenes/junction/frontage";
import type { DoorKind } from "./businesses";
import { alongRange, depthOf, DOOR_HALF_OPEN, placeOnFace, WALL } from "./entrances";
import type { CameraVolume } from "./cameraRig";
import type { Aabb, ExplorerPose } from "./movement";
import type { NpcZone } from "./npcZone";
import { STREET_SPACE } from "./spaces";

/**
 * A walk-in room. Data only: interiorBuilder.ts draws it, and the helpers here derive its collision,
 * its camera guard and its visibility. A room is world-placed inside the building it belongs to, so two
 * rooms never overlap, and only the active one (plus the ones you can see through a doorway) is drawn.
 */

/** The same height as the ground storey of the street buildings, so the room fills the shell exactly. */
export const ROOM_HEIGHT = 4;
/** Thickness of the plaster layer the room draws on the inside face of its walls. */
export const SKIN = 0.06;

export type BlockKind =
  | "wall"
  | "counter"
  | "shelf"
  | "fridge"
  | "freezer"
  | "table"
  | "rack"
  | "stack"
  | "stove"
  | "oven"
  | "display"
  /** A full-height pier (the spine between two flights of a stair). Solid from floor to ceiling. */
  | "column";

/** What a prop is dressed with. Pure data: interiorProps.ts decides how each look is drawn. */
export type PropLook = {
  body?: string;
  accent?: string;
  /** Colours of the goods on a shelf, in a cooler or on a rack. */
  stock?: readonly string[];
  /** What stands on top of a counter or a table. */
  items?: "food" | "bread" | "cloth" | "parts" | "tools" | "skewers";
  /** What a stack is made of. */
  shape?: "tyres" | "crates" | "sacks";
};

export type InteriorBlock = Aabb & {
  kind: BlockKind;
  /** World direction (a unit axis) the front of the prop faces. Walls have none. */
  front?: readonly [number, number];
  look?: PropLook;
};

/** A named point inside a room for something the game does not do yet: a clue, a sale, a conversation. */
export type RoomSpot = { id: string; kind: "interaction" | "clue" | "stock"; x: number; z: number };

/** A gap in one of a room's walls that leads to another room (not the street). World coordinates. */
export type Opening = {
  /** Which wall of this room the gap is in: the direction pointing out of the room through it. */
  facing: Facing;
  /** World coordinate of the centre of the gap along the wall. */
  along: number;
  half: number;
  /** The room it leads to, and the portal id (court/courtPlan.ts) that joins them. */
  leadsTo: string;
};

export type InteriorDef = {
  /** Same as the entrance id that leads here. The room group is named `${id}-interior`. */
  id: string;
  /**
   * The room this room's door opens onto, when it is not the street: a unit off a corridor, a stair core
   * off a lobby. Such a room has no street entrance, no street view and is never drawn from the street.
   */
  outer?: string;
  /** Half the clear width of the primary doorway. Defaults to DOOR_HALF_OPEN. */
  doorHalf?: number;
  /** Further gaps in the walls, each leading to another room. */
  openings?: Opening[];
  /** Floor to ceiling, metres. Defaults to ROOM_HEIGHT. A stair core is as tall as the flights it holds. */
  height?: number;
  /** Height of the floor above the street, metres (the floor record's elevation). Defaults to 0. */
  elevation?: number;
  /** The rentable unit this room is, if it is one (court/courtPlan.ts). */
  unitId?: string;
  /** The building this room is in, and the floor of it. A room belongs to exactly one floor of one building. */
  buildingId: string;
  floorId: string;
  /** Outer footprint of the room, walls included. World metres. It sits against the door wall of its building. */
  room: Aabb;
  facing: Facing;
  /** World coordinate of the doorway centre along the door wall. */
  doorAlong: number;
  doorKind: DoorKind;
  /** Things you can see and bump into. */
  furniture: InteriorBlock[];
  /** Where the people who work here may be. Furniture and walls are collision; a person is a moving body. */
  zones: NpcZone[];
  insidePose: ExplorerPose;
  /** The exit prompt is measured from here. */
  exitAnchor: { x: number; z: number };
  /** The brief view through the door while the district is hidden. */
  vignette: { backdropTint: string; backdropHeight: number };
  tint: { floor: string; ceiling: string; wall: string; counter: string };
  spots: RoomSpot[];
};

export type ShopSpace = string;
export const STREET = STREET_SPACE;

export function roomName(def: Pick<InteriorDef, "id">): string {
  return `${def.id}-interior`;
}

export function vignetteName(def: Pick<InteriorDef, "id">): string {
  return `${def.id}-vignette`;
}

export function glassDoorName(id: string): string {
  return `door-glass-${id}`;
}

/** The centre of the doorway on the outer face of the door wall. */
export function doorPoint(def: Pick<InteriorDef, "room" | "facing" | "doorAlong">): { x: number; z: number } {
  const { room, facing, doorAlong } = def;
  switch (facing) {
    case "-x":
      return { x: room.minX, z: doorAlong };
    case "+x":
      return { x: room.maxX, z: doorAlong };
    case "-z":
      return { x: doorAlong, z: room.minZ };
    case "+z":
      return { x: doorAlong, z: room.maxZ };
  }
}

/** Unit vector pointing into the room from its door. */
export function inwardOf(facing: Facing): [number, number] {
  const [nx, nz] = FACING[facing].normal;
  return [-nx, -nz];
}

const toBox = ({ minX, maxX, minZ, maxZ }: Aabb): Aabb => ({ minX, maxX, minZ, maxZ });

export function doorHalfOf(def: Pick<InteriorDef, "doorHalf">): number {
  return def.doorHalf ?? DOOR_HALF_OPEN;
}

export function roomHeight(def: Pick<InteriorDef, "height">): number {
  return def.height ?? ROOM_HEIGHT;
}

const SIDES: readonly Facing[] = ["-x", "+x", "-z", "+z"];

/** Every gap in the walls of a room, the primary doorway included, as {facing, along, half}. */
export function allGaps(def: InteriorDef): { facing: Facing; along: number; half: number }[] {
  return [{ facing: def.facing, along: def.doorAlong, half: doorHalfOf(def) }, ...(def.openings ?? [])];
}

/** The parts of [lo, hi] that are not inside any gap. Gaps are [from, to] and may be in any order. */
function minusGaps(lo: number, hi: number, gaps: readonly [number, number][]): [number, number][] {
  const out: [number, number][] = [];
  let at = lo;
  for (const [from, to] of [...gaps].sort((a, b) => a[0] - b[0])) {
    if (from > at) {
      out.push([at, Math.min(from, hi)]);
    }
    at = Math.max(at, to);
  }
  if (at < hi) {
    out.push([at, hi]);
  }
  return out.filter(([a, b]) => b - a > 1e-6);
}

/** The wall slabs either side of every gap and the furniture. The gaps themselves are open. */
export function interiorBlocks(def: InteriorDef): InteriorBlock[] {
  const { room, facing, doorAlong } = def;
  const wall = (box: Aabb): InteriorBlock => ({ kind: "wall", ...box });
  if ((def.openings?.length ?? 0) > 0) {
    // A room with several gaps: each of the four walls is cut around its own gaps. The two walls that run
    // along x take the full width, so a corner is one slab, not two overlapping ones.
    const walls: InteriorBlock[] = [];
    for (const side of SIDES) {
      const alongZ = side === "-x" || side === "+x";
      const [a0, a1] = alongRange(room, side);
      const lo = alongZ ? a0 + WALL : a0;
      const hi = alongZ ? a1 - WALL : a1;
      const gaps = allGaps(def)
        .filter((gap) => gap.facing === side)
        .map((gap): [number, number] => [gap.along - gap.half, gap.along + gap.half]);
      for (const [from, to] of minusGaps(lo, hi, gaps)) {
        walls.push(wall(placeOnFace(room, side, 0, WALL, from, to)));
      }
    }
    return [...walls, ...def.furniture];
  }
  const depth = depthOf(room, facing);
  const [v0, v1] = alongRange(room, facing);
  const doorLo = doorAlong - doorHalfOf(def);
  const doorHi = doorAlong + doorHalfOf(def);
  return [
    wall(placeOnFace(room, facing, 0, WALL, v0, doorLo)),
    wall(placeOnFace(room, facing, 0, WALL, doorHi, v1)),
    wall(placeOnFace(room, facing, depth - WALL, depth, v0, v1)),
    wall(placeOnFace(room, facing, 0, depth, v0, v0 + WALL)),
    wall(placeOnFace(room, facing, 0, depth, v1 - WALL, v1)),
    ...def.furniture,
  ];
}

/** The wall above the doorway. It has no collision. */
export function lintelBox(def: InteriorDef): Aabb {
  const { room, facing, doorAlong } = def;
  return placeOnFace(room, facing, 0, WALL, doorAlong - doorHalfOf(def), doorAlong + doorHalfOf(def));
}

/** The wall above every gap, the primary doorway included. None of them has collision. */
export function lintelBoxes(def: InteriorDef): Aabb[] {
  return allGaps(def).map((gap) => placeOnFace(def.room, gap.facing, 0, WALL, gap.along - gap.half, gap.along + gap.half));
}

/**
 * Splits a wall slab into the outer part (the street shell draws it, in the building's colour) and a thin
 * plaster skin on the inner face (the room draws it, in the room's colour). The two never share a visible
 * face, so the room can be drawn while the street is still on screen without z-fighting.
 */
export function splitWall(def: InteriorDef, wall: Aabb): { outer: Aabb | null; skin: Aabb } {
  const centre = { x: (def.room.minX + def.room.maxX) / 2, z: (def.room.minZ + def.room.maxZ) / 2 };
  const thickX = wall.maxX - wall.minX <= WALL + 1e-6;
  const thickZ = wall.maxZ - wall.minZ <= WALL + 1e-6;
  // The thin axis is the one that is wall thickness. A square corner post is cut along x.
  if (thickX) {
    const inward = (wall.minX + wall.maxX) / 2 < centre.x ? 1 : -1;
    return inward > 0
      ? { outer: { ...wall, maxX: wall.maxX - SKIN }, skin: { ...wall, minX: wall.maxX - SKIN } }
      : { outer: { ...wall, minX: wall.minX + SKIN }, skin: { ...wall, maxX: wall.minX + SKIN } };
  }
  if (thickZ) {
    const inward = (wall.minZ + wall.maxZ) / 2 < centre.z ? 1 : -1;
    return inward > 0
      ? { outer: { ...wall, maxZ: wall.maxZ - SKIN }, skin: { ...wall, minZ: wall.maxZ - SKIN } }
      : { outer: { ...wall, minZ: wall.minZ + SKIN }, skin: { ...wall, maxZ: wall.minZ + SKIN } };
  }
  return { outer: null, skin: wall };
}

/** Room collision: walls and furniture. */
export function interiorBoxes(def: InteriorDef): Aabb[] {
  return interiorBlocks(def).map(toBox);
}

/** How far outside the door wall the player's centre may go before the street takes over. */
const DOOR_SIDE_OVERSHOOT = 0.8;

/**
 * Where the player's centre may go. Keeps a gap from the walls so a slide cannot clip the corner, except
 * on the door side, where the doorway leads out and the walls themselves do the blocking.
 */
export function interiorBounds(def: InteriorDef): Aabb {
  const inset = WALL + 0.05 + 0.4;
  const bounds = {
    minX: def.room.minX + inset,
    maxX: def.room.maxX - inset,
    minZ: def.room.minZ + inset,
    maxZ: def.room.maxZ - inset,
  };
  // Every wall that has a doorway lets the centre go a little past it, so the next room can take over.
  for (const side of new Set<Facing>([def.facing, ...(def.openings ?? []).map((opening) => opening.facing)])) {
    switch (side) {
      case "-x":
        bounds.minX = def.room.minX - DOOR_SIDE_OVERSHOOT;
        break;
      case "+x":
        bounds.maxX = def.room.maxX + DOOR_SIDE_OVERSHOOT;
        break;
      case "-z":
        bounds.minZ = def.room.minZ - DOOR_SIDE_OVERSHOOT;
        break;
      case "+z":
        bounds.maxZ = def.room.maxZ + DOOR_SIDE_OVERSHOOT;
        break;
    }
  }
  return bounds;
}

/**
 * How high each kind of furniture stands, metres, including what sits on it (a till, a hood, a flue). These
 * are upper bounds taken from the props in interiorProps.ts. The camera only cares which are taller than
 * the player's shoulders (CAMERA_OCCLUDER_TOP).
 */
export const BLOCK_TOP: Readonly<Record<BlockKind, number>> = {
  wall: ROOM_HEIGHT,
  counter: 1.4,
  shelf: 1.95,
  fridge: 2.1,
  freezer: 0.9,
  table: 0.95,
  rack: 1.8,
  stack: 1.1,
  stove: 3.8,
  oven: 3.3,
  display: 1.3,
  column: 13,
};

/**
 * Low pieces that stand on their own in the customers' side of a room. The camera may float over these. A
 * counter is deliberately not one: it divides the room, and the camera should not drift over it into the
 * kitchen or the stockroom.
 */
const CAMERA_PASSES_OVER: ReadonlySet<BlockKind> = new Set<BlockKind>(["table", "freezer", "stack", "display"]);

/** How far the lens stays off an inner wall face. The near plane is 0.1 m, so this keeps it clear of the plaster. */
const CAMERA_WALL_MARGIN = 0.1;

/**
 * Where the follow camera may be while the player is in this room: inside the walls, or in the doorway
 * itself, and never inside or across a piece of furniture. The doorway's pocket ends at the door's outer
 * face, so the lens can stand in the doorway looking in but never out on the street. A player who has just
 * crossed the threshold therefore gets a camera that is already inside, and the street (which is hidden
 * while the player is in a room) is never in view behind them.
 */
export function interiorCameraVolume(def: InteriorDef): CameraVolume {
  const { room, facing, doorAlong } = def;
  const depth = depthOf(room, facing);
  const [v0, v1] = alongRange(room, facing);
  const inset = WALL + CAMERA_WALL_MARGIN;
  const hall = placeOnFace(room, facing, inset, depth - inset, v0 + inset, v1 - inset);
  const pocketAt = (side: Facing, along: number, half: number): Aabb =>
    placeOnFace(room, side, CAMERA_WALL_MARGIN / 2, inset + CAMERA_WALL_MARGIN, along - half + CAMERA_WALL_MARGIN, along + half - CAMERA_WALL_MARGIN);
  const pocket = pocketAt(facing, doorAlong, doorHalfOf(def));
  return {
    regions: [hall, pocket, ...(def.openings ?? []).map((opening) => pocketAt(opening.facing, opening.along, opening.half))],
    solids: interiorBlocks(def)
      .filter((block) => block.kind !== "wall")
      .map((block) =>
        CAMERA_PASSES_OVER.has(block.kind) ? { ...toBox(block), top: BLOCK_TOP[block.kind] } : toBox(block),
      ),
  };
}

/** Indoors the exit prompt is a little tighter than a street door, so arriving never shows it. */
export const EXIT_REACH = 2.2;

/** True when the point is near the exit side of this room, so the exit prompt can show. */
export function nearExit(def: InteriorDef, x: number, z: number): boolean {
  const dx = x - def.exitAnchor.x;
  const dz = z - def.exitAnchor.z;
  return dx * dx + dz * dz <= EXIT_REACH * EXIT_REACH;
}

/** True when a point is within the room's walls. A margin below zero counts a little beyond them. */
export function insideRoom(def: Pick<InteriorDef, "room">, x: number, z: number, margin = 0): boolean {
  const inset = WALL + margin;
  return (
    x > def.room.minX + inset && x < def.room.maxX - inset && z > def.room.minZ + inset && z < def.room.maxZ - inset
  );
}

/** Within this distance of its door a room is drawn from the street, so the doorway shows a lit room. */
export const PEEK_DISTANCE = 20;

/** True when a room is close enough to its door to be worth drawing from the street. */
export function nearDoor(def: Pick<InteriorDef, "room" | "facing" | "doorAlong">, x: number, z: number, distance = PEEK_DISTANCE): boolean {
  const door = doorPoint(def);
  return Math.hypot(x - door.x, z - door.z) <= distance;
}
