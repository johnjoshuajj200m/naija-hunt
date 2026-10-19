import type { Object3D } from "three";

/**
 * Where things are: buildings, their floors, the rooms on each floor, and the connections between spaces.
 * Each is its own record, so none of them is implied by another:
 *
 *   Building  -> has Floors (a level, a height and an elevation)
 *   Floor     -> has Rooms
 *   Room      -> one walkable space, owned by a floor. A room is also the unit a business occupies.
 *   Connection -> a door, a stair or a lift. It lists the stops it joins; a stop is a place in one space.
 *
 * Today every building has one floor ("ground") and every room is reached by a street door. The records do
 * not assume that: a room on the second floor is a Room whose floor has level 1, reached by a Connection
 * of kind "stairs" whose stops are in two different rooms. Scene objects say which of these they belong to
 * with a tag (`tagOwner`), and what is drawn follows the tags. Nothing is hidden by name.
 */

/** The space the player is in: the street, or a room (whose id is unique across the whole district). */
export type SpaceId = string;
export const STREET_SPACE: SpaceId = "street";

export const GROUND_FLOOR = "ground";

export type Floor = {
  id: string;
  /** 0 is the ground floor; 1 is the floor above. */
  level: number;
  /** Height of the floor above the street, metres. Cameras and bodies on this floor are raised by it. */
  elevation: number;
  /** Floor to ceiling, metres. */
  height: number;
};

export type Building = { id: string; floors: Floor[] };

export type Room = {
  id: SpaceId;
  buildingId: string;
  floorId: string;
  /** The business or tenant that has the room. Rooms can change hands; the room's id and geometry do not. */
  unitId: string;
};

export type ConnectionKind = "door" | "stairs" | "lift";

/** A place in one space where a connection arrives or leaves. */
export type Stop = { space: SpaceId; x: number; z: number; yaw: number };

export type Connection = {
  id: string;
  kind: ConnectionKind;
  /** A door or a stair joins two stops. A lift joins any number, one per floor it serves. */
  stops: readonly Stop[];
};

export type DistrictModel = {
  buildings: ReadonlyMap<string, Building>;
  rooms: ReadonlyMap<SpaceId, Room>;
  connections: readonly Connection[];
};

/** What a scene object belongs to. An object with no tag belongs to the street. */
export type Owner =
  | { kind: "ambient" }
  | { kind: "floor"; buildingId: string; floorId: string }
  | { kind: "room"; buildingId: string; floorId: string; roomId: SpaceId; part: "interior" | "view" | "door" };

const OWNER = "owner";

export function tagOwner<T extends Object3D>(object: T, owner: Owner): T {
  object.userData[OWNER] = owner;
  return object;
}

export function ownerOf(object: Object3D): Owner | undefined {
  const value: unknown = object.userData[OWNER];
  return value === undefined ? undefined : (value as Owner);
}

export const AMBIENT: Owner = { kind: "ambient" };

export function roomOwner(room: Pick<Room, "id" | "buildingId" | "floorId">, part: "interior" | "view" | "door"): Owner {
  return { kind: "room", buildingId: room.buildingId, floorId: room.floorId, roomId: room.id, part };
}

export type View = {
  /** The room the player is in, or null on the street. */
  active: SpaceId | null;
  /** Draw the street. The default is: yes on the street, no in a room. */
  streetVisible?: boolean;
  /** Rooms (by id) that may be drawn from the street, through their doorway. */
  near?: ReadonlySet<SpaceId>;
  /** Rooms (by id) seen from inside a room, through a doorway that is open to them: a hall's units, the cabin of a lift whose doors are open. */
  adjacent?: ReadonlySet<SpaceId>;
};

/**
 * Whether an object is drawn. A room is drawn when the player is in it (or, from the street, when its door
 * is near). The view out of a room's door and its door leaf follow that room. A floor's own fittings are
 * drawn only for someone on that floor of that building. Everything untagged is the street.
 */
export function isOwnerVisible(owner: Owner | undefined, model: Pick<DistrictModel, "rooms">, view: View): boolean {
  const streetVisible = view.streetVisible ?? view.active === null;
  if (owner === undefined) {
    return streetVisible;
  }
  switch (owner.kind) {
    case "ambient":
      return true;
    case "floor": {
      const here = view.active === null ? undefined : model.rooms.get(view.active);
      return here !== undefined && here.buildingId === owner.buildingId && here.floorId === owner.floorId;
    }
    case "room":
      if (owner.part === "interior") {
        return (
          owner.roomId === view.active ||
          (streetVisible && (view.near?.has(owner.roomId) ?? false)) ||
          (view.adjacent?.has(owner.roomId) ?? false)
        );
      }
      if (owner.part === "view") {
        return owner.roomId === view.active && !streetVisible;
      }
      return streetVisible || owner.roomId === view.active || (view.adjacent?.has(owner.roomId) ?? false);
  }
}

/** Shows and hides the root's children by what they belong to. Owners sit on the root's direct children. */
export function applyVisibility(root: Object3D, model: Pick<DistrictModel, "rooms">, view: View): void {
  for (const child of root.children) {
    child.visible = isOwnerVisible(ownerOf(child), model, view);
  }
}

/** Builds the records from the rooms and doors the district has. Every room must belong to a known floor. */
export function buildModel(
  floors: ReadonlyMap<string, readonly Floor[]>,
  rooms: readonly Room[],
  connections: readonly Connection[],
): DistrictModel {
  const buildings = new Map<string, Building>();
  for (const [id, list] of floors) {
    buildings.set(id, { id, floors: [...list] });
  }
  const roomMap = new Map<SpaceId, Room>();
  for (const room of rooms) {
    const building = buildings.get(room.buildingId);
    if (!building) {
      throw new Error(`Room "${room.id}" is in a building that does not exist: ${room.buildingId}.`);
    }
    if (!building.floors.some((floor) => floor.id === room.floorId)) {
      throw new Error(`Room "${room.id}" is on a floor that does not exist: ${room.buildingId}/${room.floorId}.`);
    }
    if (roomMap.has(room.id)) {
      throw new Error(`Two rooms share the id "${room.id}".`);
    }
    roomMap.set(room.id, room);
  }
  for (const connection of connections) {
    for (const stop of connection.stops) {
      if (stop.space !== STREET_SPACE && !roomMap.has(stop.space)) {
        throw new Error(`Connection "${connection.id}" arrives in a space that does not exist: ${stop.space}.`);
      }
    }
  }
  return { buildings, rooms: roomMap, connections };
}

/** Where a connection leads from a given space: the other stops of the connection, not the one you are at. */
export function destinationsFrom(connection: Connection, space: SpaceId): Stop[] {
  const here = connection.stops.findIndex((stop) => stop.space === space);
  if (here < 0) {
    return [];
  }
  return connection.stops.filter((_, index) => index !== here);
}

/** The floor record a room stands on. */
export function floorOf(model: DistrictModel, roomId: SpaceId): Floor | undefined {
  const room = model.rooms.get(roomId);
  return room ? model.buildings.get(room.buildingId)?.floors.find((floor) => floor.id === room.floorId) : undefined;
}
