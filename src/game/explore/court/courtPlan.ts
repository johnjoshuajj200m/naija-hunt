import type { BusinessDef, LayoutKind, RoomTint } from "../businesses";
import type { InteriorDef } from "../interiors";
import { ROOM_HEIGHT } from "../interiors";
import { planInterior } from "../roomPlan";
import type { Floor } from "../spaces";
import { COURT_FOOTPRINT, COURT_ID, FLOOR_PITCH, RECTS, roomFrom, STRIP_X, X, Z, type DoorPoint } from "./courtGeometry";
import { FLOOR_IDS, ROOM, stripOpenings, stripRoomId, unitRoomId, DOOR_HALF, type Level, type UnitLetter } from "./courtIds";
import { floorElevation } from "./lift";

/**
 * Palm Court as data: its floors, the rooms that are not on the street (the stair core, the lift, the halls
 * and the units off them), and the rentable unit records. The three rooms with street doors are ordinary
 * businesses (businesses.ts); everything here is reached from another room.
 *
 * A unit is a record apart from its room: the id, the building, the floor and the room it stands in never
 * change when the business in it does. `occupancy` and `tenant` are the parts a rental system would write.
 */

/** Three floors, FLOOR_PITCH apart. The elevation is what bodies and cameras on that floor are raised by. */
export const COURT_FLOORS: readonly Floor[] = FLOOR_IDS.map((id, level) => ({
  id,
  level,
  elevation: floorElevation(level as Level),
  height: ROOM_HEIGHT,
}));

export type Occupancy = "occupied" | "vacant";

/** What a tenant has put up: their name, what they do, and the cell of their sign on the sign atlas. */
export type Tenant = { name: string; trade: string; sign: string };

/** The parts of a unit a tenant will be able to change, once there is a rental system. Data only. */
export const CUSTOMISATION_SLOTS = ["signage", "counter", "shelving", "wall colour", "floor"] as const;

export type UnitRecord = {
  /** Stable, never reused: PC-G1, PC-2A ... */
  id: string;
  buildingId: string;
  floorId: string;
  /** The room (space id) the unit stands in. */
  roomId: string;
  occupancy: Occupancy;
  tenant: Tenant | null;
  /** Atlas cell of the plate that names the unit on its door, and of the tenant's or "to let" plate under it. */
  plate: string | null;
  slots: readonly string[];
};

type UnitSpec = {
  level: Level;
  letter: UnitLetter;
  tenant: Tenant | null;
  layout: LayoutKind;
  tint: RoomTint;
};

const TAILOR_TINT: RoomTint = { floor: "#d9ccb7", ceiling: "#e6dccb", wall: "#f3e6cc", counter: "#c9a76a" };
const OFFICE_TINT: RoomTint = { floor: "#c9cbc6", ceiling: "#e1e4e0", wall: "#e4eaea", counter: "#9aa7ad" };
const PRINT_TINT: RoomTint = { floor: "#bfc4c4", ceiling: "#dde2e2", wall: "#e0e8ee", counter: "#7d96ad" };
const VACANT_TINT: RoomTint = { floor: "#cfc8bb", ceiling: "#e2dccf", wall: "#ebe4d4", counter: "#b8a98b" };

/** The upper-floor units. The ground-floor ones are the pharmacy, the phone shop and provisions (businesses.ts). */
const UPPER: readonly UnitSpec[] = [
  { level: 1, letter: "a", tenant: { name: "Eko Tailors", trade: "Tailoring", sign: "eko-tailors" }, layout: "studio", tint: TAILOR_TINT },
  { level: 1, letter: "b", tenant: null, layout: "vacant", tint: VACANT_TINT },
  { level: 1, letter: "c", tenant: { name: "Adaeze Law Chambers", trade: "Legal", sign: "adaeze-law" }, layout: "office", tint: OFFICE_TINT },
  { level: 2, letter: "a", tenant: null, layout: "vacant", tint: VACANT_TINT },
  { level: 2, letter: "b", tenant: { name: "Naija Print Hub", trade: "Printing", sign: "naija-print" }, layout: "office", tint: PRINT_TINT },
  { level: 2, letter: "c", tenant: null, layout: "vacant", tint: VACANT_TINT },
];

const unitCode = (level: Level, letter: UnitLetter): string => `PC-${level === 0 ? "G" : level + 1}${letter.toUpperCase()}`;

/** Where a unit's door is, and which part of the building it fills (the same on every floor). */
const UNIT_BOX = {
  a: { box: RECTS.eastFront, door: { x: X.stripE, z: Z.frontSide }, facing: "-x" as const },
  b: { box: RECTS.westFront, door: { x: X.stripW, z: Z.frontSide }, facing: "+x" as const },
  c: { box: RECTS.eastBack, door: { x: X.stripE, z: Z.side }, facing: "-x" as const },
};

/** Every unit in the building, in floor order. */
export const COURT_UNITS: readonly UnitRecord[] = [
  {
    id: "PC-G1",
    buildingId: COURT_ID,
    floorId: FLOOR_IDS[0],
    roomId: unitRoomId(0, "a"),
    occupancy: "occupied",
    tenant: { name: "Glow Pharmacy", trade: "Pharmacy", sign: "glow-pharmacy" },
    plate: null,
    slots: CUSTOMISATION_SLOTS,
  },
  {
    id: "PC-G2",
    buildingId: COURT_ID,
    floorId: FLOOR_IDS[0],
    roomId: unitRoomId(0, "b"),
    occupancy: "occupied",
    tenant: { name: "Naija Phones", trade: "Phones and repairs", sign: "naija-phones" },
    plate: null,
    slots: CUSTOMISATION_SLOTS,
  },
  {
    id: "PC-G3",
    buildingId: COURT_ID,
    floorId: FLOOR_IDS[0],
    roomId: unitRoomId(0, "c"),
    occupancy: "occupied",
    tenant: { name: "Bola Provisions", trade: "Provisions", sign: "bola-provisions" },
    plate: null,
    slots: CUSTOMISATION_SLOTS,
  },
  ...UPPER.map(
    (spec): UnitRecord => ({
      id: unitCode(spec.level, spec.letter),
      buildingId: COURT_ID,
      floorId: FLOOR_IDS[spec.level],
      roomId: unitRoomId(spec.level, spec.letter),
      occupancy: spec.tenant ? "occupied" : "vacant",
      tenant: spec.tenant,
      plate: `unit-${spec.level + 1}${spec.letter}`,
      slots: CUSTOMISATION_SLOTS,
    }),
  ),
];

export function unitOfRoom(roomId: string): UnitRecord | undefined {
  return COURT_UNITS.find((unit) => unit.roomId === roomId);
}

const COMMON_VIGNETTE = { backdropTint: "#d9ae80", backdropHeight: 14 };

const stripTint = (level: Level): RoomTint => ({
  floor: level === 0 ? "#d6cdbf" : "#d3cbbd",
  ceiling: "#e6dfd0",
  wall: level === 0 ? "#efe4cd" : "#ece4d2",
  counter: "#b98a55",
});

const STAIR_TINT: RoomTint = { floor: "#c7c1b5", ceiling: "#dcd6c9", wall: "#e5ddca", counter: "#a89c86" };
const LIFT_TINT: RoomTint = { floor: "#8d8f8c", ceiling: "#d6d9d6", wall: "#c3c8c6", counter: "#a7acaa" };

/** A row for a room that is reached from another room. Everything a street business has that a room inside does not is left out. */
function inner(
  row: Pick<BusinessDef, "id" | "name" | "layout" | "tint" | "facing" | "outer" | "unitId"> &
    Partial<Pick<BusinessDef, "doorHalf" | "height" | "openings">> & { box: typeof RECTS.core; door: DoorPoint; level: Level },
): BusinessDef {
  const { box, door, level, ...rest } = row;
  return {
    kind: "shop",
    buildingId: COURT_ID,
    floorId: FLOOR_IDS[level],
    bay: 0,
    doorKind: "open-front",
    vignette: COMMON_VIGNETTE,
    room: roomFrom(box, door, row.facing),
    doorAt: door,
    elevation: floorElevation(level),
    ...rest,
  };
}

const ground = stripRoomId(0);

const LEVEL_ROWS = ([1, 2] as const).flatMap((level): BusinessDef[] => [
  inner({
    id: stripRoomId(level),
    name: `Palm Court, ${level === 1 ? "second" : "third"} floor`,
    layout: "hall",
    tint: stripTint(level),
    facing: "+z",
    outer: ROOM.stairs,
    doorHalf: DOOR_HALF.stairs,
    // The hall's own door is the one to the stairs, so the rest of its openings are the units and the lift.
    openings: stripOpenings(level).filter((opening) => opening.leadsTo !== ROOM.stairs),
    box: RECTS.strip,
    door: { x: STRIP_X, z: Z.core },
    level,
  }),
  ...UPPER.filter((spec) => spec.level === level).map((spec) => {
    const place = UNIT_BOX[spec.letter];
    return inner({
      id: unitRoomId(level, spec.letter),
      name: spec.tenant?.name ?? `Unit ${level + 1}${spec.letter.toUpperCase()} (to let)`,
      layout: spec.layout,
      tint: spec.tint,
      facing: place.facing,
      outer: stripRoomId(level),
      unitId: unitCode(level, spec.letter),
      box: place.box,
      door: place.door,
      level,
    });
  }),
]);

/** The rows of every room in Palm Court that has no street door. */
export const COURT_ROWS: readonly BusinessDef[] = [
  inner({
    id: unitRoomId(0, "c"),
    name: "Bola Provisions",
    layout: "provisions",
    tint: { floor: "#d9d0c2", ceiling: "#e6dfd0", wall: "#f0e4c8", counter: "#c9a76a" },
    facing: "-x",
    outer: ground,
    unitId: "PC-G3",
    box: UNIT_BOX.c.box,
    door: UNIT_BOX.c.door,
    level: 0,
  }),
  inner({
    id: ROOM.stairs,
    name: "Stairs",
    layout: "stairs",
    tint: STAIR_TINT,
    facing: "-z",
    outer: ground,
    doorHalf: DOOR_HALF.stairs,
    // Two flights per storey, stacked for two storeys, so the core is as tall as the three floors need.
    height: 2 * FLOOR_PITCH + ROOM_HEIGHT,
    box: RECTS.core,
    door: { x: STRIP_X, z: Z.core },
    level: 0,
  }),
  inner({
    id: ROOM.lift,
    name: "Lift",
    layout: "lift",
    tint: LIFT_TINT,
    facing: "+x",
    outer: ground,
    doorHalf: DOOR_HALF.lift,
    box: RECTS.shaft,
    door: { x: X.stripW, z: Z.side },
    level: 0,
  }),
  ...LEVEL_ROWS,
];

/** Plans the rooms. The street rooms (pharmacy, phones, lobby) come from the business table. */
export const COURT_INTERIORS: readonly InteriorDef[] = COURT_ROWS.map((row) => planInterior(row, COURT_FOOTPRINT));

export { COURT_FOOTPRINT };
