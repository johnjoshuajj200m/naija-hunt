import { FACING } from "../scenes/junction/frontage";
import { COURT_ID, STRIP_X, X, Z } from "./court/courtGeometry";
import { FLOOR_IDS, ROOM, stripRoomId } from "./court/courtIds";
import { COURT_FLOORS } from "./court/courtPlan";
import { WORLD_ENTRANCES } from "./entranceWorld";
import { INTERIORS } from "./interiorRegistry";
import { doorPoint } from "./interiors";
import { GROUND_FLOOR, STREET_SPACE, buildModel, type Connection, type Floor, type Room, type Stop } from "./spaces";

/** The one floor most buildings have: the ground storey, at street level, four metres to the ceiling. */
export const GROUND: Floor = { id: GROUND_FLOOR, level: 0, elevation: 0, height: 4 };

/** Where a person stands, just outside the door of a room that opens onto another room, facing away from it. */
function outsideStop(def: (typeof INTERIORS)[number]): Stop {
  const door = doorPoint(def);
  const [nx, nz] = FACING[def.facing].normal;
  return { space: def.outer ?? STREET_SPACE, x: door.x + nx * 0.9, z: door.z + nz * 0.9, yaw: def.insidePose.yaw + Math.PI };
}

/** The stair core is entered from the lobby and left onto the halls; each is a stop on the stairs. */
const STAIR_STOPS: Stop[] = FLOOR_IDS.map((_, level) => ({
  space: stripRoomId(level as 0 | 1 | 2),
  x: STRIP_X,
  z: Z.core - 1.2,
  yaw: 0,
}));

/** The lift is served at the same place on every floor: in front of its doors, which face east. */
const LIFT_STOPS: Stop[] = FLOOR_IDS.map((_, level) => ({
  space: stripRoomId(level as 0 | 1 | 2),
  x: X.stripW + 1.1,
  z: Z.side,
  yaw: -Math.PI / 2,
}));

/**
 * The district's buildings, floors, rooms and connections, derived from the businesses and the rooms inside
 * Palm Court. A business names its building and (optionally) its floor; a room that opens onto another room
 * is a "door" connection from the one to the other, and a room with a street door is one from the pavement.
 * Palm Court adds its stairs and its lift, which join its floors.
 */
export const DISTRICT = (() => {
  const floors = new Map<string, Floor[]>();
  for (const def of INTERIORS) {
    if (!floors.has(def.buildingId)) {
      floors.set(def.buildingId, def.buildingId === COURT_ID ? [...COURT_FLOORS] : [GROUND]);
    }
  }
  const rooms: Room[] = INTERIORS.map((def) => ({
    id: def.id,
    buildingId: def.buildingId,
    floorId: def.floorId,
    unitId: def.unitId ?? def.id,
  }));
  const doors: Connection[] = INTERIORS.map((def) => {
    if (def.outer !== undefined) {
      return {
        id: `${def.id}-door`,
        kind: "door",
        stops: [outsideStop(def), { space: def.id, ...def.insidePose }],
      };
    }
    const entrance = WORLD_ENTRANCES.find((candidate) => candidate.id === def.id);
    if (!entrance) {
      throw new Error(`Room "${def.id}" has no entrance.`);
    }
    return {
      id: `${def.id}-door`,
      kind: "door",
      stops: [
        { space: STREET_SPACE, ...entrance.outsidePose },
        { space: def.id, ...def.insidePose },
      ],
    };
  });
  const court: Connection[] = [
    { id: `${ROOM.stairs}-flights`, kind: "stairs", stops: STAIR_STOPS },
    { id: ROOM.lift, kind: "lift", stops: LIFT_STOPS },
  ];
  return buildModel(floors, rooms, [...doors, ...court]);
})();