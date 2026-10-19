import type { LayoutKind } from "./businesses";
import { Z } from "./court/courtGeometry";
import { RUN_END, RUN_START } from "./court/stairs";
import type { BlockKind, PropLook, RoomSpot } from "./interiors";

/**
 * Furniture recipes, in a room's own frame. u is metres in from the door wall (the door is at u = 0)
 * and s is metres along the wall from the door, positive to the right as you walk in. Because a recipe
 * knows nothing about the world, one recipe serves a door that faces any way, and a business only has to
 * say which recipe it wants and how big its room is (businesses.ts).
 *
 * Every recipe keeps the entry lane clear: the strip |s| < 1.1 from the door to u = 4. The player walks
 * in along it, the door's sensors watch it, and nothing is allowed to stand there.
 */

export type Dir = "u-" | "u+" | "s-" | "s+";
export type LocalRect = { u0: number; u1: number; s0: number; s1: number };
export type LocalBlock = LocalRect & { kind: BlockKind; front: Dir; look?: PropLook };
export type LocalSpot = { id: string; kind: RoomSpot["kind"]; u: number; s: number };
/**
 * Where a person who works in the room may be: the rectangles their centre may stay in, and the places
 * they stand (the first is home), each with the way they face. The people themselves are not in the
 * layout, so the room's collision is only furniture and walls; a person is a moving body (npcZone.ts).
 */
export type LocalStation = { u: number; s: number; face: Dir };
export type LocalZone = { id: string; role: "seller" | "customer" | "visitor"; rects: LocalRect[]; stations: LocalStation[] };
export type LayoutResult = {
  blocks: LocalBlock[];
  zones?: LocalZone[];
  spots: LocalSpot[];
};

/** The clear floor inside the walls. u0 is just inside the door wall, u1 is just in front of the back wall. */
export type Inner = LocalRect;

/** The strip that must stay free, and how far in it runs. */
export const LANE_HALF_WIDTH = 1.1;
export const LANE_LENGTH = 4;

type Side = "back" | "front" | "left" | "right";
type Run = { start: number; length: number; depth: number; count?: number; gap?: number; look?: PropLook };

/** `count` identical units laid end to end against one wall. `start` is the first unit's near edge (s for back and front walls, u for side walls). */
function along(inner: Inner, side: Side, kind: BlockKind, run: Run): LocalBlock[] {
  const blocks: LocalBlock[] = [];
  const count = run.count ?? 1;
  const gap = run.gap ?? 0;
  for (let index = 0; index < count; index += 1) {
    const from = run.start + index * (run.length + gap);
    const to = from + run.length;
    const look = run.look;
    switch (side) {
      case "back":
        blocks.push({ kind, front: "u-", look, u0: inner.u1 - run.depth, u1: inner.u1, s0: from, s1: to });
        break;
      case "front":
        blocks.push({ kind, front: "u+", look, u0: inner.u0, u1: inner.u0 + run.depth, s0: from, s1: to });
        break;
      case "left":
        blocks.push({ kind, front: "s+", look, u0: from, u1: to, s0: inner.s0, s1: inner.s0 + run.depth });
        break;
      case "right":
        blocks.push({ kind, front: "s-", look, u0: from, u1: to, s0: inner.s1 - run.depth, s1: inner.s1 });
        break;
    }
  }
  return blocks;
}

const block = (kind: BlockKind, front: Dir, rect: LocalRect, look?: PropLook): LocalBlock => ({ kind, front, look, ...rect });

const DRINKS = ["#3f8fbf", "#d9b04a", "#c9694a", "#efe6d0", "#4d9c63"] as const;
const DAIRY = ["#efe6d0", "#9db8bb", "#d9b04a", "#efe6d0"] as const;
const CLOTH = ["#c9694a", "#d9b04a", "#1d3226", "#3f8fbf", "#a24f6b", "#efe6d0", "#4d9c63"] as const;
const BREAD = ["#b9803f", "#d9a35a", "#9a6330", "#e0b97a"] as const;
const POTS = ["#8a8070", "#c9694a", "#2a312e", "#d9b04a"] as const;
const PARTS = ["#c9694a", "#2f5f8a", "#d9b04a", "#2a312e", "#efe6d0", "#4d9c63"] as const;
const SPICE = ["#c9694a", "#d9b04a", "#8a5a32", "#a24f6b"] as const;

function buka(inner: Inner): LayoutResult {
  // The kitchen takes the left 6.2 m behind the counter. Nobody but the cook goes in.
  const edge = inner.s0 + 6.2;
  const counterU = 5.3;
  const blocks: LocalBlock[] = [
    block("counter", "u-", { u0: counterU, u1: 6.2, s0: inner.s0, s1: edge }, { items: "food" }),
    block("counter", "s+", { u0: counterU, u1: inner.u1, s0: edge - 0.45, s1: edge }),
    ...along(inner, "back", "stove", { start: inner.s0 + 0.5, length: 4.2, depth: 0.9 }),
    ...along(inner, "back", "shelf", { start: inner.s0 + 4.9, length: 0.8, depth: 0.5, look: { stock: POTS } }),
    block("counter", "s+", { u0: 7.4, u1: 9.8, s0: inner.s0, s1: inner.s0 + 0.7 }, { items: "food" }),
    // Tables with stools, in two rows in front of the counter.
    ...[0, 3.3].flatMap((offset) =>
      [1.4, 3.2].map((u) =>
        block("table", "s+", { u0: u, u1: u + 0.8, s0: inner.s0 + 0.8 + offset, s1: inner.s0 + 2.7 + offset }, { items: "food" }),
      ),
    ),
    // The customer side of the room: drinks, snacks, and a bench table.
    ...along(inner, "back", "fridge", { start: inner.s1 - 4.0, length: 1.1, depth: 0.8, count: 2, gap: 0.1, look: { stock: DRINKS } }),
    ...along(inner, "right", "shelf", { start: 5.0, length: 3.4, depth: 0.55, look: { stock: ["#d9b04a", "#c9694a", "#efe6d0", "#4d9c63"] } }),
    block("table", "s+", { u0: 7.0, u1: 7.8, s0: -2.6, s1: -0.7 }, { items: "food" }),
  ];
  return {
    blocks,
    // The service area is the kitchen behind the counter. Its centre-space stops 0.35 m short of the counter,
    // the divider, the stove and the side bench, so a body (0.3 m) never touches them.
    zones: [
      {
        id: "seller-service",
        role: "seller",
        rects: [{ u0: counterU + 0.9 + 0.35, u1: inner.u1 - 0.9 - 0.35, s0: inner.s0 + 1.05, s1: edge - 0.45 - 0.35 }],
        stations: [
          { u: 6.9, s: inner.s0 + 3.1, face: "u-" },
          { u: 6.9, s: inner.s0 + 1.7, face: "u-" },
          { u: 6.9, s: inner.s0 + 4.5, face: "u-" },
        ],
      },
    ],
    spots: [
      { id: "counter", kind: "interaction", u: 4.6, s: inner.s0 + 3.1 },
      { id: "seller", kind: "interaction", u: 4.6, s: inner.s0 + 3.1 },
    ],
  };
}

function coldStore(inner: Inner): LayoutResult {
  const blocks: LocalBlock[] = [
    ...along(inner, "back", "fridge", { start: -4.4, length: 1.1, depth: 0.8, count: 8, look: { stock: DRINKS } }),
    ...along(inner, "left", "freezer", { start: 4.0, length: 1.8, depth: 0.9, count: 3, gap: 0.3, look: { stock: DAIRY } }),
    ...along(inner, "right", "shelf", { start: 5.0, length: 2.4, depth: 0.6, count: 2, gap: 0.6, look: { stock: DRINKS } }),
    ...along(inner, "right", "counter", { start: 0.9, length: 2.8, depth: 0.8, look: { items: "parts" } }),
    ...along(inner, "front", "fridge", { start: -4.6, length: 1.1, depth: 0.6, count: 2, gap: 0.1, look: { stock: DAIRY } }),
    block("freezer", "s+", { u0: 5.8, u1: 7.6, s0: -2.8, s1: -1.9 }, { stock: DAIRY }),
    block("freezer", "s-", { u0: 5.8, u1: 7.6, s0: -1.7, s1: -0.8 }, { stock: DRINKS }),
  ];
  return {
    blocks,
    spots: [{ id: "till", kind: "interaction", u: 2.3, s: inner.s1 - 1.2 }],
  };
}

function fabrics(inner: Inner): LayoutResult {
  const blocks: LocalBlock[] = [
    ...along(inner, "back", "shelf", { start: inner.s0 + 0.2, length: 2.2, depth: 0.7, count: 6, gap: 0.2, look: { stock: CLOTH } }),
    ...along(inner, "left", "rack", { start: 2.5, length: 2.4, depth: 0.7, count: 3, gap: 0.4, look: { stock: CLOTH } }),
    ...along(inner, "right", "rack", { start: 5.0, length: 2.4, depth: 0.7, count: 2, gap: 0.4, look: { stock: CLOTH } }),
    ...along(inner, "right", "counter", { start: 0.9, length: 2.6, depth: 0.8, look: { items: "cloth" } }),
    ...along(inner, "front", "shelf", { start: inner.s0 + 0.6, length: 2.2, depth: 0.5, count: 3, gap: 0.3, look: { stock: CLOTH } }),
    block("display", "u-", { u0: 5.6, u1: 6.6, s0: -6.4, s1: -3.4 }, { items: "cloth", stock: CLOTH }),
    block("display", "u-", { u0: 5.6, u1: 6.6, s0: -1.8, s1: 1.2 }, { items: "cloth", stock: CLOTH }),
    block("rack", "s+", { u0: 8.4, u1: 9.2, s0: -5, s1: -2.2 }, { stock: CLOTH }),
  ];
  return { blocks, spots: [{ id: "counter", kind: "interaction", u: 2.2, s: inner.s1 - 1.2 }] };
}

function bakery(inner: Inner): LayoutResult {
  const blocks: LocalBlock[] = [
    ...along(inner, "back", "oven", { start: inner.s0 + 0.2, length: 1.6, depth: 0.9, count: 2, gap: 0.3 }),
    ...along(inner, "back", "shelf", { start: -1.2, length: 2.0, depth: 0.6, count: 4, gap: 0.3, look: { stock: BREAD } }),
    ...along(inner, "left", "shelf", { start: 3.0, length: 2.0, depth: 0.6, count: 2, gap: 0.4, look: { stock: BREAD } }),
    ...along(inner, "right", "counter", { start: 1.0, length: 6.0, depth: 0.8, look: { items: "bread" } }),
    block("display", "u-", { u0: 5.0, u1: 5.9, s0: 1.6, s1: 3.8 }, { items: "bread", stock: BREAD }),
    block("display", "u-", { u0: 8.2, u1: 9.1, s0: 1.6, s1: 3.8 }, { items: "bread", stock: BREAD }),
    block("table", "s+", { u0: 3.0, u1: 3.8, s0: 4.0, s1: 5.9 }, { items: "bread" }),
  ];
  return { blocks, spots: [{ id: "counter", kind: "interaction", u: 2.0, s: inner.s1 - 1.4 }] };
}

function grill(inner: Inner): LayoutResult {
  const blocks: LocalBlock[] = [
    ...along(inner, "left", "counter", { start: 2.4, length: 6.0, depth: 0.8, look: { items: "skewers" } }),
    ...along(inner, "back", "stove", { start: inner.s0 + 1.4, length: 3.2, depth: 0.9 }),
    ...along(inner, "back", "shelf", { start: 0.2, length: 2.0, depth: 0.5, count: 2, gap: 0.4, look: { stock: SPICE } }),
    ...[2.0, 4.6, 7.2].map((u) => block("table", "s+", { u0: u, u1: u + 0.8, s0: 2.2, s1: 4.1 }, { items: "food" })),
    block("stack", "s-", { u0: 9.4, u1: 10.6, s0: 4.0, s1: 5.2 }, { shape: "sacks" }),
  ];
  return { blocks, spots: [{ id: "counter", kind: "interaction", u: 5.4, s: inner.s0 + 1.8 }] };
}

function autoParts(inner: Inner): LayoutResult {
  const blocks: LocalBlock[] = [
    ...along(inner, "back", "shelf", { start: -5.4, length: 2.4, depth: 0.6, count: 4, gap: 0.2, look: { stock: PARTS } }),
    ...along(inner, "left", "shelf", { start: 3.0, length: 2.4, depth: 0.6, count: 3, gap: 0.3, look: { stock: PARTS } }),
    ...along(inner, "right", "counter", { start: 0.9, length: 3.2, depth: 0.8, look: { items: "parts" } }),
    block("stack", "s-", { u0: 6.0, u1: 8.0, s0: 3.9, s1: 5.2 }, { shape: "tyres" }),
    ...along(inner, "right", "shelf", { start: 8.6, length: 2.2, depth: 0.5, look: { stock: PARTS } }),
    block("counter", "s+", { u0: 6.0, u1: 6.8, s0: -2.2, s1: 1.0 }, { items: "tools" }),
    block("stack", "s+", { u0: 8.4, u1: 9.4, s0: -2.4, s1: -0.8 }, { shape: "crates" }),
  ];
  return { blocks, spots: [{ id: "counter", kind: "interaction", u: 2.3, s: inner.s1 - 1.2 }] };
}

const MEDS = ["#efe6d0", "#4d9c63", "#3f8fbf", "#c9694a", "#efe6d0"] as const;
const PHONE_BOXES = ["#2f5f8a", "#efe6d0", "#2a312e", "#d9b04a", "#4d9c63"] as const;
const STAPLES = ["#d9b04a", "#c9694a", "#efe6d0", "#4d9c63", "#8a5a32"] as const;
const FILES = ["#8a8070", "#2f5f8a", "#efe6d0", "#2a312e"] as const;

/** A pharmacy in a 9.2 x 10 m room (Glow Pharmacy): dispensary shelves behind a till, medicine fridge, shelves and displays up front. */
function pharmacy(inner: Inner): LayoutResult {
  const blocks: LocalBlock[] = [
    ...along(inner, "back", "shelf", { start: inner.s0 + 0.2, length: 1.9, depth: 0.5, count: 4, gap: 0.1, look: { stock: MEDS } }),
    block("counter", "u-", { u0: 5.4, u1: 6.2, s0: -2.4, s1: 0.4 }, { items: "parts" }),
    ...along(inner, "right", "counter", { start: 5.4, length: 2.2, depth: 0.8, look: { items: "parts" } }),
    ...along(inner, "right", "fridge", { start: 7.8, length: 1.1, depth: 0.6, look: { stock: DAIRY } }),
    ...along(inner, "left", "shelf", { start: 2.0, length: 2.4, depth: 0.5, count: 2, gap: 0.3, look: { stock: MEDS } }),
    block("display", "u-", { u0: 2.2, u1: 3.0, s0: -3.8, s1: -1.6 }, { items: "parts", stock: MEDS }),
    block("display", "u-", { u0: 2.2, u1: 3.0, s0: 1.6, s1: 3.4 }, { items: "parts", stock: MEDS }),
  ];
  return { blocks, spots: [{ id: "counter", kind: "interaction", u: 4.6, s: -1.0 }] };
}

/** A phone shop in a 9.2 x 10 m room (Naija Phones): handset shelves, a glass counter, a repair bench. */
function phones(inner: Inner): LayoutResult {
  const blocks: LocalBlock[] = [
    ...along(inner, "back", "shelf", { start: inner.s0 + 0.2, length: 1.6, depth: 0.5, count: 4, gap: 0.1, look: { stock: PHONE_BOXES } }),
    ...along(inner, "right", "counter", { start: 2.4, length: 3.4, depth: 0.8, look: { items: "parts" } }),
    ...along(inner, "left", "rack", { start: 2.2, length: 2.0, depth: 0.5, count: 2, gap: 0.4, look: { stock: PHONE_BOXES } }),
    block("table", "s+", { u0: 6.4, u1: 7.2, s0: -1.8, s1: 0.6 }, { items: "tools" }),
    block("counter", "u-", { u0: 4.8, u1: 5.6, s0: -2.8, s1: -0.4 }, { items: "parts" }),
    block("stack", "s-", { u0: 6.4, u1: 7.4, s0: inner.s1 - 1.0, s1: inner.s1 }, { shape: "crates" }),
  ];
  return { blocks, spots: [{ id: "counter", kind: "interaction", u: 4.0, s: -1.6 }] };
}

/** A corner shop (Bola Provisions), entered from the lobby: chillers on the back wall, shelves down both sides, a till by the door. */
function provisions(inner: Inner): LayoutResult {
  const blocks: LocalBlock[] = [
    ...along(inner, "back", "fridge", { start: 0.6, length: 1.1, depth: 0.8, count: 5, gap: 0.1, look: { stock: DRINKS } }),
    ...along(inner, "left", "shelf", { start: 2.0, length: 2.0, depth: 0.5, count: 3, gap: 0.3, look: { stock: STAPLES } }),
    ...along(inner, "right", "shelf", { start: 1.8, length: 2.4, depth: 0.55, count: 2, gap: 0.3, look: { stock: STAPLES } }),
    block("counter", "s-", { u0: 1.6, u1: 2.4, s0: 2.2, s1: 5.0 }, { items: "parts" }),
    block("rack", "u-", { u0: 4.4, u1: 5.2, s0: 1.4, s1: 4.4 }, { stock: STAPLES }),
    block("rack", "u-", { u0: 6.4, u1: 7.2, s0: 1.4, s1: 4.4 }, { stock: STAPLES }),
    block("stack", "s-", { u0: 3.0, u1: 4.4, s0: 6.4, s1: 7.6 }, { shape: "sacks" }),
  ];
  return { blocks, spots: [{ id: "till", kind: "interaction", u: 3.2, s: 3.6 }] };
}

/** The lobby: a security desk, the tenants' pigeon-holes, a notice rack and planters, with the aisle to the stairs left clear. */
function lobby(inner: Inner): LayoutResult {
  const blocks: LocalBlock[] = [
    block("counter", "s+", { u0: 2.2, u1: 4.2, s0: inner.s0, s1: inner.s0 + 0.9 }),
    ...along(inner, "right", "shelf", { start: 2.0, length: 1.6, depth: 0.3, count: 3, gap: 0.2, look: { stock: FILES } }),
    block("rack", "s+", { u0: 5.4, u1: 7.0, s0: inner.s0, s1: inner.s0 + 0.5 }, { stock: FILES }),
    block("stack", "s+", { u0: 7.6, u1: 8.8, s0: inner.s0, s1: inner.s0 + 1.0 }, { shape: "crates" }),
    block("stack", "s-", { u0: 7.6, u1: 8.8, s0: inner.s1 - 1.0, s1: inner.s1 }, { shape: "crates" }),
    // Waiting benches either side, short of the doorways to provisions and the lift.
    block("table", "s+", { u0: 9.0, u1: 10.8, s0: inner.s0, s1: inner.s0 + 0.7 }),
    block("table", "s-", { u0: 9.0, u1: 10.8, s0: inner.s1 - 0.7, s1: inner.s1 }),
  ];
  return { blocks, spots: [{ id: "directory", kind: "interaction", u: 5.0, s: 0 }] };
}

/** Halls and the lift cabin are empty floor; the stair core's only fixture is the spine between its two flights. */
const empty = (): LayoutResult => ({ blocks: [], spots: [] });

function hall(inner: Inner): LayoutResult {
  return {
    blocks: [
      block("table", "s-", { u0: 4.2, u1: 6.0, s0: inner.s1 - 0.8, s1: inner.s1 }),
      block("table", "s+", { u0: 4.2, u1: 6.0, s0: inner.s0, s1: inner.s0 + 0.8 }),
    ],
    spots: [],
  };
}

function stairs(): LayoutResult {
  // The spine between the two lanes: it runs the length of the flights (u is measured from the core's door plane, z = Z.core).
  return { blocks: [block("column", "u-", { u0: RUN_START - Z.core, u1: RUN_END - Z.core, s0: -0.2, s1: 0.2 })], spots: [] };
}

/** A working unit: shelves of files at the back, two desks, a reception counter and a filing rack. */
function office(inner: Inner): LayoutResult {
  const width = inner.s1 - inner.s0;
  const count = Math.max(2, Math.min(4, Math.floor((width - 0.6) / 2.0)));
  const blocks: LocalBlock[] = [
    ...along(inner, "back", "shelf", { start: inner.s0 + 0.3, length: 1.8, depth: 0.5, count, gap: 0.2, look: { stock: FILES } }),
    block("table", "u-", { u0: 4.4, u1: 5.2, s0: inner.s0 + 1.0, s1: inner.s0 + 2.8 }, { items: "tools" }),
    block("table", "u-", { u0: 4.4, u1: 5.2, s0: inner.s1 - 2.8, s1: inner.s1 - 1.0 }, { items: "tools" }),
    ...along(inner, "right", "counter", { start: 1.8, length: 2.4, depth: 0.8, look: { items: "parts" } }),
    ...along(inner, "left", "rack", { start: 5.6, length: 2.2, depth: 0.5, look: { stock: FILES } }),
  ];
  return { blocks, spots: [] };
}

/** A tailor's studio: cloth racks down one wall, cutting tables, a counter. */
function studio(inner: Inner): LayoutResult {
  const racks = Math.max(1, Math.floor((inner.u1 - 2.0) / 2.5));
  const blocks: LocalBlock[] = [
    ...along(inner, "left", "rack", { start: 2.0, length: 2.2, depth: 0.6, count: racks, gap: 0.3, look: { stock: CLOTH } }),
    block("table", "u-", { u0: 5.0, u1: 5.9, s0: inner.s0 + 1.4, s1: inner.s0 + 3.4 }, { items: "cloth" }),
    block("table", "u-", { u0: 5.0, u1: 5.9, s0: inner.s1 - 3.4, s1: inner.s1 - 1.4 }, { items: "cloth" }),
    ...along(inner, "right", "counter", { start: 1.8, length: 2.6, depth: 0.8, look: { items: "cloth" } }),
    ...along(inner, "back", "shelf", { start: inner.s1 - 4.6, length: 2.2, depth: 0.5, count: 2, gap: 0.2, look: { stock: CLOTH } }),
  ];
  return { blocks, spots: [] };
}

/** An empty unit to let: a few crates left by the last tenant. */
function vacant(inner: Inner): LayoutResult {
  return {
    blocks: [block("stack", "s-", { u0: inner.u1 - 1.4, u1: inner.u1 - 0.4, s0: inner.s1 - 1.6, s1: inner.s1 - 0.4 }, { shape: "crates" })],
    spots: [],
  };
}

export const LAYOUTS: Record<LayoutKind, (inner: Inner) => LayoutResult> = {
  buka,
  "cold-store": coldStore,
  fabrics,
  bakery,
  grill,
  "auto-parts": autoParts,
  pharmacy,
  phones,
  provisions,
  lobby,
  hall,
  stairs,
  lift: empty,
  office,
  studio,
  vacant,
};
