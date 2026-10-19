import { describe, expect, it } from "vitest";

import { DISTRICT } from "../districtModel";
import { INTERIORS, interiorById } from "../interiorRegistry";
import { allGaps, doorHalfOf, doorPoint, interiorBounds, interiorBoxes, nearDoor, type InteriorDef } from "../interiors";
import { blocked, EXPLORER_RADIUS, type Aabb } from "../movement";
import { floorOf, isOwnerVisible, roomOwner } from "../spaces";
import { walkFrame } from "../walkFrame";
import { COURT_FOOTPRINT, COURT_ID, FLOOR_PITCH, RECTS, STRIP_X, X, Z } from "./courtGeometry";
import { FLOOR_IDS, LEVELS, ROOM, stripOpenings, stripRoomId, unitRoomId, type Level } from "./courtIds";
import { COURT_FLOORS, COURT_UNITS, unitOfRoom } from "./courtPlan";
import { callLift, startLift, stepLift, type LiftState } from "./lift";
import { adjacentSpaces, elevationIn, levelAt, PORTALS, portalPassable, spaceAfterPortals } from "./portals";

const P = FLOOR_PITCH;
const court = INTERIORS.filter((def) => def.buildingId === COURT_ID);
const def = (id: string): InteriorDef => interiorById(id) as InteriorDef;

const overlaps = (a: Aabb, b: Aabb): boolean => a.minX < b.maxX - 1e-6 && a.maxX > b.minX + 1e-6 && a.minZ < b.maxZ - 1e-6 && a.maxZ > b.minZ + 1e-6;

function openLift(floor: Level): LiftState {
  let state = callLift({ ...startLift(0) }, floor).state;
  for (let t = 0; t < 60 && !(state.phase === "open" && state.floor === floor); t += 0.05) {
    state = stepLift(state, 0.05, false);
  }
  return state;
}

describe("Palm Court's plan", () => {
  it("tiles its footprint with rooms that do not overlap", () => {
    const boxes = Object.values(RECTS).filter((rect) => rect !== RECTS.shaft);
    for (const [index, a] of boxes.entries()) {
      for (const b of boxes.slice(index + 1)) {
        expect(overlaps(a, b)).toBe(false);
      }
      expect(a.minX).toBeGreaterThanOrEqual(Math.min(COURT_FOOTPRINT.x0, COURT_FOOTPRINT.x1) - 1e-6);
      expect(a.maxX).toBeLessThanOrEqual(Math.max(COURT_FOOTPRINT.x0, COURT_FOOTPRINT.x1) + 1e-6);
      expect(a.minZ).toBeGreaterThanOrEqual(Math.min(COURT_FOOTPRINT.z0, COURT_FOOTPRINT.z1) - 1e-6);
      expect(a.maxZ).toBeLessThanOrEqual(Math.max(COURT_FOOTPRINT.z0, COURT_FOOTPRINT.z1) + 1e-6);
    }
  });

  it("has three floors, a floor apart, and a room on each", () => {
    expect(COURT_FLOORS.map((floor) => floor.id)).toEqual([...FLOOR_IDS]);
    expect(COURT_FLOORS.map((floor) => floor.elevation)).toEqual([0, P, 2 * P]);
    for (const floor of COURT_FLOORS) {
      expect(court.some((room) => room.floorId === floor.id && room.id !== ROOM.stairs && room.id !== ROOM.lift), floor.id).toBe(true);
    }
    // The stairs and the lift are on the ground floor, which is where they start, and reach the others.
    expect(def(ROOM.stairs).height).toBeGreaterThan(2 * P);
    expect(DISTRICT.buildings.get(COURT_ID)?.floors).toHaveLength(3);
  });

  it("puts the rooms of one floor at one height, and no two of them on top of each other", () => {
    for (const floor of COURT_FLOORS) {
      const rooms = court.filter((room) => room.floorId === floor.id && room.id !== ROOM.lift && room.id !== ROOM.stairs);
      for (const room of rooms) {
        expect(room.elevation ?? 0, room.id).toBe(floor.elevation);
      }
      for (const [index, a] of rooms.entries()) {
        for (const b of rooms.slice(index + 1)) {
          expect(overlaps(a.room, b.room), `${a.id} / ${b.id}`).toBe(false);
        }
      }
    }
  });

  it("opens each doorway in both rooms, in the same place", () => {
    for (const level of LEVELS) {
      const strip = def(stripRoomId(level));
      const gaps = allGaps(strip);
      for (const opening of stripOpenings(level)) {
        const other = def(opening.leadsTo);
        // The strip has a gap in its own wall where the other room has its door.
        const mine = gaps.find((gap) => gap.facing === opening.facing && Math.abs(gap.along - opening.along) < 1e-6);
        expect(mine, `${strip.id} -> ${opening.leadsTo}`).toBeDefined();
        const door = doorPoint(other);
        const along = opening.facing === "+x" || opening.facing === "-x" ? door.z : door.x;
        expect(along, `${opening.leadsTo} lines up`).toBeCloseTo(opening.along, 5);
        expect(doorHalfOf(other)).toBeCloseTo(opening.half, 5);
      }
    }
  });
});

describe("units", () => {
  it("each have a stable id, building, floor, room and occupancy", () => {
    expect(new Set(COURT_UNITS.map((unit) => unit.id)).size).toBe(COURT_UNITS.length);
    expect(COURT_UNITS.map((unit) => unit.id)).toEqual(["PC-G1", "PC-G2", "PC-G3", "PC-2A", "PC-2B", "PC-2C", "PC-3A", "PC-3B", "PC-3C"]);
    for (const unit of COURT_UNITS) {
      const room = def(unit.roomId);
      expect(unit.buildingId, unit.id).toBe(COURT_ID);
      expect(room.floorId, unit.id).toBe(unit.floorId);
      expect(room.unitId, unit.id).toBe(unit.id);
      expect(DISTRICT.rooms.get(unit.roomId)?.unitId, unit.id).toBe(unit.id);
      expect(unit.occupancy === "occupied", unit.id).toBe(unit.tenant !== null);
      expect(unit.slots.length, unit.id).toBeGreaterThan(0);
      expect(unitOfRoom(unit.roomId)).toBe(unit);
    }
  });

  it("are some taken by sample businesses and some to let", () => {
    expect(COURT_UNITS.filter((unit) => unit.occupancy === "occupied").length).toBeGreaterThanOrEqual(5);
    expect(COURT_UNITS.filter((unit) => unit.occupancy === "vacant").length).toBeGreaterThanOrEqual(2);
    expect(COURT_UNITS.filter((unit) => unit.floorId === "ground")).toHaveLength(3);
    for (const floor of ["second", "third"]) {
      expect(COURT_UNITS.filter((unit) => unit.floorId === floor)).toHaveLength(3);
    }
  });

  it("keep the businesses on the ground floor apart: each shop has one door and no way into another", () => {
    for (const id of ["glow-pharmacy", "naija-phones"]) {
      const shop = def(id);
      expect(shop.outer, id).toBeUndefined();
      expect(allGaps(shop), id).toHaveLength(1);
      expect(shop.openings, id).toBeUndefined();
    }
    // Provisions is reached from the lobby only, and the lobby from the street.
    expect(def("bola-provisions").outer).toBe(stripRoomId(0));
    expect(allGaps(def("bola-provisions"))).toHaveLength(1);
    const portalsOf = (id: string) => PORTALS.filter((portal) => portal.inner === id || portal.outer === id);
    expect(portalsOf("glow-pharmacy").map((portal) => portal.outer)).toEqual(["street"]);
    expect(portalsOf("naija-phones").map((portal) => portal.outer)).toEqual(["street"]);
  });

  it("are on the floor their room says", () => {
    for (const unit of COURT_UNITS) {
      const room = DISTRICT.rooms.get(unit.roomId);
      expect(room && floorOf(DISTRICT, unit.roomId)?.id).toBe(unit.floorId);
    }
    for (const level of [1, 2] as const) {
      expect(def(unitRoomId(level, "a")).elevation).toBe(level * P);
    }
  });
});

describe("walking between floors", () => {
  it("goes from the street through the lobby, the stair core and a hall into a unit, by doorways only", () => {
    const closed = startLift();
    const passable = (portal: (typeof PORTALS)[number]) => portalPassable(portal, closed);
    const via = (space: string, x: number, z: number, y: number) => spaceAfterPortals(space, x, z, y, PORTALS, passable);

    const lobby = def(stripRoomId(0));
    const door = doorPoint(lobby);
    expect(via("street", door.x, door.z + 0.5, 0)).toBe(lobby.id);
    expect(via(lobby.id, STRIP_X, Z.core + 0.4, 0)).toBe(ROOM.stairs);
    // The stair core's doorway to a hall is only there at that hall's height.
    expect(via(ROOM.stairs, STRIP_X, Z.core - 0.5, 0)).toBe(lobby.id);
    expect(via(ROOM.stairs, STRIP_X, Z.core - 0.5, P)).toBe(stripRoomId(1));
    expect(via(ROOM.stairs, STRIP_X, Z.core - 0.5, 2 * P)).toBe(stripRoomId(2));
    expect(via(stripRoomId(1), X.stripE + 0.5, Z.frontSide, P)).toBe("unit-2a");
    expect(via("unit-2a", X.stripE - 0.1, Z.frontSide, P)).toBe(stripRoomId(1));
    expect(via(stripRoomId(2), X.stripW - 0.5, Z.frontSide, 2 * P)).toBe("unit-3b");
  });

  it("only lets anyone into the lift while its doors are open at that floor", () => {
    const lobby = stripRoomId(0);
    const through = (lift: LiftState, space: string, y: number, x: number) =>
      spaceAfterPortals(space, x, Z.side, y, PORTALS, (portal) => portalPassable(portal, lift));
    // 0.4 m past the doorway on the cabin's side, and 0.2 m back on the landing's.
    const cabinSide = X.stripW - 0.4;
    const landingSide = X.stripW + 0.2;
    expect(through(startLift(), lobby, 0, cabinSide)).toBe(lobby);
    expect(through(openLift(0), lobby, 0, cabinSide)).toBe(ROOM.lift);
    // The cabin is at the ground floor, so the second floor's doorway is shut.
    expect(through(openLift(0), stripRoomId(1), P, cabinSide)).toBe(stripRoomId(1));
    expect(through(openLift(2), stripRoomId(2), 2 * P, cabinSide)).toBe(ROOM.lift);
    // From the cabin, the way out is the floor it is at, and nowhere else, and not through shut doors.
    expect(through(openLift(2), ROOM.lift, 2 * P, landingSide)).toBe(stripRoomId(2));
    expect(through(openLift(0), ROOM.lift, 0, landingSide)).toBe(lobby);
    expect(through(startLift(), ROOM.lift, 0, landingSide)).toBe(ROOM.lift);
  });

  it("gives each space the floor height it should have, and the stairs the one under the player", () => {
    const lift = startLift();
    expect(elevationIn("street", 0, 0, 0, lift)).toBe(0);
    expect(elevationIn(stripRoomId(0), STRIP_X, -5, 0, lift)).toBe(0);
    expect(elevationIn(stripRoomId(1), STRIP_X, -5, P, lift)).toBe(P);
    expect(elevationIn("unit-3c", X.stripE + 3, 2, 2 * P, lift)).toBe(2 * P);
    expect(elevationIn(ROOM.lift, X.stripW - 1, Z.side, 0, { ...lift, y: P })).toBe(P);
    // Half way along flight 1 (z 4.55): about a metre up. The spine between the lanes has no floor.
    expect(elevationIn(ROOM.stairs, STRIP_X + 0.9, 4.55, 0.8, lift)).toBeGreaterThan(0.9);
    expect(elevationIn(ROOM.stairs, STRIP_X, 4.55, 0.8, lift)).toBeNull();
    expect(levelAt(0)).toBe(0);
    expect(levelAt(P + 0.4)).toBe(1);
    expect(levelAt(2 * P)).toBe(2);
  });

  it("walks up a flight with the real walking code, not through the spine and not off the stairs", () => {
    // Stand on the ground landing at the foot of flight 1 and walk north (+z) along the east lane.
    const rooms = new Map(court.map((room) => [room.id, { boxes: interiorBoxes(room), bounds: interiorBounds(room) }]));
    const lift = startLift();
    // The lane's middle, clear of the spine and the core's walls on either side.
    let pose = { x: STRIP_X + 1.3, z: Z.core + 0.9, yaw: Math.PI, vx: 0, vz: 0 };
    let y = 0;
    let space: string = ROOM.stairs;
    for (let frame = 0; frame < 180; frame += 1) {
      const next = walkFrame({
        pose,
        input: { forward: 1, strafe: 0 },
        dt: 1 / 60,
        space,
        street: [],
        rooms,
        elevation: {
          y,
          resolve: (where, x, z, previous) => elevationIn(where, x, z, previous, lift),
          portals: PORTALS,
          passable: (portal) => portalPassable(portal, lift),
        },
      });
      expect(Math.abs(next.y - y), "no jump").toBeLessThan(0.1);
      pose = { ...pose, ...next.pose };
      y = next.y;
      space = next.space;
    }
    expect(space).toBe(ROOM.stairs);
    expect(y).toBeGreaterThan(1.5);
  });
});

describe("what is drawn on each floor", () => {
  const owner = (id: string) => roomOwner(DISTRICT.rooms.get(id) as { id: string; buildingId: string; floorId: string }, "interior");
  const drawn = (active: string, y: number, lift: LiftState): Set<string> => {
    const adjacent = adjacentSpaces(active, y, PORTALS, lift);
    return new Set(
      court.map((room) => room.id).filter((id) => isOwnerVisible(owner(id), DISTRICT, { active, adjacent })),
    );
  };

  it("shows a hall and what its open doorways look onto, and no other floor", () => {
    for (const level of [1, 2] as const) {
      const shown = drawn(stripRoomId(level), level * P, startLift());
      expect(shown.has(stripRoomId(level))).toBe(true);
      for (const letter of ["a", "b", "c"] as const) {
        expect(shown.has(unitRoomId(level, letter)), `unit ${level + 1}${letter}`).toBe(true);
      }
      expect(shown.has(ROOM.stairs)).toBe(true);
      // Never the ground floor, the other upper floor, or the closed lift.
      const others = court.filter((room) => room.floorId !== FLOOR_IDS[level] && room.id !== ROOM.stairs && room.id !== ROOM.lift);
      for (const room of others) {
        expect(shown.has(room.id), `${room.id} from level ${level}`).toBe(false);
      }
      expect(shown.has(ROOM.lift)).toBe(false);
    }
  });

  it("shows the lobby with its doorways, and the cabin only when its doors are open there", () => {
    const lobby = stripRoomId(0);
    const closed = drawn(lobby, 0, startLift());
    expect(closed.has(lobby) && closed.has("bola-provisions") && closed.has(ROOM.stairs)).toBe(true);
    expect(closed.has(ROOM.lift)).toBe(false);
    expect(drawn(lobby, 0, openLift(0)).has(ROOM.lift)).toBe(true);
    // The cabin at another floor is not behind the lobby's doors.
    expect(drawn(lobby, 0, openLift(2)).has(ROOM.lift)).toBe(false);
  });

  it("shows only the floor the lift has arrived at from inside the cabin", () => {
    const lift = openLift(2);
    const shown = drawn(ROOM.lift, lift.y, lift);
    expect(shown.has(ROOM.lift)).toBe(true);
    expect(shown.has(stripRoomId(2))).toBe(true);
    expect(shown.has(stripRoomId(0))).toBe(false);
    expect(shown.has(stripRoomId(1))).toBe(false);
  });

  it("shows nothing of the court's inner rooms from the street, even at its doors", () => {
    // The street peeks into rooms with a street door that are near, exactly as the controller does.
    const lobbyDoor = doorPoint(def(stripRoomId(0)));
    const near = new Set(INTERIORS.filter((room) => room.outer === undefined && nearDoor(room, lobbyDoor.x, lobbyDoor.z - 1)).map((room) => room.id));
    expect(near.has(stripRoomId(0))).toBe(true);
    for (const room of court) {
      expect(isOwnerVisible(owner(room.id), DISTRICT, { active: null, near }), room.id).toBe(near.has(room.id));
      if (room.outer !== undefined) {
        expect(near.has(room.id), room.id).toBe(false);
      }
    }
  });
});

describe("collision", () => {
  it("keeps the player out of the lift shaft's walls and lets them through its doorway", () => {
    const cabin = def(ROOM.lift);
    const boxes = interiorBoxes(cabin);
    const bounds = interiorBounds(cabin);
    const inside = { x: (cabin.room.minX + cabin.room.maxX) / 2, z: Z.side };
    expect(blocked(inside.x, inside.z, EXPLORER_RADIUS, boxes, bounds)).toBe(false);
    // Into the north and south walls: blocked. Through the east doorway: open.
    expect(blocked(inside.x, cabin.room.maxZ - 0.3, EXPLORER_RADIUS, boxes, bounds)).toBe(true);
    expect(blocked(cabin.room.maxX - 0.2, Z.side, EXPLORER_RADIUS, boxes, bounds)).toBe(false);
    expect(blocked(cabin.room.maxX - 0.2, Z.side + 1.3, EXPLORER_RADIUS, boxes, bounds)).toBe(true);
  });
});
