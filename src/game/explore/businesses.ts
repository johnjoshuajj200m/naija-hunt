import type { Facing } from "../scenes/junction/frontage";
import { COURT_ID, COURT_NAME, frontDoor, RECTS, roomFrom } from "./court/courtGeometry";
import { stripOpenings } from "./court/courtIds";
import type { Opening } from "./interiors";

/**
 * Every business a player can walk into. One row per business, and the row says everything the rest of
 * the game needs to know about it: who it is, which door of which building leads in, what kind of door
 * that is, how big the room behind it is and how it is furnished.
 *
 * Nothing here draws or collides. The entrance table (entrances.ts) turns each row into an open entrance,
 * roomPlan.ts turns it into a room (walls, furniture, entry and exit, collision), and the scene builders
 * turn that into meshes. A business that is not in this table has no room, and its door stays shut.
 */

/** An automatic glass door slides open by itself; an open front is a doorway with a hooked-back leaf. */
export type DoorKind = "sliding-glass" | "open-front";

/** Furniture recipes (interiorLayouts.ts). Several businesses can share one. */
export type LayoutKind =
  | "buka"
  | "cold-store"
  | "fabrics"
  | "bakery"
  | "grill"
  | "auto-parts"
  // Palm Court (court/courtPlan.ts).
  | "pharmacy"
  | "phones"
  | "provisions"
  | "lobby"
  | "hall"
  | "stairs"
  | "lift"
  | "office"
  | "studio"
  | "vacant";

export type BusinessKind = "shop" | "workshop";

export type RoomTint = { floor: string; ceiling: string; wall: string; counter: string };

export type BusinessDef = {
  /** Also the id of the entrance and of the room. */
  id: string;
  name: string;
  kind: BusinessKind;
  /** The building and bay the door is in (see entrances.ts and frontage.ts). */
  buildingId: string;
  /** The floor of that building the room is on. Every business today is on the ground floor, which is the default. */
  floorId?: string;
  facing: Facing;
  bay: number;
  doorKind: DoorKind;
  layout: LayoutKind;
  /**
   * The room, in the door's own frame: depth is metres in from the door wall; sMin and sMax are metres
   * either side of the door along the wall (positive is to the right as you walk in). The room must stay
   * inside its building, which businesses.test.ts checks.
   */
  room: { depth: number; sMin: number; sMax: number };
  tint: RoomTint;
  /** The building across the street, seen through the door while the street itself is hidden. */
  vignette: { backdropTint: string; backdropHeight: number };
  /**
   * The rest only matters to a room inside a building, reached from another room and not from the street
   * (court/courtPlan.ts). A street business leaves them out.
   */
  /** World position of the door, instead of a bay of the building's frontage. */
  doorAt?: { x: number; z: number };
  /** The room the door opens onto. Absent: the street. */
  outer?: string;
  doorHalf?: number;
  /** Floor to ceiling. Absent: the usual ROOM_HEIGHT. */
  height?: number;
  /** Height of the floor above the street. */
  elevation?: number;
  /** The rentable unit this room is. */
  unitId?: string;
  /** Gaps in its walls that lead to other rooms. */
  openings?: Opening[];
};

/** Everything the three street-door rooms of Palm Court share: a cream room tint and what faces them across the road. */
const COURT_VIGNETTE = { backdropTint: "#d9ae80", backdropHeight: 14 };

const COURT_DOORS = { pharmacy: 1, lobby: 3, phones: 5 } as const;

export const BUSINESSES: readonly BusinessDef[] = [
  {
    id: "mama-put",
    name: "Mama Put",
    kind: "shop",
    buildingId: "market-east-corner",
    facing: "-x",
    bay: 2,
    doorKind: "sliding-glass",
    layout: "buka",
    room: { depth: 12, sMin: -10, sMax: 2 },
    tint: { floor: "#d9d0c2", ceiling: "#cfc6b6", wall: "#efe6d0", counter: "#e4d2b4" },
    vignette: { backdropTint: "#cf9068", backdropHeight: 13 },
  },
  {
    id: "cold-room",
    name: "Cold Room",
    kind: "shop",
    buildingId: "market-east-south",
    facing: "-x",
    bay: 3,
    doorKind: "sliding-glass",
    layout: "cold-store",
    room: { depth: 12, sMin: -6, sMax: 6 },
    tint: { floor: "#cfd2cc", ceiling: "#d8dcd8", wall: "#e6efec", counter: "#f7fcfd" },
    vignette: { backdropTint: "#a7bda0", backdropHeight: 15 },
  },
  {
    id: "ankara-house",
    name: "Ankara House",
    kind: "shop",
    buildingId: "market-east-north",
    facing: "-x",
    bay: 2,
    doorKind: "open-front",
    layout: "fabrics",
    room: { depth: 12, sMin: -10, sMax: 6 },
    tint: { floor: "#d9ccb7", ceiling: "#d2c8b6", wall: "#f0e5cf", counter: "#c9a76a" },
    vignette: { backdropTint: "#cf9068", backdropHeight: 13 },
  },
  {
    id: "fresh-bread",
    name: "Fresh Bread",
    kind: "shop",
    buildingId: "market-west-north",
    facing: "+x",
    bay: 1,
    doorKind: "open-front",
    layout: "bakery",
    room: { depth: 12, sMin: -6, sMax: 10 },
    tint: { floor: "#e0cdb0", ceiling: "#e6d8bf", wall: "#f3e3c0", counter: "#d9b98a" },
    vignette: { backdropTint: "#d2825f", backdropHeight: 10 },
  },
  {
    id: "mallam-suya",
    name: "Mallam Suya",
    kind: "shop",
    buildingId: "market-west-tall",
    facing: "+x",
    bay: 3,
    doorKind: "open-front",
    layout: "grill",
    room: { depth: 12, sMin: -6, sMax: 6 },
    tint: { floor: "#c9bba3", ceiling: "#cdbfa6", wall: "#e8d6b5", counter: "#b98a55" },
    vignette: { backdropTint: "#c9694a", backdropHeight: 16 },
  },
  {
    id: "spare-parts",
    name: "Spare Parts",
    kind: "workshop",
    buildingId: "market-west-low",
    facing: "+x",
    bay: 3,
    doorKind: "open-front",
    layout: "auto-parts",
    room: { depth: 12, sMin: -6, sMax: 6 },
    tint: { floor: "#bdb7ab", ceiling: "#c8c2b4", wall: "#d9d2c2", counter: "#8a8070" },
    vignette: { backdropTint: "#dba86c", backdropHeight: 10 },
  },
  // Palm Court's three street doors (court/courtPlan.ts has the rest of the building).
  {
    id: "glow-pharmacy",
    name: "Glow Pharmacy",
    kind: "shop",
    buildingId: COURT_ID,
    facing: "-z",
    bay: COURT_DOORS.pharmacy,
    doorKind: "sliding-glass",
    layout: "pharmacy",
    room: roomFrom(RECTS.eastFront, frontDoor(COURT_DOORS.pharmacy), "-z"),
    tint: { floor: "#dfe3dc", ceiling: "#e8eceb", wall: "#eef5f1", counter: "#f2f7f8" },
    vignette: COURT_VIGNETTE,
    unitId: "PC-G1",
  },
  {
    id: "naija-phones",
    name: "Naija Phones",
    kind: "shop",
    buildingId: COURT_ID,
    facing: "-z",
    bay: COURT_DOORS.phones,
    doorKind: "open-front",
    layout: "phones",
    room: roomFrom(RECTS.westFront, frontDoor(COURT_DOORS.phones), "-z"),
    tint: { floor: "#c9cbc6", ceiling: "#d6d9d6", wall: "#dfe4e8", counter: "#c2cdd2" },
    vignette: COURT_VIGNETTE,
    unitId: "PC-G2",
  },
  {
    id: "palm-court-lobby",
    name: COURT_NAME,
    kind: "shop",
    buildingId: COURT_ID,
    facing: "-z",
    bay: COURT_DOORS.lobby,
    doorKind: "sliding-glass",
    layout: "lobby",
    room: roomFrom(RECTS.strip, frontDoor(COURT_DOORS.lobby), "-z"),
    tint: { floor: "#d6cdbf", ceiling: "#e3dccd", wall: "#efe4cd", counter: "#b98a55" },
    vignette: COURT_VIGNETTE,
    openings: stripOpenings(0),
  },
];

export function businessById(id: string): BusinessDef | undefined {
  return BUSINESSES.find((business) => business.id === id);
}
