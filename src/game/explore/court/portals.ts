import { FACING } from "../../scenes/junction/frontage";
import { localOf, type DoorFrame } from "../automaticDoor";
import { ENTER_LIMIT, ENTER_PLANE, EXIT_PLANE, frameOfEntrance } from "../doorway";
import { WORLD_ENTRANCES } from "../entranceWorld";
import type { ResolvedEntrance } from "../entrances";
import { INTERIORS } from "../interiorRegistry";
import { doorHalfOf, doorPoint, inwardOf, STREET, type InteriorDef } from "../interiors";
import type { SpaceId } from "../spaces";
import { LEVELS, ROOM, stripRoomId, type Level } from "./courtIds";
import { floorElevation, liftPassable, type LiftState } from "./lift";
import { resolveStairY } from "./stairs";

/**
 * Doorways between spaces. The street and every room share one set of world coordinates, so going through a
 * doorway is not a teleport: the moment the player's centre crosses the door line the space changes and the
 * position stays exactly where it is (doorway.ts has the same rule for street doors, which are portals too).
 *
 * A portal joins an `outer` space to an `inner` one. Its frame is the outer face of the inner room's door
 * wall, with the inward axis pointing into the inner room. It sits at one height, so the stair core can have
 * a doorway to the hall of each floor at the same place without mistaking one for another.
 */

export type PortalKind = "street" | "doorway" | "lift";

export type Portal = {
  id: string;
  kind: PortalKind;
  outer: SpaceId;
  inner: SpaceId;
  frame: DoorFrame;
  /** Height of the floor at this doorway, metres. */
  y: number;
  /** For a lift doorway, the floor it is on. */
  level?: Level;
};

/** How far the player's height may be from a portal's for it to apply. A storey is 4.1 m apart. */
export const PORTAL_LEVEL_TOLERANCE = 0.6;

/** The frame of an inner room's primary door. */
export function roomDoorFrame(def: InteriorDef): DoorFrame {
  const door = doorPoint(def);
  const inward = inwardOf(def.facing);
  return { x: door.x, z: door.z, inward: [inward[0], inward[1]], tangent: FACING[def.facing].tangent, half: doorHalfOf(def) };
}

/**
 * Every portal there is: one per open street door, one per room that opens onto another room, and the lift's
 * doorway on the two upper floors (the lift room's own primary door is the ground floor's).
 */
export function buildPortals(interiors: readonly InteriorDef[], entrances: readonly Pick<ResolvedEntrance, "id" | "door" | "facing" | "half">[]): Portal[] {
  const portals: Portal[] = entrances.map((entrance) => ({
    id: `${entrance.id}:street`,
    kind: "street",
    outer: STREET,
    inner: entrance.id,
    frame: frameOfEntrance(entrance),
    y: 0,
  }));
  for (const def of interiors) {
    if (def.outer === undefined) {
      continue;
    }
    const isLift = def.id === ROOM.lift;
    portals.push({
      id: `${def.id}:door`,
      kind: isLift ? "lift" : "doorway",
      outer: def.outer,
      inner: def.id,
      frame: roomDoorFrame(def),
      y: def.elevation ?? 0,
      ...(isLift ? { level: 0 as Level } : {}),
    });
    if (isLift) {
      for (const level of LEVELS.filter((entry) => entry > 0)) {
        portals.push({
          id: `${def.id}:door-${level}`,
          kind: "lift",
          outer: stripRoomId(level),
          inner: def.id,
          frame: roomDoorFrame(def),
          y: floorElevation(level),
          level,
        });
      }
    }
  }
  return portals;
}

/**
 * The space the player is in after this frame's movement, at height `y`. Walking through a doorway from the
 * outer side switches to the inner room at ENTER_PLANE; walking back switches at EXIT_PLANE. `passable`
 * says whether a doorway can be used right now (a lift's doors must be open).
 */
export function spaceAfterPortals(
  space: SpaceId,
  x: number,
  z: number,
  y: number,
  portals: readonly Portal[],
  passable: (portal: Portal) => boolean = () => true,
): SpaceId {
  for (const portal of portals) {
    if (portal.outer !== space && portal.inner !== space) {
      continue;
    }
    if (Math.abs(y - portal.y) > PORTAL_LEVEL_TOLERANCE || !passable(portal)) {
      continue;
    }
    const { u, s } = localOf(portal.frame, x, z);
    if (portal.outer === space && u >= ENTER_PLANE && u <= ENTER_LIMIT && Math.abs(s) <= portal.frame.half) {
      return portal.inner;
    }
    if (portal.inner === space && u <= EXIT_PLANE && Math.abs(s) <= portal.frame.half + 0.3) {
      return portal.outer;
    }
  }
  return space;
}

/** True when a lift portal may be crossed under this lift state; every other portal always may. */
export function portalPassable(portal: Portal, lift: LiftState): boolean {
  return portal.kind !== "lift" || (portal.level !== undefined && liftPassable(lift, portal.level));
}

/** The spaces you can see through an open doorway from `space` at height `y`: the rooms on the other side of its portals. */
export function adjacentSpaces(space: SpaceId, y: number, portals: readonly Portal[], lift: LiftState): Set<SpaceId> {
  const out = new Set<SpaceId>();
  for (const portal of portals) {
    if (portal.kind === "street" || Math.abs(y - portal.y) > PORTAL_LEVEL_TOLERANCE || !portalPassable(portal, lift)) {
      continue;
    }
    if (portal.outer === space) {
      out.add(portal.inner);
    } else if (portal.inner === space) {
      out.add(portal.outer);
    }
  }
  return out;
}

/** The floor height of every room, so `elevationIn` is a map lookup. */
const elevations = new Map<SpaceId, number>(INTERIORS.map((def) => [def.id, def.elevation ?? 0]));

/** Every doorway in the district: the open street doors, and the doors between Palm Court's rooms. */
export const PORTALS: readonly Portal[] = buildPortals(
  INTERIORS,
  WORLD_ENTRANCES.filter((entrance) => entrance.state === "open"),
);

/**
 * The height of the floor under (x, z) in a space, for a player who was at `previous`: the street is level, a
 * room is as high as its floor, the stair core follows its flights, and the lift cabin is wherever the cabin is.
 * Null means there is nothing to stand on there (under a flight, or over the stairwell), which the caller
 * treats as a wall.
 */
export function elevationIn(space: SpaceId, x: number, z: number, previous: number, lift: LiftState): number | null {
  if (space === ROOM.stairs) {
    return resolveStairY(x, z, previous);
  }
  if (space === ROOM.lift) {
    return lift.y;
  }
  return elevations.get(space) ?? 0;
}

/** Which of Palm Court's floors a height is on (the nearest), for the HUD. */
export function levelAt(y: number): Level {
  return Math.min(2, Math.max(0, Math.round(y / floorElevation(1)))) as Level;
}