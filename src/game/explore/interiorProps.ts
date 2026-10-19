import type * as THREE from "three";

import type { JunctionKit } from "../scenes/junction/junctionKit";
import type { InteriorBlock, InteriorDef, PropLook } from "./interiors";

/**
 * The furniture of a room, drawn as flat-coloured boxes and cylinders. Each prop is built in its own frame
 * (a along its length, b out from its back toward its front, y up) so one recipe serves a prop standing
 * against any wall. The collision of a prop is its whole block (interiors.ts); everything drawn here stays
 * inside that block, so what you see is what stops you.
 */

type Frame = {
  cx: number;
  cz: number;
  /** Unit axis the front faces. */
  n: readonly [number, number];
  /** Unit axis along the length of the prop. */
  t: readonly [number, number];
  length: number;
  depth: number;
};

const WOOD = "#8a5a32";
const DARK_WOOD = "#5a3822";
const STEEL = "#8a8f8c";
const WHITE = "#f2f7f8";
const DARK = "#2a2723";

const palette = (colors: readonly string[] | undefined, index: number, fallback: string): string =>
  colors && colors.length > 0 ? (colors[index % colors.length] as string) : fallback;

/** The frame of a block. Tables lay their length along the longer side, so their stools sit at the ends. */
function frameOf(block: InteriorBlock): Frame {
  const sizeX = block.maxX - block.minX;
  const sizeZ = block.maxZ - block.minZ;
  const front = block.front ?? [-1, 0];
  // A table's length runs along its longer side whichever way it faces, so its stools sit at the ends.
  const frontOnX = block.kind === "table" ? sizeX < sizeZ : Math.abs(front[0]) > 0.5;
  const n: [number, number] = frontOnX ? [Math.sign(front[0]) || 1, 0] : [0, Math.sign(front[1]) || 1];
  const t: [number, number] = frontOnX ? [0, 1] : [1, 0];
  return {
    cx: (block.minX + block.maxX) / 2,
    cz: (block.minZ + block.maxZ) / 2,
    n,
    t,
    length: frontOnX ? sizeZ : sizeX,
    depth: frontOnX ? sizeX : sizeZ,
  };
}

type Maker = {
  box: (a: number, b: number, y: number, sa: number, sb: number, sy: number, tint: string, glass?: boolean) => void;
  cyl: (a: number, b: number, y: number, radius: number, height: number, tint: string, topRadius?: number) => void;
};

function maker(group: THREE.Group, kit: JunctionKit, frame: Frame): Maker {
  const world = (a: number, b: number) => ({
    x: frame.cx + frame.t[0] * a + frame.n[0] * b,
    z: frame.cz + frame.t[1] * a + frame.n[1] * b,
  });
  const onX = Math.abs(frame.n[0]) > 0.5;
  return {
    box: (a, b, y, sa, sb, sy, tint, glass = false) => {
      const at = world(a, b);
      kit.flat(group, onX ? [sb, sy, sa] : [sa, sy, sb], [at.x, y, at.z], { tint, glass });
    },
    cyl: (a, b, y, radius, height, tint, topRadius) => {
      const at = world(a, b);
      kit.cylinder(group, radius, height, [at.x, y, at.z], { tint, segments: 8, topRadius });
    },
  };
}

function counter(m: Maker, frame: Frame, look: PropLook | undefined, def: InteriorDef): void {
  const { length, depth } = frame;
  m.box(0, 0, 0.46, length, depth, 0.92, look?.body ?? def.tint.counter);
  m.box(0, 0, 0.95, length + 0.06, depth + 0.06, 0.06, WOOD);
  const top = 0.98;
  const count = Math.max(1, Math.floor((length - 0.3) / 0.5));
  for (let index = 0; index < count; index += 1) {
    const a = -length / 2 + 0.3 + index * ((length - 0.6) / Math.max(1, count - 1 || 1));
    const colour = palette(["#c9694a", "#d9b04a", "#8a8070", "#efe6d0", "#4d9c63"], index, WOOD);
    switch (look?.items) {
      case "food":
        m.cyl(a, 0, top + 0.1, 0.16, 0.2, colour, 0.18);
        m.cyl(a, 0, top + 0.22, 0.12, 0.03, "#2a2723");
        break;
      case "bread":
        m.box(a, 0, top + 0.05, 0.4, 0.28, 0.1, "#b9803f");
        m.box(a, 0, top + 0.13, 0.3, 0.2, 0.08, "#d9a35a");
        break;
      case "cloth":
        m.box(a, 0, top + 0.08 + (index % 3) * 0.04, 0.42, 0.34, 0.16 + (index % 3) * 0.08, colour);
        break;
      case "parts":
        m.box(a, 0, top + 0.1, 0.22, 0.18, 0.2 + (index % 2) * 0.1, palette(["#c9694a", "#2f5f8a", "#d9b04a", "#4d9c63"], index, DARK));
        break;
      case "tools":
        m.box(a, 0, top + 0.04, 0.4, 0.08, 0.06, STEEL);
        m.box(a + 0.1, -0.1, top + 0.05, 0.18, 0.18, 0.1, DARK);
        break;
      case "skewers":
        m.box(a, 0, top + 0.03, 0.4, 0.3, 0.04, DARK);
        m.box(a, 0, top + 0.07, 0.36, 0.03, 0.03, "#d9b04a");
        m.box(a, 0.08, top + 0.07, 0.36, 0.03, 0.03, "#b9803f");
        break;
      default:
        break;
    }
  }
  // A till on the counter's near end.
  if (look?.items === "parts" || look?.items === "cloth" || look?.items === "bread") {
    m.box(length / 2 - 0.25, 0, top + 0.14, 0.34, 0.28, 0.24, DARK);
    m.box(length / 2 - 0.25, 0.1, top + 0.3, 0.26, 0.04, 0.12, "#7fb0bd");
  }
}

function shelf(m: Maker, frame: Frame, look: PropLook | undefined): void {
  const { length, depth } = frame;
  const height = 1.9;
  m.box(0, -depth / 2 + 0.02, height / 2, length, 0.03, height, DARK_WOOD);
  for (const side of [-1, 1]) {
    m.box(side * (length / 2 - 0.02), 0, height / 2, 0.04, depth, height, WOOD);
  }
  for (const y of [0.12, 0.62, 1.12, 1.62, height]) {
    m.box(0, 0, y, length, depth, 0.05, WOOD);
  }
  const count = Math.max(2, Math.floor((length - 0.2) / 0.3));
  for (const [level, y] of [0.12, 0.62, 1.12, 1.62].entries()) {
    for (let index = 0; index < count; index += 1) {
      const a = -length / 2 + 0.2 + index * ((length - 0.4) / Math.max(1, count - 1));
      const tall = 0.2 + ((index + level) % 3) * 0.07;
      m.box(a, 0.04, y + 0.025 + tall / 2, 0.22, depth * 0.62, tall, palette(look?.stock, index + level, "#d9b04a"));
    }
  }
}

function fridge(m: Maker, frame: Frame, look: PropLook | undefined): void {
  const { length, depth } = frame;
  // An open-fronted cabinet: a base, a back, two sides and a top, so the products on its shelves can be
  // seen through the glass door. (A solid box would swallow them.)
  m.box(0, 0, 0.14, length, depth, 0.28, WHITE);
  m.box(0, -depth / 2 + 0.025, 1.0, length, 0.05, 1.8, "#dfe7ea");
  for (const side of [-1, 1]) {
    m.box(side * (length / 2 - 0.025), 0, 1.0, 0.05, depth, 1.8, WHITE);
  }
  m.box(0, 0, 2.0, length, depth, 0.12, WHITE);
  m.box(0, 0, 2.08, length - 0.06, depth - 0.08, 0.05, "#c9d3d6");
  // Products on three shelves, then the glass door in front of them.
  const count = Math.max(2, Math.floor((length * 0.9) / 0.17));
  for (const y of [0.55, 1.05, 1.55]) {
    m.box(0, 0, y, length - 0.1, depth - 0.06, 0.03, "#c9d3d6");
    for (let index = 0; index < count; index += 1) {
      const a = -length * 0.45 + 0.08 + index * ((length * 0.9 - 0.16) / Math.max(1, count - 1));
      for (const b of [0.1, -0.1]) {
        m.box(a, b + depth * 0.1, y + 0.16, 0.1, 0.1, 0.28, palette(look?.stock, index + Math.round(y * 3) + (b > 0 ? 1 : 0), "#3f8fbf"));
      }
    }
  }
  // Door frames every metre or so, with the glass between them.
  const doors = Math.max(1, Math.round(length / 0.9));
  for (let index = 0; index <= doors; index += 1) {
    m.box(-length / 2 + (index * length) / doors, depth / 2 + 0.02, 1.0, 0.04, 0.05, 1.8, "#9aa6aa");
  }
  m.box(0, depth / 2 + 0.02, 1.0, length * 0.96, 0.02, 1.7, "#ffffff", true);
  m.box(0, depth / 2 + 0.035, 0.1, length, 0.03, 0.2, "#c9d3d6");
}

function freezer(m: Maker, frame: Frame, look: PropLook | undefined): void {
  const { length, depth } = frame;
  // A chest freezer: a tub with a glass lid, and the frozen goods stacked where they can be seen.
  m.box(0, 0, 0.15, length, depth, 0.3, WHITE);
  for (const side of [-1, 1]) {
    m.box(side * (length / 2 - 0.03), 0, 0.42, 0.06, depth, 0.84, WHITE);
    m.box(0, side * (depth / 2 - 0.03), 0.42, length, 0.06, 0.84, WHITE);
  }
  m.box(0, 0, 0.86, length + 0.04, 0.05, 0.04, "#c9d3d6");
  m.box(0, 0, 0.86, 0.05, depth + 0.04, 0.04, "#c9d3d6");
  const count = Math.max(2, Math.floor((length - 0.2) / 0.22));
  for (let index = 0; index < count; index += 1) {
    const a = -length / 2 + 0.16 + index * ((length - 0.32) / Math.max(1, count - 1));
    for (const b of [-depth * 0.22, depth * 0.22]) {
      m.box(a, b, 0.52, 0.16, 0.22, 0.44, palette(look?.stock, index + (b > 0 ? 2 : 0), "#efe6d0"));
    }
  }
  m.box(0, 0, 0.87, length - 0.1, depth - 0.1, 0.03, "#ffffff", true);
}

function table(m: Maker, frame: Frame, look: PropLook | undefined): void {
  const { length, depth } = frame;
  const top = length - 1.0;
  m.box(0, 0, 0.74, top, depth, 0.05, WOOD);
  for (const sa of [-1, 1]) {
    for (const sb of [-1, 1]) {
      m.box(sa * (top / 2 - 0.08), sb * (depth / 2 - 0.08), 0.36, 0.06, 0.06, 0.72, DARK_WOOD);
    }
  }
  for (const side of [-1, 1]) {
    m.cyl(side * (length / 2 - 0.22), 0, 0.22, 0.2, 0.44, side > 0 ? "#c9694a" : "#d9b04a");
  }
  if (look?.items === "food") {
    m.cyl(-top * 0.22, 0, 0.8, 0.13, 0.03, "#efe6d0");
    m.cyl(top * 0.22, 0, 0.8, 0.13, 0.03, "#efe6d0");
    m.cyl(0, 0.08, 0.82, 0.05, 0.1, "#3f8fbf");
  }
  if (look?.items === "bread") {
    m.box(0, 0, 0.8, top * 0.7, depth * 0.6, 0.06, "#b9803f");
  }
}

function rack(m: Maker, frame: Frame, look: PropLook | undefined): void {
  const { length, depth } = frame;
  const double = depth > 0.75;
  for (const side of [-1, 1]) {
    m.box(side * (length / 2 - 0.03), 0, 0.85, 0.06, depth, 1.7, DARK_WOOD);
  }
  m.box(0, 0, 1.72, length, depth, 0.05, WOOD);
  const rows = double ? [-depth * 0.25, depth * 0.25] : [0];
  const count = Math.max(3, Math.floor((length - 0.2) / 0.24));
  for (const b of rows) {
    for (const y of [0.4, 0.9, 1.4]) {
      m.box(0, b, y - 0.03, length - 0.1, double ? depth * 0.4 : depth * 0.85, 0.04, WOOD);
      for (let index = 0; index < count; index += 1) {
        const a = -length / 2 + 0.18 + index * ((length - 0.36) / Math.max(1, count - 1));
        m.cyl(a, b, y + 0.2, 0.1, 0.4, palette(look?.stock, index + Math.round(y * 4), "#c9694a"));
      }
    }
  }
}

function stack(m: Maker, frame: Frame, look: PropLook | undefined): void {
  const { length, depth } = frame;
  const shape = look?.shape ?? "crates";
  if (shape === "tyres") {
    const columns = Math.max(1, Math.floor(length / 0.8));
    const rows = Math.max(1, Math.floor(depth / 0.8));
    for (let column = 0; column < columns; column += 1) {
      for (let row = 0; row < rows; row += 1) {
        const a = -length / 2 + (length / columns) * (column + 0.5);
        const b = -depth / 2 + (depth / rows) * (row + 0.5);
        for (let level = 0; level < 5; level += 1) {
          m.cyl(a, b, 0.1 + level * 0.2, 0.34, 0.19, "#1f1f1f");
          m.cyl(a, b, 0.2 + level * 0.2, 0.17, 0.01, "#6b6f6d");
        }
      }
    }
    return;
  }
  const colours = shape === "sacks" ? ["#d9c9a3", "#c8b88e", "#e4d6b4"] : ["#8a5a32", "#a56d3c", "#6b4428"];
  const sx = shape === "sacks" ? 0.55 : 0.5;
  const columns = Math.max(1, Math.floor(length / sx));
  const rows = Math.max(1, Math.floor(depth / 0.45));
  for (let column = 0; column < columns; column += 1) {
    for (let row = 0; row < rows; row += 1) {
      const levels = 3 - ((column + row) % 2);
      for (let level = 0; level < levels; level += 1) {
        const a = -length / 2 + (length / columns) * (column + 0.5);
        const b = -depth / 2 + (depth / rows) * (row + 0.5);
        const h = shape === "sacks" ? 0.3 : 0.34;
        m.box(a, b, h / 2 + level * h, length / columns - 0.04, depth / rows - 0.04, h - 0.02, colours[(column + row + level) % colours.length] as string);
      }
    }
  }
}

function stove(m: Maker, frame: Frame): void {
  const { length, depth } = frame;
  m.box(0, 0, 0.42, length, depth, 0.84, "#3a3a38");
  m.box(0, 0, 0.86, length, depth, 0.04, "#1c1b19");
  const burners = Math.max(1, Math.floor(length / 1.0));
  for (let index = 0; index < burners; index += 1) {
    const a = -length / 2 + (length / burners) * (index + 0.5);
    m.cyl(a, 0, 1.05, 0.26, 0.34, palette(["#8a8070", "#c9694a", "#2a312e", "#d9b04a"], index, STEEL), 0.28);
    m.cyl(a, 0, 1.24, 0.22, 0.04, "#2a2723");
  }
  m.box(0, 0, 2.4, length * 0.9, depth, 0.4, "#8a8f8c");
  m.box(0, 0, 3.2, 0.34, 0.34, 1.2, "#6b6f6d");
}

function oven(m: Maker, frame: Frame): void {
  const { length, depth } = frame;
  m.box(0, 0, 0.85, length, depth, 1.7, "#b7a588");
  m.box(0, depth / 2 + 0.01, 0.7, length * 0.55, 0.04, 0.5, "#1c1b19");
  m.box(0, depth / 2 + 0.02, 0.55, length * 0.4, 0.04, 0.12, "#c9694a");
  m.box(0, 0, 2.5, 0.5, 0.5, 1.6, "#8a8070");
}

function display(m: Maker, frame: Frame, look: PropLook | undefined): void {
  const { length, depth } = frame;
  if (look?.items === "bread") {
    m.box(0, 0, 0.35, length, depth, 0.7, WOOD);
    m.box(0, 0, 1.02, length - 0.06, depth - 0.06, 0.6, "#ffffff", true);
    const count = Math.max(2, Math.floor(length / 0.4));
    for (let index = 0; index < count; index += 1) {
      const a = -length / 2 + 0.25 + index * ((length - 0.5) / Math.max(1, count - 1));
      m.box(a, 0, 0.82, 0.3, depth * 0.6, 0.12, palette(look.stock, index, "#b9803f"));
      m.box(a, 0, 1.0, 0.26, depth * 0.5, 0.1, palette(look.stock, index + 1, "#d9a35a"));
    }
    return;
  }
  // A display table piled with folded cloth.
  m.box(0, 0, 0.42, length, depth, 0.84, WOOD);
  m.box(0, 0, 0.86, length + 0.06, depth + 0.06, 0.04, "#d9c9a3");
  const count = Math.max(2, Math.floor((length - 0.2) / 0.55));
  for (let index = 0; index < count; index += 1) {
    const a = -length / 2 + 0.35 + index * ((length - 0.7) / Math.max(1, count - 1));
    for (let level = 0; level < 3; level += 1) {
      m.box(a, 0, 0.92 + level * 0.1, 0.5 - level * 0.04, depth * 0.7, 0.09, palette(look?.stock, index + level, "#c9694a"));
    }
  }
}

/** Draws one piece of furniture into a room group. Walls are the builder's job (interiorBuilder.ts). */
export function buildProp(group: THREE.Group, kit: JunctionKit, def: InteriorDef, block: InteriorBlock): void {
  const frame = frameOf(block);
  const m = maker(group, kit, frame);
  switch (block.kind) {
    case "counter":
      counter(m, frame, block.look, def);
      break;
    case "shelf":
      shelf(m, frame, block.look);
      break;
    case "fridge":
      fridge(m, frame, block.look);
      break;
    case "freezer":
      freezer(m, frame, block.look);
      break;
    case "table":
      table(m, frame, block.look);
      break;
    case "rack":
      rack(m, frame, block.look);
      break;
    case "stack":
      stack(m, frame, block.look);
      break;
    case "stove":
      stove(m, frame);
      break;
    case "oven":
      oven(m, frame);
      break;
    case "display":
      display(m, frame, block.look);
      break;
    case "wall":
      break;
  }
}
