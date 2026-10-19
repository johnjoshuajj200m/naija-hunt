import { describe, expect, it } from "vitest";

import { BUILDINGS } from "../scenes/junction/buildingList";
import { BUSINESSES } from "./businesses";
import { ENTRANCES, footprintBox } from "./entrances";
import { WORLD_ENTRANCES } from "./entranceWorld";
import { INTERIORS, interiorById, STREET_INTERIORS } from "./interiorRegistry";
import { LANE_HALF_WIDTH, LANE_LENGTH, LAYOUTS } from "./interiorLayouts";
import { inwardOf, interiorBounds, interiorBoxes, ROOM_HEIGHT } from "./interiors";
import { blocked, EXPLORER_RADIUS, type Aabb } from "./movement";

const overlap = (a: Aabb, b: Aabb): boolean => a.minX < b.maxX && a.maxX > b.minX && a.minZ < b.maxZ && a.maxZ > b.minZ;

function walkable(boxes: readonly Aabb[], bounds: Aabb, from: { x: number; z: number }): Set<string> {
  const step = 0.2;
  const key = (ix: number, iz: number) => `${ix},${iz}`;
  const start = [Math.round(from.x / step), Math.round(from.z / step)] as const;
  const seen = new Set<string>([key(...start)]);
  const queue: (readonly [number, number])[] = [start];
  while (queue.length > 0) {
    const [ix, iz] = queue.shift() as readonly [number, number];
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = ix + dx;
      const nz = iz + dz;
      const id = key(nx, nz);
      if (seen.has(id) || blocked(nx * step, nz * step, EXPLORER_RADIUS, boxes, bounds)) {
        continue;
      }
      seen.add(id);
      queue.push([nx, nz]);
    }
  }
  return seen;
}

const reaches = (seen: Set<string>, point: { x: number; z: number }): boolean => seen.has(`${Math.round(point.x / 0.2)},${Math.round(point.z / 0.2)}`);

describe("business table", () => {
  it("has unique ids, a real building and an entrance for each business", () => {
    expect(new Set(BUSINESSES.map((business) => business.id)).size).toBe(BUSINESSES.length);
    for (const business of BUSINESSES) {
      expect(BUILDINGS.some((building) => building.id === business.buildingId), business.id).toBe(true);
      const entrance = ENTRANCES.find((row) => row.id === business.id);
      expect(entrance?.state, business.id).toBe("open");
      expect(entrance?.doorKind, business.id).toBe(business.doorKind);
      expect(LAYOUTS[business.layout], business.id).toBeTypeOf("function");
    }
  });

  it("gives Mama Put and the Cold Room automatic glass doors and the market shops open fronts", () => {
    const kinds = Object.fromEntries(BUSINESSES.map((business) => [business.id, business.doorKind]));
    expect(kinds["mama-put"]).toBe("sliding-glass");
    expect(kinds["cold-room"]).toBe("sliding-glass");
    for (const id of ["ankara-house", "fresh-bread", "mallam-suya", "spare-parts"]) {
      expect(kinds[id], id).toBe("open-front");
    }
  });

  it("builds an interior for every business and for nothing else, besides the rooms inside Palm Court", () => {
    expect(STREET_INTERIORS.map((def) => def.id).sort()).toEqual(BUSINESSES.map((business) => business.id).sort());
    // The rest are rooms reached from another room: they have no street door and are not businesses on the street.
    const inside = INTERIORS.filter((def) => def.outer !== undefined);
    expect(inside.length).toBe(INTERIORS.length - STREET_INTERIORS.length);
    for (const def of inside) {
      expect(def.buildingId, def.id).toBe("palm-court");
      expect(ENTRANCES.some((row) => row.id === def.id), def.id).toBe(false);
    }
    for (const entrance of ENTRANCES) {
      if (entrance.state !== "open") {
        expect(interiorById(entrance.id), entrance.id).toBeUndefined();
      }
    }
    // Every residential door stays locked and has no room behind it.
    for (const entrance of ENTRANCES.filter((row) => row.type === "residential")) {
      expect(entrance.state, entrance.id).toBe("locked");
      expect(interiorById(entrance.id), entrance.id).toBeUndefined();
    }
  });
});

describe("every interior is a complete, playable room", () => {
  for (const business of BUSINESSES) {
    describe(business.id, () => {
      const def = interiorById(business.id);
      const building = BUILDINGS.find((entry) => entry.id === business.buildingId);
      const entrance = WORLD_ENTRANCES.find((row) => row.id === business.id);

      it("sits inside its building's footprint, against the door wall", () => {
        expect(def && building && entrance).toBeTruthy();
        if (!def || !building) {
          return;
        }
        const footprint = footprintBox(building);
        expect(def.room.minX).toBeGreaterThanOrEqual(footprint.minX - 1e-6);
        expect(def.room.maxX).toBeLessThanOrEqual(footprint.maxX + 1e-6);
        expect(def.room.minZ).toBeGreaterThanOrEqual(footprint.minZ - 1e-6);
        expect(def.room.maxZ).toBeLessThanOrEqual(footprint.maxZ + 1e-6);
        expect(ROOM_HEIGHT).toBeGreaterThanOrEqual(3);
      });

      it("keeps the entry lane clear of furniture", () => {
        if (!def || !entrance) {
          return;
        }
        const inward = inwardOf(def.facing);
        const tangent = [-inward[1], inward[0]] as const;
        const corner = (u: number, s: number) => ({
          x: entrance.door.x + inward[0] * u + tangent[0] * s,
          z: entrance.door.z + inward[1] * u + tangent[1] * s,
        });
        const a = corner(0, -LANE_HALF_WIDTH);
        const b = corner(LANE_LENGTH, LANE_HALF_WIDTH);
        const lane: Aabb = { minX: Math.min(a.x, b.x), maxX: Math.max(a.x, b.x), minZ: Math.min(a.z, b.z), maxZ: Math.max(a.z, b.z) };
        for (const piece of def.furniture) {
          expect(overlap(piece, lane), `${piece.kind} in the entry lane`).toBe(false);
        }
      });

      it("has furniture, none of it overlapping or poking through a wall", () => {
        if (!def) {
          return;
        }
        const things = def.furniture.filter((piece) => piece.kind !== "wall");
        expect(things.length, "furnished").toBeGreaterThanOrEqual(8);
        const inner = { minX: def.room.minX + 0.4, maxX: def.room.maxX - 0.4, minZ: def.room.minZ + 0.4, maxZ: def.room.maxZ - 0.4 };
        for (const piece of things) {
          expect(piece.minX).toBeGreaterThanOrEqual(inner.minX - 0.01);
          expect(piece.maxX).toBeLessThanOrEqual(inner.maxX + 0.01);
          expect(piece.minZ).toBeGreaterThanOrEqual(inner.minZ - 0.01);
          expect(piece.maxZ).toBeLessThanOrEqual(inner.maxZ + 0.01);
        }
      });

      it("lets the player walk from the entry to the exit and to every place that matters", () => {
        if (!def) {
          return;
        }
        const boxes = interiorBoxes(def);
        const bounds = interiorBounds(def);
        const seen = walkable(boxes, bounds, def.insidePose);
        expect(reaches(seen, def.exitAnchor), "exit").toBe(true);
        for (const spot of def.spots) {
          // A spot is a place to stand or a thing to talk to; either way the player must get close to it.
          const near = [-1, 0, 1].some((dx) => [-1, 0, 1].some((dz) => reaches(seen, { x: spot.x + dx * 1.2, z: spot.z + dz * 1.2 })));
          expect(near, spot.id).toBe(true);
        }
        // A real share of the floor is open: a room you can walk around, not a cupboard.
        const floor = (def.room.maxX - def.room.minX - 0.8) * (def.room.maxZ - def.room.minZ - 0.8);
        expect(seen.size * 0.04).toBeGreaterThan(floor * 0.3);
      });
    });
  }
});
