import { describe, expect, it } from "vitest";

import { FLOOR_PITCH, STRIP_X } from "./courtGeometry";
import { EXPLORER_RADIUS } from "../movement";
import { FLIGHT_RISE, RUN_END, RUN_START, SPINE_HALF, STAIR_INNER, resolveStairY, stairLensY, stairSurfaces } from "./stairs";

const P = FLOOR_PITCH;
const EAST = STRIP_X + 0.9;
const WEST = STRIP_X - 0.9;

/** Walk a straight line in z at a fixed x, the way the controller does: each step resolves against the height before it. */
function walk(x: number, from: number, to: number, startY: number, step = 0.05): number[] {
  const ys: number[] = [];
  let y = startY;
  const direction = to > from ? 1 : -1;
  for (let z = from; direction * (to - z) >= 0; z += direction * step) {
    const next = resolveStairY(x, z, y);
    expect(next, `a floor at z=${z.toFixed(2)}`).not.toBeNull();
    y = next as number;
    ys.push(y);
  }
  return ys;
}

describe("the stair core", () => {
  it("has landings deep enough for a body to cross between the two lanes, and to turn there", () => {
    const room = EXPLORER_RADIUS * 2 + 0.4;
    expect(RUN_START - STAIR_INNER.minZ).toBeGreaterThanOrEqual(room);
    expect(STAIR_INNER.maxZ - RUN_END).toBeGreaterThanOrEqual(room);
    // the lane the body walks in is wider than the body too
    expect(STRIP_X - SPINE_HALF - STAIR_INNER.minX).toBeGreaterThanOrEqual(room);
    expect(STAIR_INNER.maxX - (STRIP_X + SPINE_HALF)).toBeGreaterThanOrEqual(room);
  });

  it("climbs from the ground floor to the third floor without ever jumping", () => {
    const flight1 = walk(EAST, RUN_START - 0.5, RUN_END + 0.3, 0);
    const halfLanding = flight1[flight1.length - 1] as number;
    expect(halfLanding).toBeCloseTo(FLIGHT_RISE, 5);
    const flight2 = walk(WEST, RUN_END + 0.3, RUN_START - 0.5, halfLanding);
    expect(flight2[flight2.length - 1]).toBeCloseTo(P, 5);
    const flight3 = walk(EAST, RUN_START - 0.5, RUN_END + 0.3, P);
    expect(flight3[flight3.length - 1]).toBeCloseTo(P + FLIGHT_RISE, 5);
    const flight4 = walk(WEST, RUN_END + 0.3, RUN_START - 0.5, P + FLIGHT_RISE);
    expect(flight4[flight4.length - 1]).toBeCloseTo(2 * P, 5);
    for (const ys of [flight1, flight2, flight3, flight4]) {
      for (let i = 1; i < ys.length; i += 1) {
        expect(Math.abs((ys[i] as number) - (ys[i - 1] as number)), "a step of a frame").toBeLessThan(0.12);
      }
    }
    // Up the first two flights and down again is the same climb in reverse.
    expect(flight1[0]).toBe(0);
    expect(flight1.every((y, index) => index === 0 || y >= (flight1[index - 1] as number))).toBe(true);
    expect(flight2.every((y, index) => index === 0 || y >= (flight2[index - 1] as number))).toBe(true);
  });

  it("has no floor to step onto from a different storey", () => {
    // Ground landing to the top of flight 2, and under flight 3 from the third floor: both would be a jump.
    expect(resolveStairY(WEST, RUN_START + 0.1, 0)).toBeNull();
    expect(resolveStairY(EAST, (RUN_START + RUN_END) / 2, 2 * P)).toBeNull();
    // The landings are where they should be at each floor.
    expect(resolveStairY(STRIP_X, RUN_START - 0.6, 0)).toBe(0);
    expect(resolveStairY(STRIP_X, RUN_START - 0.6, P)).toBe(P);
    expect(resolveStairY(STRIP_X, RUN_START - 0.6, 2 * P)).toBe(2 * P);
  });

  it("has nothing to stand on at the spine", () => {
    expect(stairSurfaces(STRIP_X, (RUN_START + RUN_END) / 2)).toEqual([]);
  });

  it("keeps the camera lens clear of a flight above the player", () => {
    // Standing on the first flight with the second storey's flight overhead: the lens may not rise into it.
    const x = EAST;
    const z = (RUN_START + RUN_END) / 2;
    const playerY = resolveStairY(x, z, 0.5) as number;
    const lens = stairLensY(x, z, playerY, playerY + 3.1);
    const above = stairSurfaces(x, z).find((surface) => surface.y > playerY + 1.7);
    expect(above).toBeDefined();
    expect(lens).toBeLessThan((above as { y: number }).y);
    expect(lens).toBeGreaterThan(playerY + 1);
  });
});
