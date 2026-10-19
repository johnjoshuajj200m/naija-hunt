import * as THREE from "three";
import { describe, expect, it } from "vitest";

import { businessById, type BusinessDef } from "./businesses";
import { collisionBoxes } from "./collision";
import { worldEntrance } from "./entranceWorld";
import { DISTRICT } from "./districtModel";
import { interiorBlocks, interiorBounds, interiorBoxes, glassDoorName, inwardOf, roomName, vignetteName } from "./interiors";
import { AMBIENT, applyVisibility, roomOwner, tagOwner } from "./spaces";
import { walk } from "./testKit";
import { INTERIORS } from "./interiorRegistry";
import { interactTarget } from "./interaction";
import { COUNTER, MAMA_PUT_INTERIOR, ROOM_NAME } from "./mamaPut";
import { blocked, EXPLORER_RADIUS, PLAY_BOUNDS } from "./movement";
import { consumeInteract, holdKey, releaseAllInput } from "./playInput";

const DIMENSIONS = (businessById("mama-put") as BusinessDef).room;
const street = collisionBoxes();
const room = interiorBoxes(MAMA_PUT_INTERIOR);
const bounds = interiorBounds(MAMA_PUT_INTERIOR);
const INSIDE_POSE = MAMA_PUT_INTERIOR.insidePose;
const entrance = worldEntrance("mama-put");
const OUTSIDE_POSE = entrance.outsidePose;
const inward = inwardOf(MAMA_PUT_INTERIOR.facing);

/** A point `u` metres in from Mama Put's door plane and `s` metres along the wall (negative u is the street). */
const at = (u: number, s = 0) => ({
  x: entrance.door.x + inward[0] * u - inward[1] * s,
  z: entrance.door.z + inward[1] * u + inward[0] * s,
});

describe("Mama Put door", () => {
  it("opens only the doorway and keeps the rest of the shop solid from the street", () => {
    expect(blocked(OUTSIDE_POSE.x, OUTSIDE_POSE.z, EXPLORER_RADIUS, street, PLAY_BOUNDS)).toBe(false);
    for (const u of [-1, 0, 0.5]) {
      const p = at(u);
      expect(blocked(p.x, p.z, EXPLORER_RADIUS, street, PLAY_BOUNDS), `u=${u}`).toBe(false);
    }
    // Beside the doorway, and deep in the shop, the street collision is a solid building.
    for (const spot of [at(0.5, 1.8), at(0.5, -1.8), at(6, 4), at(8, -3)]) {
      expect(blocked(spot.x, spot.z, EXPLORER_RADIUS, street, PLAY_BOUNDS)).toBe(true);
    }
  });

  it("blocks the interior walls, the counter and the shelves, and leaves a path", () => {
    expect(blocked(INSIDE_POSE.x, INSIDE_POSE.z, EXPLORER_RADIUS, room, bounds)).toBe(false);
    const counterCentre = { x: (COUNTER.minX + COUNTER.maxX) / 2, z: (COUNTER.minZ + COUNTER.maxZ) / 2 };
    expect(blocked(counterCentre.x, counterCentre.z, EXPLORER_RADIUS, room, bounds)).toBe(true);
    // The back wall, and either side wall, stop the player.
    for (const spot of [at(DIMENSIONS.depth + 1, 0), at(6, DIMENSIONS.sMin - 1), at(6, DIMENSIONS.sMax + 1)]) {
      expect(blocked(spot.x, spot.z, EXPLORER_RADIUS, room, bounds)).toBe(true);
    }
    const beside = walk(INSIDE_POSE, { forward: 1, strafe: 0 }, 0.4, room, bounds);
    expect(blocked(beside.x, beside.z, EXPLORER_RADIUS, room, bounds)).toBe(false);
    expect(Math.hypot(beside.x - INSIDE_POSE.x, beside.z - INSIDE_POSE.z)).toBeGreaterThan(0.2);
  });

  it("offers the door only from the matching side", () => {
    expect(interactTarget("street", OUTSIDE_POSE.x, OUTSIDE_POSE.z, false)).toEqual({
      kind: "door",
      action: "enter",
      entranceId: "mama-put",
    });
    const far = at(-12);
    expect(interactTarget("street", far.x, far.z, false)).toBeNull();
    expect(interactTarget("mama-put", MAMA_PUT_INTERIOR.exitAnchor.x, MAMA_PUT_INTERIOR.exitAnchor.z, false)).toEqual({
      kind: "door",
      action: "exit",
      entranceId: "mama-put",
    });
    expect(interactTarget("mama-put", INSIDE_POSE.x, INSIDE_POSE.z, false)).toBeNull();
    const middle = at(9, 0);
    expect(interactTarget("mama-put", middle.x, middle.z, false)).toBeNull();
  });

  it("puts the entered pose inside the room and the street pose outside the wall", () => {
    expect(blocked(INSIDE_POSE.x, INSIDE_POSE.z, EXPLORER_RADIUS, room, bounds)).toBe(false);
    expect(blocked(INSIDE_POSE.x, INSIDE_POSE.z, EXPLORER_RADIUS, street, PLAY_BOUNDS)).toBe(true);
    expect(blocked(OUTSIDE_POSE.x, OUTSIDE_POSE.z, EXPLORER_RADIUS, street, PLAY_BOUNDS)).toBe(false);
  });

  it("builds the walls of a complete room: five walls and the furniture, with the door wall left open", () => {
    const kinds = interiorBlocks(MAMA_PUT_INTERIOR).map((block) => block.kind);
    expect(kinds.filter((kind) => kind === "wall")).toHaveLength(5);
    expect(kinds.length).toBeGreaterThan(12);
    expect(ROOM_NAME).toBe("mama-put-interior");
  });
});

describe("what is drawn", () => {
  const district = new THREE.Group();
  const streetMesh = new THREE.Group();
  streetMesh.name = "street";
  const sky = new THREE.Group();
  sky.name = "sky";
  tagOwner(sky, AMBIENT);
  const owned = (name: string, def: (typeof INTERIORS)[number], part: "interior" | "view" | "door") =>
    tagOwner(Object.assign(new THREE.Group(), { name }), roomOwner(def, part));
  const rooms = INTERIORS.map((def) => owned(roomName(def), def, "interior"));
  const backdrops = INTERIORS.map((def) => owned(vignetteName(def), def, "view"));
  const doors = INTERIORS.map((def) => owned(glassDoorName(def.id), def, "door"));
  district.add(streetMesh, sky, ...rooms, ...backdrops, ...doors);
  const index = (id: string) => INTERIORS.findIndex((def) => def.id === id);
  const visible = (groups: THREE.Group[]) => groups.map((group) => group.visible);

  it("shows only the active room and its backdrop in a room, and hides the street", () => {
    applyVisibility(district, DISTRICT, { active: "mama-put" });
    const mama = index("mama-put");
    expect(visible(rooms).map((value, i) => value === (i === mama))).not.toContain(false);
    expect(visible(backdrops).map((value, i) => value === (i === mama))).not.toContain(false);
    expect(streetMesh.visible).toBe(false);
    // The distant sky dome is not part of the street, so the view out of the door has a sky.
    expect(sky.visible).toBe(true);
    expect(doors[mama]?.visible).toBe(true);
    expect(doors.filter((door, i) => i !== mama && door.visible)).toHaveLength(0);
  });

  it("can keep the street drawn with the room, with no backdrop, when asked to", () => {
    applyVisibility(district, DISTRICT, { active: "mama-put", streetVisible: true });
    expect(streetMesh.visible).toBe(true);
    expect(rooms[index("mama-put")]?.visible).toBe(true);
    expect(backdrops.some((group) => group.visible)).toBe(false);
  });

  it("draws a room through its doorway from the street only when its door is near, and never twice over", () => {
    applyVisibility(district, DISTRICT, { active: null, near: new Set(["cold-room"]) });
    expect(streetMesh.visible).toBe(true);
    expect(visible(rooms).filter(Boolean)).toHaveLength(1);
    expect(rooms[index("cold-room")]?.visible).toBe(true);
    expect(backdrops.some((group) => group.visible)).toBe(false);
    expect(doors.every((door) => door.visible)).toBe(true);
    applyVisibility(district, DISTRICT, { active: null });
    expect(rooms.some((group) => group.visible)).toBe(false);
  });
});
describe("interact press", () => {
  it("fires once while E is held, so a door cannot be entered and left in one hold", () => {
    holdKey("KeyE");
    expect(consumeInteract()).toBe(true);
    expect(consumeInteract()).toBe(false);
    releaseAllInput();
  });
});
