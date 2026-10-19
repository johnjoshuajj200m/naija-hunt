import * as THREE from "three";
import { describe, expect, it } from "vitest";

import { DISTRICT } from "./districtModel";
import { INTERIORS } from "./interiorRegistry";
import {
  AMBIENT,
  applyVisibility,
  buildModel,
  destinationsFrom,
  floorOf,
  GROUND_FLOOR,
  isOwnerVisible,
  ownerOf,
  roomOwner,
  STREET_SPACE,
  tagOwner,
  type Connection,
  type Floor,
  type Room,
} from "./spaces";

/**
 * A made-up tower with two floors and three rooms, to check that the records and the visibility rules
 * stand on their own and do not lean on the one-floor shops that exist today.
 */
const GROUND: Floor = { id: "ground", level: 0, elevation: 0, height: 4 };
const FIRST: Floor = { id: "first", level: 1, elevation: 4.2, height: 3.6 };
const rooms: Room[] = [
  { id: "tower-shop", buildingId: "tower", floorId: "ground", unitId: "tower-shop" },
  { id: "tower-kiosk", buildingId: "tower", floorId: "ground", unitId: "kiosk" },
  { id: "tower-office", buildingId: "tower", floorId: "first", unitId: "office-1" },
  { id: "other-shop", buildingId: "other", floorId: "ground", unitId: "other-shop" },
];
const stairs: Connection = {
  id: "tower-stairs",
  kind: "stairs",
  stops: [
    { space: "tower-shop", x: 1, z: 1, yaw: 0 },
    { space: "tower-office", x: 2, z: 2, yaw: 0 },
  ],
};
const lift: Connection = {
  id: "tower-lift",
  kind: "lift",
  stops: [
    { space: "tower-kiosk", x: 5, z: 5, yaw: 0 },
    { space: "tower-office", x: 6, z: 6, yaw: 0 },
  ],
};
const tower = buildModel(
  new Map([
    ["tower", [GROUND, FIRST]],
    ["other", [GROUND]],
  ]),
  rooms,
  [stairs, lift],
);

const withOwner = (name: string, owner: Parameters<typeof tagOwner>[1] | undefined): THREE.Object3D => {
  const object = new THREE.Group();
  object.name = name;
  return owner ? tagOwner(object, owner) : object;
};

function scene() {
  const root = new THREE.Group();
  const objects = {
    street: withOwner("street", undefined),
    sky: withOwner("sky", AMBIENT),
    shop: withOwner("shop", roomOwner(rooms[0] as Room, "interior")),
    shopView: withOwner("shop-view", roomOwner(rooms[0] as Room, "view")),
    shopDoor: withOwner("shop-door", roomOwner(rooms[0] as Room, "door")),
    kiosk: withOwner("kiosk", roomOwner(rooms[1] as Room, "interior")),
    office: withOwner("office", roomOwner(rooms[2] as Room, "interior")),
    other: withOwner("other", roomOwner(rooms[3] as Room, "interior")),
    // Something fixed to the first floor of the tower: a corridor light, a balustrade, a ceiling.
    firstFloorFittings: withOwner("first-floor", { kind: "floor", buildingId: "tower", floorId: "first" }),
    groundFloorFittings: withOwner("ground-floor", { kind: "floor", buildingId: "tower", floorId: "ground" }),
  };
  for (const object of Object.values(objects)) {
    root.add(object);
  }
  return { root, objects };
}

const drawn = (root: THREE.Object3D) => root.children.filter((child) => child.visible).map((child) => child.name);

describe("what is drawn follows ownership", () => {
  it("draws the street, the sky and nothing indoors for a player on the street with no door near", () => {
    const { root } = scene();
    applyVisibility(root, tower, { active: null });
    expect(drawn(root).sort()).toEqual(["shop-door", "sky", "street"]);
  });

  it("draws only the rooms whose door is near, from the street", () => {
    const { root } = scene();
    applyVisibility(root, tower, { active: null, near: new Set(["tower-shop"]) });
    expect(drawn(root).sort()).toEqual(["shop", "shop-door", "sky", "street"]);
  });

  it("draws only the room the player is in, with no street, no other building and no other floor", () => {
    const { root } = scene();
    applyVisibility(root, tower, { active: "tower-shop", near: new Set(["tower-kiosk"]) });
    // The room, its view out and its own door. Not the kiosk next door, not the office above, and not the
    // street (so no roof, no upper floor and no unrelated building can show through the room's camera).
    expect(drawn(root).sort()).toEqual(["ground-floor", "shop", "shop-door", "shop-view", "sky"]);
  });

  it("draws a room on the upper floor with that floor's fittings and none of the floor below", () => {
    const { root } = scene();
    applyVisibility(root, tower, { active: "tower-office" });
    expect(drawn(root).sort()).toEqual(["first-floor", "office", "sky"]);
  });

  it("never draws a floor's fittings for a player in another building or on the street", () => {
    const { root, objects } = scene();
    applyVisibility(root, tower, { active: "other-shop" });
    expect(objects.firstFloorFittings.visible).toBe(false);
    expect(objects.groundFloorFittings.visible).toBe(false);
    applyVisibility(root, tower, { active: null });
    expect(objects.groundFloorFittings.visible).toBe(false);
  });

  it("does not depend on what anything is called", () => {
    const { root, objects } = scene();
    objects.office.name = "totally-unrelated";
    objects.street.name = "tower-office";
    applyVisibility(root, tower, { active: "tower-office" });
    expect(objects.office.visible).toBe(true);
    expect(objects.street.visible).toBe(false);
  });

  it("treats a thing with no owner as the street", () => {
    expect(isOwnerVisible(undefined, tower, { active: null })).toBe(true);
    expect(isOwnerVisible(undefined, tower, { active: "tower-shop" })).toBe(false);
    expect(isOwnerVisible(undefined, tower, { active: "tower-shop", streetVisible: true })).toBe(true);
  });

  it("reads back the tag it was given", () => {
    const owner = roomOwner(rooms[2] as Room, "interior");
    expect(ownerOf(tagOwner(new THREE.Group(), owner))).toEqual(owner);
    expect(ownerOf(new THREE.Group())).toBeUndefined();
  });
});

describe("the district records", () => {
  it("keeps building, floor, room, connection and tenant separate", () => {
    expect(tower.buildings.get("tower")?.floors.map((floor) => floor.id)).toEqual(["ground", "first"]);
    expect(tower.rooms.get("tower-office")).toMatchObject({ buildingId: "tower", floorId: "first", unitId: "office-1" });
    // Two businesses in one building, on the same floor, are two rooms with their own tenants.
    const same = [...tower.rooms.values()].filter((room) => room.buildingId === "tower" && room.floorId === "ground");
    expect(same.map((room) => room.unitId).sort()).toEqual(["kiosk", "tower-shop"]);
  });

  it("knows how high a room's floor is", () => {
    expect(floorOf(tower, "tower-office")?.elevation).toBe(4.2);
    expect(floorOf(tower, "tower-shop")?.elevation).toBe(0);
    expect(floorOf(tower, "nowhere")).toBeUndefined();
  });

  it("says where stairs and a lift lead from each room, and where a lift can lead to several", () => {
    expect(destinationsFrom(stairs, "tower-shop").map((stop) => stop.space)).toEqual(["tower-office"]);
    expect(destinationsFrom(stairs, "tower-office").map((stop) => stop.space)).toEqual(["tower-shop"]);
    expect(destinationsFrom(stairs, "other-shop")).toEqual([]);
    const threeStops: Connection = {
      id: "big-lift",
      kind: "lift",
      stops: [
        { space: "a", x: 0, z: 0, yaw: 0 },
        { space: "b", x: 0, z: 0, yaw: 0 },
        { space: "c", x: 0, z: 0, yaw: 0 },
      ],
    };
    expect(destinationsFrom(threeStops, "b").map((stop) => stop.space)).toEqual(["a", "c"]);
  });

  it("refuses a room in a building or on a floor that does not exist, a repeated room, and a stair to nowhere", () => {
    const floors = new Map([["tower", [GROUND]]]);
    expect(() => buildModel(floors, [{ id: "r", buildingId: "ghost", floorId: "ground", unitId: "r" }], [])).toThrow(/building that does not exist/);
    expect(() => buildModel(floors, [{ id: "r", buildingId: "tower", floorId: "first", unitId: "r" }], [])).toThrow(/floor that does not exist/);
    const room: Room = { id: "r", buildingId: "tower", floorId: "ground", unitId: "r" };
    expect(() => buildModel(floors, [room, room], [])).toThrow(/share the id/);
    const toNowhere: Connection = { id: "c", kind: "stairs", stops: [{ space: STREET_SPACE, x: 0, z: 0, yaw: 0 }, { space: "ghost", x: 0, z: 0, yaw: 0 }] };
    expect(() => buildModel(floors, [room], [toNowhere])).toThrow(/space that does not exist/);
  });
});

describe("the real district", () => {
  it("has a room for every interior, on its own floor of its building, and a door into each from the street or the room it opens off", () => {
    expect(DISTRICT.rooms.size).toBe(INTERIORS.length);
    for (const def of INTERIORS) {
      const room = DISTRICT.rooms.get(def.id);
      expect(room, def.id).toMatchObject({ buildingId: def.buildingId, floorId: def.floorId });
      // A room with a street door is on the ground floor; Palm Court's upper rooms are on theirs.
      if (def.outer === undefined) {
        expect(def.floorId, def.id).toBe(GROUND_FLOOR);
      }
      const from = def.outer ?? STREET_SPACE;
      const door = DISTRICT.connections.find((connection) => connection.id === `${def.id}-door`);
      expect(door?.kind).toBe("door");
      expect(destinationsFrom(door as Connection, from).map((stop) => stop.space)).toEqual([def.id]);
      expect(destinationsFrom(door as Connection, def.id).map((stop) => stop.space)).toEqual([from]);
    }
  });

  it("joins Palm Court's three floors by stairs and a lift, and puts every floor in the building's record", () => {
    const stairs = DISTRICT.connections.find((connection) => connection.kind === "stairs");
    const lift = DISTRICT.connections.find((connection) => connection.kind === "lift");
    expect(stairs?.stops.map((stop) => stop.space)).toEqual(["palm-court-lobby", "palm-court-hall-2", "palm-court-hall-3"]);
    expect(lift?.stops.map((stop) => stop.space)).toEqual(["palm-court-lobby", "palm-court-hall-2", "palm-court-hall-3"]);
    expect(DISTRICT.buildings.get("palm-court")?.floors.map((floor) => floor.elevation)).toEqual([0, 4.1, 8.2]);
    expect(DISTRICT.buildings.get("palm-court")?.floors.map((floor) => floor.level)).toEqual([0, 1, 2]);
  });

  it("gives every room a distinct tenant, so rooms and tenants can be told apart", () => {
    const units = [...DISTRICT.rooms.values()].map((room) => room.unitId);
    expect(new Set(units).size).toBe(units.length);
  });
});
