import { bayWorldPoint, FACING, type Facing, type Footprint } from "../../scenes/junction/frontage";
import type { Aabb } from "../movement";

/**
 * Palm Court's plan, in world metres. Pure numbers and one helper: nothing here draws or collides.
 *
 * The building stands on the north side of the cross street, x -52..-28, z -12.9 (the street frontage) to 8.
 * Every room is a rectangle that includes its own 0.4 m walls, so neighbouring rooms abut and a partition is
 * two walls side by side. Seen from the street, west is to the right:
 *
 *   street (z -12.9)
 *   x -52 ........ -42.8 .. -37.2 ........ -28
 *   |  naija-phones  | lobby |  glow-pharmacy  |   z -12.9 .. -2.9   (floors 2, 3: unit 2B | hall | unit 2A)
 *   |  (service)  lift|  hall |  bola-provisions|   z  -2.9 ..  8     (floors 2, 3: ...      | hall | unit C)
 *   |             stair core (z 1.1 .. 8)        |
 *
 * The lobby is the ground floor of the central strip; floors 2 and 3 have a hall on the same footprint. The
 * stair core and the lift shaft are the same on every floor.
 */

export const COURT_ID = "palm-court";
export const COURT_NAME = "Palm Court";

/** The footprint, as the building list has it (junction/buildingList.ts). */
export const COURT_FOOTPRINT: Footprint = { x0: -52, x1: -28, z0: 8, z1: -12.9 };

/** Floor to floor, metres. The ceiling slab (12 cm on top of ROOM_HEIGHT 4) and the next floor's slab nest inside it. */
export const FLOOR_PITCH = 4.1;

export const X = {
  east: -28,
  /** The east edge of the central strip (lobby, halls, stair core). */
  stripE: -37.2,
  stripW: -42.8,
  west: -52,
  /** The far (west) side of the lift shaft. */
  shaftW: -45.6,
} as const;

export const Z = {
  front: -12.9,
  /** Front units end here; the back units and the service zone start. */
  split: -2.9,
  /** The strip's lobby and halls end, and the stair core starts. */
  core: 1.1,
  back: 8,
  shaftS: -2.5,
  shaftN: 0.7,
  /** The doorways in the strip's side walls at the back: provisions / unit C to the east, the lift to the west. */
  side: -0.9,
  /** The doorways in the strip's side walls at the front: unit A to the east, unit B to the west. */
  frontSide: -7.9,
} as const;

/** The strip's centre line. */
export const STRIP_X = (X.stripE + X.stripW) / 2;

const rect = (minX: number, maxX: number, minZ: number, maxZ: number): Aabb => ({ minX, maxX, minZ, maxZ });

export const RECTS = {
  /** East front: the pharmacy on the ground floor, unit A above. */
  eastFront: rect(X.stripE, X.east, Z.front, Z.split),
  /** West front: the phone shop on the ground floor, unit B above. */
  westFront: rect(X.west, X.stripW, Z.front, Z.split),
  /** The strip from the street to the core: the lobby, and the hall on floors 2 and 3. */
  strip: rect(X.stripW, X.stripE, Z.front, Z.core),
  /** East back: provisions on the ground floor, unit C above. */
  eastBack: rect(X.stripE, X.east, Z.split, Z.back),
  core: rect(X.stripW, X.stripE, Z.core, Z.back),
  shaft: rect(X.shaftW, X.stripW, Z.shaftS, Z.shaftN),
} as const;

export type DoorPoint = { x: number; z: number };

/** The lift call button on every landing: on the strip's west wall, beside the lift doors. */
export const CALL_BUTTON: DoorPoint = { x: X.stripW + 0.4, z: Z.side - 1.35 };

/** How close to the call button a person must be to use it, metres. */
export const CALL_REACH = 1.9;

/** The centre of a bay's door on the street frontage. Bay numbers are the facade's (frontage.ts). */
export function frontDoor(bay: number): DoorPoint {
  return bayWorldPoint(COURT_FOOTPRINT, "-z", bay);
}

/**
 * A room, in the door's own frame (businesses.ts): how deep it runs from the door plane, and how far either
 * side of the door it reaches along the wall. `facing` points out of the room through the door.
 */
export function roomFrom(box: Aabb, door: DoorPoint, facing: Facing): { depth: number; sMin: number; sMax: number } {
  const [nx, nz] = FACING[facing].normal;
  const [tx, tz] = FACING[facing].tangent;
  const us: number[] = [];
  const ss: number[] = [];
  for (const x of [box.minX, box.maxX]) {
    for (const z of [box.minZ, box.maxZ]) {
      us.push((x - door.x) * -nx + (z - door.z) * -nz);
      ss.push((x - door.x) * tx + (z - door.z) * tz);
    }
  }
  return { depth: Math.max(...us), sMin: Math.min(...ss), sMax: Math.max(...ss) };
}
