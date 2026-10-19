import * as THREE from "three";

import type { JunctionKit } from "../scenes/junction/junctionKit";
import { FLOOR_PITCH } from "./court/courtGeometry";
import { DOOR_HEAD, placeOnFace, WALL } from "./entrances";
import { buildProp } from "./interiorProps";
import {
  allGaps,
  interiorBlocks,
  roomHeight,
  roomName,
  ROOM_HEIGHT,
  splitWall,
  vignetteName,
  type InteriorDef,
} from "./interiors";
import type { Aabb } from "./movement";
import { roomOwner, tagOwner } from "./spaces";

type Vec3 = [number, number, number];

/** The height of the floor: level with the pavement outside, so walking in is not a step. */
export const FLOOR_Y = 0.15;

const centreOf = (box: Aabb): { x: number; z: number } => ({ x: (box.minX + box.maxX) / 2, z: (box.minZ + box.maxZ) / 2 });

/** How far the street vignette reaches either side of the door, and how far out the backdrop stands. */
const VIGNETTE_SPAN = 22;
const PORCH = 3;
const KERB = 0.25;
const ROAD = 10;
const BACKDROP_DISTANCE = 38;

/** Width of the door frame's post on each side of an inside doorway. */
const JAMB = 0.08;

export type BuiltInterior = {
  /** The room: floor, ceiling, the inside skin of its walls and the furniture. Drawn from the street when its door is near. */
  room: THREE.Group;
  /** The view out of the door while the street is hidden. Drawn only when the player is deep inside. Null for a room that is not on the street. */
  vignette: THREE.Group | null;
};

/** How many floors a tall room (a stair core) spans. An ordinary room is one. */
export function levelsOf(def: Pick<InteriorDef, "height">): number {
  return Math.max(1, Math.round((roomHeight(def) - ROOM_HEIGHT) / FLOOR_PITCH) + 1);
}

/**
 * A room, built only from materials the street already uses (concrete, plaster, brick, asphalt) and the
 * kit's flat-coloured prop material, so it adds no texture. Hidden until it is needed. The caller merges
 * each group by material.
 *
 * The room and the vignette are separate groups. The room is what you see through the doorway from the
 * street, so it carries only the inside skin of its walls (the street's shell draws the rest). The
 * vignette is what you see out of the door once the street is hidden: a strip of pavement and road and
 * one far wall, placed where the real street and the opposite building are.
 *
 * A room on an upper floor sits at its floor's elevation (the group is raised, so everything in it is). A
 * room that is not on the street has no vignette: its doors lead to other rooms, which are drawn beside it.
 */
export function buildInterior(kit: JunctionKit, def: InteriorDef): BuiltInterior {
  const room = new THREE.Group();
  room.name = roomName(def);
  tagOwner(room, roomOwner(def, "interior"));
  room.position.y = def.elevation ?? 0;
  const onStreet = def.outer === undefined;
  const vignette = new THREE.Group();
  vignette.name = vignetteName(def);
  tagOwner(vignette, roomOwner(def, "view"));

  const box = def.room;
  const height = roomHeight(def);
  const { x: cx, z: cz } = centreOf(box);
  const innerW = box.maxX - box.minX - WALL * 2;
  const innerD = box.maxZ - box.minZ - WALL * 2;

  const slab = FLOOR_Y - 0.05;
  kit.box(room, "concrete", [innerW, 0.1, innerD], [cx, slab, cz], { tint: def.tint.floor, cast: false });
  kit.box(room, "concrete", [innerW, 0.12, innerD], [cx, height + 0.06, cz], { tint: def.tint.ceiling, cast: false });

  const gaps = allGaps(def);
  // The floor under every doorway, level with the room's, so the way through is not a hole in the wall.
  for (const gap of gaps) {
    const sill = placeOnFace(box, gap.facing, 0, WALL, gap.along - gap.half, gap.along + gap.half);
    box3(room, kit, "concrete", sill, FLOOR_Y - 0.1, FLOOR_Y, def.tint.ceiling);
  }

  for (const block of interiorBlocks(def)) {
    if (block.kind === "wall") {
      box3(room, kit, "painted_plaster_wall", splitWall(def, block).skin, 0, height, def.tint.wall);
    } else if (block.kind === "column") {
      box3(room, kit, "painted_plaster_wall", block, 0, height, def.tint.wall);
    } else {
      buildProp(room, kit, def, block);
    }
  }
  // Wall above every doorway, so the gap stops at the lintel and not at the ceiling. A tall room has one lintel per floor.
  const levels = levelsOf(def);
  gaps.forEach((gap, index) => {
    const area = placeOnFace(box, gap.facing, 0, WALL, gap.along - gap.half, gap.along + gap.half);
    const lintel = splitWall(def, area).skin;
    const shared = index === 0 && onStreet;
    // Only the primary door of a room on the street is a gap in the street's wall. Every other gap is a
    // doorway between two rooms, drawn with its own posts so the wall's hollow is never seen.
    for (let level = 0; level < levels; level += 1) {
      const base = level * FLOOR_PITCH;
      const top = level === levels - 1 ? height : (level + 1) * FLOOR_PITCH;
      box3(room, kit, "painted_plaster_wall", lintel, base + DOOR_HEAD, top, def.tint.wall);
    }
    if (!shared) {
      addPosts(room, kit, def, gap);
    }
  });

  addLights(room, kit, def);
  if (onStreet) {
    addVignette(vignette, kit, def);
  }
  return { room, vignette: onStreet ? vignette : null };
}

/** The two posts of an inside doorway, full wall thickness, from the floor to the lintel. They hide the gap in the wall. */
function addPosts(room: THREE.Group, kit: JunctionKit, def: InteriorDef, gap: { facing: InteriorDef["facing"]; along: number; half: number }): void {
  const levels = levelsOf(def);
  for (const side of [-1, 1]) {
    const edge = gap.along + side * gap.half;
    // Inside the gap, against each edge, so the posts never overlap the wall skins on either side.
    const post = placeOnFace(def.room, gap.facing, 0, WALL, side < 0 ? edge : edge - JAMB, side < 0 ? edge + JAMB : edge);
    for (let level = 0; level < levels; level += 1) {
      const base = level * FLOOR_PITCH;
      box3(room, kit, "concrete", post, base + FLOOR_Y, base + DOOR_HEAD, "#cfc6b6");
    }
  }
}

/** Pale ceiling strips, so the ceiling reads as lit and not as a flat lid. No light is emitted. */
function addLights(room: THREE.Group, kit: JunctionKit, def: InteriorDef): void {
  const box = def.room;
  const { x: cx, z: cz } = centreOf(box);
  const alongX = box.maxX - box.minX >= box.maxZ - box.minZ;
  const length = (alongX ? box.maxX - box.minX : box.maxZ - box.minZ) * 0.5;
  const spread = (alongX ? box.maxZ - box.minZ : box.maxX - box.minX) * 0.28;
  const y = roomHeight(def) - 0.03;
  for (const offset of [-spread, spread]) {
    kit.flat(room, alongX ? [length, 0.05, 0.22] : [0.22, 0.05, length], [alongX ? cx : cx + offset, y, alongX ? cz + offset : cz], {
      tint: "#fff7e2",
    });
  }
}

export function box3(
  room: THREE.Group,
  kit: JunctionKit,
  id: "painted_plaster_wall" | "concrete" | "brick_pavement_02" | "asphalt_02",
  area: Aabb,
  y0: number,
  y1: number,
  tint: string,
): void {
  const size: Vec3 = [area.maxX - area.minX, y1 - y0, area.maxZ - area.minZ];
  const position: Vec3 = [(area.minX + area.maxX) / 2, (y0 + y1) / 2, (area.minZ + area.maxZ) / 2];
  kit.box(room, id, size, position, { tint, cast: false });
}

function addVignette(group: THREE.Group, kit: JunctionKit, def: InteriorDef): void {
  const { room: box, facing, doorAlong } = def;
  const v0 = doorAlong - VIGNETTE_SPAN;
  const v1 = doorAlong + VIGNETTE_SPAN;
  const roadStart = PORCH + KERB;
  const roadEnd = roadStart + ROAD;

  // Pavement outside the door, level with the floor.
  box3(group, kit, "brick_pavement_02", placeOnFace(box, facing, -PORCH, 0, v0, v1), FLOOR_Y - 0.08, FLOOR_Y, "#e6cdb4");
  // Kerb stone, then the road a step lower, then paving across to the far buildings.
  box3(group, kit, "concrete", placeOnFace(box, facing, -roadStart, -PORCH, v0, v1), -0.15, FLOOR_Y, "#cfc6b6");
  box3(group, kit, "asphalt_02", placeOnFace(box, facing, -roadEnd, -roadStart, v0, v1), -0.23, 0, "#8d8a84");
  box3(group, kit, "brick_pavement_02", placeOnFace(box, facing, -BACKDROP_DISTANCE, -roadEnd, v0, v1), -0.23, FLOOR_Y, "#cdb69a");
  // The building across the road.
  box3(
    group,
    kit,
    "painted_plaster_wall",
    placeOnFace(box, facing, -BACKDROP_DISTANCE - 0.4, -BACKDROP_DISTANCE, v0, v1),
    -0.23,
    def.vignette.backdropHeight,
    def.vignette.backdropTint,
  );
}
