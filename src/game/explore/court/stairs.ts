import { FLOOR_PITCH, RECTS, STRIP_X, Z } from "./courtGeometry";
import type { Aabb } from "../movement";

/**
 * The stair core's flights, as pure geometry. Two flights make one storey (a U-stair), stacked above each
 * other for the second storey:
 *
 *   lane E (x > spine): flight 1 rises ground -> half landing, flight 3 rises second floor -> half landing
 *   lane W (x < spine): flight 2 rises half landing -> second floor, flight 4 rises half landing -> third floor
 *
 * Each flight runs along z from RUN_START to RUN_END and rises half a storey. The player's height follows a
 * ramp along the flight, so climbing is continuous: there is no floor-label change and no teleport. The 2D
 * collision never changes; instead `resolveStairY` says what height a position has, given the height the
 * player was at, and says "nowhere" for a position that would need a jump (under a flight, or off the top
 * landing into the stairwell). The caller treats that as a wall (walkFrame.ts).
 */

/** The flights run between these z. South of RUN_START are the floor landings, north of RUN_END the half landings. */
export const RUN_START = Z.core + 1.9;
export const RUN_END = RUN_START + 3.1;
export const STEPS_PER_FLIGHT = 12;
/** A flight rises half a storey. */
export const FLIGHT_RISE = FLOOR_PITCH / 2;
export const SPINE_HALF = 0.2;
/** Highest a candidate height may differ from where the player already is. A frame's climb is at most ~0.2 m. */
export const STAIR_TOLERANCE = 0.9;
/** Thickness of a floating landing and of a floating flight, metres. Masonry flights are solid to the floor. */
export const SLAB = 0.3;
export const FLIGHT_SLAB = 0.5;
/** The floor's top above the body's y (interiorBuilder FLOOR_Y). */
const SURFACE = 0.15;

/** The inner faces of the core's walls (the room rect less its 0.4 m walls). */
export const STAIR_INNER = {
  minX: RECTS.core.minX + 0.4,
  maxX: RECTS.core.maxX - 0.4,
  minZ: RECTS.core.minZ + 0.4,
  maxZ: RECTS.core.maxZ - 0.4,
};

export type Lane = "E" | "W";

/** The lane's floor in plan, from the wall to the spine. */
export function laneBox(lane: Lane): Aabb {
  return lane === "E"
    ? { minX: STRIP_X + SPINE_HALF, maxX: STAIR_INNER.maxX, minZ: RUN_START, maxZ: RUN_END }
    : { minX: STAIR_INNER.minX, maxX: STRIP_X - SPINE_HALF, minZ: RUN_START, maxZ: RUN_END };
}

/** A walkable surface at a point: the body's y when standing on it, and how thick it is (Infinity: solid to the floor). */
export type Surface = { y: number; thick: number };

const along = (z: number): number => Math.min(1, Math.max(0, (z - RUN_START) / (RUN_END - RUN_START)));

/** Every height a person could be standing at at (x, z): one per floor of the core, so several. */
export function stairSurfaces(x: number, z: number): Surface[] {
  const P = FLOOR_PITCH;
  const H = FLIGHT_RISE;
  if (z < RUN_START) {
    // The floor landings: ground (solid), then a slab at each upper floor.
    return [
      { y: 0, thick: Infinity },
      { y: P, thick: SLAB },
      { y: 2 * P, thick: SLAB },
    ];
  }
  if (z > RUN_END) {
    // The half landings.
    return [
      { y: H, thick: SLAB },
      { y: P + H, thick: SLAB },
    ];
  }
  const t = along(z);
  if (x > STRIP_X + SPINE_HALF) {
    return [
      { y: t * H, thick: Infinity },
      { y: P + t * H, thick: FLIGHT_SLAB },
    ];
  }
  if (x < STRIP_X - SPINE_HALF) {
    return [
      { y: P - t * H, thick: Infinity },
      { y: 2 * P - t * H, thick: FLIGHT_SLAB },
    ];
  }
  return [];
}

/** The height at (x, z) for someone who was at `previous`, or null when no surface there is within a step's reach. */
export function resolveStairY(x: number, z: number, previous: number): number | null {
  let best: number | null = null;
  let bestGap = STAIR_TOLERANCE;
  for (const surface of stairSurfaces(x, z)) {
    const gap = Math.abs(surface.y - previous);
    if (gap <= bestGap) {
      best = surface.y;
      bestGap = gap;
    }
  }
  return best;
}

/** One tread of a flight: its plan box and where its top and underside are, in world y relative to the core's group. */
export type Tread = { box: Aabb; top: number; bottom: number };

/** The treads of flight 1..4, bottom to top. Masonry flights (1 and 2) go down to the floor; 3 and 4 float. */
export function flightTreads(flight: 1 | 2 | 3 | 4): Tread[] {
  const lane: Lane = flight === 1 || flight === 3 ? "E" : "W";
  const base = laneBox(lane);
  const depth = (RUN_END - RUN_START) / STEPS_PER_FLIGHT;
  const index = flight <= 2 ? 0 : 1;
  const treads: Tread[] = [];
  for (let step = 0; step < STEPS_PER_FLIGHT; step += 1) {
    const z0 = RUN_START + step * depth;
    const surface = stairSurfaces((base.minX + base.maxX) / 2, z0 + depth / 2)[index];
    if (!surface) {
      continue;
    }
    const top = surface.y + SURFACE;
    treads.push({
      box: { minX: base.minX, maxX: base.maxX, minZ: z0, maxZ: z0 + depth },
      top,
      bottom: Number.isFinite(surface.thick) ? top - surface.thick : 0.1,
    });
  }
  return treads;
}

/** The floor landing slabs at the second and third floors, and the two half landings, as plan boxes. */
export function landingSlabs(): { box: Aabb; top: number; bottom: number }[] {
  const out: { box: Aabb; top: number; bottom: number }[] = [];
  for (const y of [FLOOR_PITCH, 2 * FLOOR_PITCH]) {
    out.push({
      box: { minX: STAIR_INNER.minX, maxX: STAIR_INNER.maxX, minZ: RECTS.core.minZ, maxZ: RUN_START },
      top: y + SURFACE,
      bottom: y + SURFACE - SLAB,
    });
  }
  for (const y of [FLIGHT_RISE, FLOOR_PITCH + FLIGHT_RISE]) {
    out.push({
      box: { minX: STAIR_INNER.minX, maxX: STAIR_INNER.maxX, minZ: RUN_END, maxZ: STAIR_INNER.maxZ },
      top: y + SURFACE,
      bottom: y + SURFACE - SLAB,
    });
  }
  return out;
}

/** The lens's closest approach to a surface above or below it. */
const LENS_ABOVE = 0.35;
const LENS_BELOW = 0.25;
/** How high a surface must be above the player's feet for its underside to count as a ceiling over them. */
const HEAD = 1.7;

/**
 * Where the lens may be vertically, given where it is in plan and the height the player is at. A stair core
 * has a flight above and a flight below almost everywhere, so a lens at the usual 3.1 m can land inside one.
 * The lens is moved clear: under a surface that is over the player's head, otherwise above whatever it is in.
 */
export function stairLensY(x: number, z: number, playerY: number, wanted: number): number {
  const surfaces = stairSurfaces(x, z).map((surface) => {
    const top = surface.y + SURFACE;
    return { top, bottom: Number.isFinite(surface.thick) ? top - surface.thick : -1, above: surface.y >= playerY + HEAD };
  });
  const ceilings = surfaces.filter((surface) => surface.above).map((surface) => surface.bottom);
  const ceiling = ceilings.length > 0 ? Math.min(...ceilings) - LENS_BELOW : Infinity;
  let y = Math.min(wanted, ceiling);
  for (const surface of surfaces) {
    if (!surface.above && y < surface.top + LENS_ABOVE && y > surface.bottom) {
      y = Math.min(surface.top + LENS_ABOVE, ceiling);
    }
  }
  return y;
}

/** The plan box of the spine between the two lanes. */
export const CORE_SPINE: Aabb = {
  minX: STRIP_X - SPINE_HALF,
  maxX: STRIP_X + SPINE_HALF,
  minZ: RUN_START,
  maxZ: RUN_END,
};
