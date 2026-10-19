import { bayWorldPoint, FACING, type Footprint } from "../scenes/junction/frontage";
import type { BusinessDef } from "./businesses";
import { WALL } from "./entrances";
import { LAYOUTS, type Dir, type LocalRect } from "./interiorLayouts";
import type { InteriorBlock, InteriorDef } from "./interiors";
import type { Aabb } from "./movement";
import type { NpcZone } from "./npcZone";
import { GROUND_FLOOR } from "./spaces";

/** A person's body radius, and how far they may turn from their station's facing to look at someone. */
const NPC_RADIUS = 0.3;
const NPC_FACING_LIMIT = (70 * Math.PI) / 180;

/** How far in the player stands after pressing E at the door. Past the exit prompt, so arriving never shows it. */
export const ENTRY_DEPTH = 3.6;
/** The exit prompt is measured from here: just inside the door, in line with it. */
export const EXIT_DEPTH = 1.0;

const yawOf = (dx: number, dz: number): number => Math.atan2(-dx, -dz);

/**
 * Turns a business row and the building it is in into a room in world coordinates: the room box, the
 * furniture (already in world boxes, with the way each piece faces), the person behind the counter, the
 * entry pose and the exit anchor. Pure: the same input always gives the same room.
 */
export function planInterior(business: BusinessDef, building: Footprint): InteriorDef {
  const door = business.doorAt ?? bayWorldPoint(building, business.facing, business.bay);
  const [nx, nz] = FACING[business.facing].normal;
  const [tx, tz] = FACING[business.facing].tangent;
  const inward: [number, number] = [-nx, -nz];
  const alongZ = business.facing === "-x" || business.facing === "+x";

  const point = (u: number, s: number) => ({ x: door.x + inward[0] * u + tx * s, z: door.z + inward[1] * u + tz * s });
  const rect = (r: LocalRect): Aabb => {
    const a = point(r.u0, r.s0);
    const b = point(r.u1, r.s1);
    return { minX: Math.min(a.x, b.x), maxX: Math.max(a.x, b.x), minZ: Math.min(a.z, b.z), maxZ: Math.max(a.z, b.z) };
  };
  const direction = (dir: Dir): readonly [number, number] => {
    switch (dir) {
      case "u-":
        return [nx, nz];
      case "u+":
        return [inward[0], inward[1]];
      case "s+":
        return [tx, tz];
      case "s-":
        return [-tx, -tz];
    }
  };

  const { depth, sMin, sMax } = business.room;
  const inner: LocalRect = { u0: WALL, u1: depth - WALL, s0: sMin + WALL, s1: sMax - WALL };
  const layout = LAYOUTS[business.layout](inner);

  const furniture: InteriorBlock[] = layout.blocks.map((block) => ({
    kind: block.kind,
    front: direction(block.front),
    look: block.look,
    ...rect(block),
  }));

  const zones: NpcZone[] = (layout.zones ?? []).map((zone) => ({
    id: `${business.id}:${zone.id}`,
    roomId: business.id,
    role: zone.role,
    areas: zone.rects.map(rect),
    stations: zone.stations.map((station) => {
      const at = point(station.u, station.s);
      const [fx, fz] = direction(station.face);
      return { x: at.x, z: at.z, yaw: yawOf(fx, fz) };
    }),
    radius: NPC_RADIUS,
    facingLimit: NPC_FACING_LIMIT,
  }));

  const entry = point(Math.min(ENTRY_DEPTH, depth / 2), 0);
  const exit = point(EXIT_DEPTH, 0);
  return {
    id: business.id,
    buildingId: business.buildingId,
    floorId: business.floorId ?? GROUND_FLOOR,
    // Only a room inside a building says any of this; a street business leaves the keys out.
    ...(business.outer === undefined ? {} : { outer: business.outer }),
    ...(business.doorHalf === undefined ? {} : { doorHalf: business.doorHalf }),
    ...(business.height === undefined ? {} : { height: business.height }),
    ...(business.elevation === undefined ? {} : { elevation: business.elevation }),
    ...(business.unitId === undefined ? {} : { unitId: business.unitId }),
    ...(business.openings === undefined ? {} : { openings: business.openings }),
    room: rect({ u0: 0, u1: depth, s0: sMin, s1: sMax }),
    facing: business.facing,
    doorAlong: alongZ ? door.z : door.x,
    doorKind: business.doorKind,
    furniture,
    zones,
    insidePose: { x: entry.x, z: entry.z, yaw: yawOf(inward[0], inward[1]) },
    exitAnchor: exit,
    vignette: business.vignette,
    tint: business.tint,
    spots: layout.spots.map((spot) => {
      const at = point(spot.u, spot.s);
      return { id: `${business.id}:${spot.id}`, kind: spot.kind, x: at.x, z: at.z };
    }),
  };
}
