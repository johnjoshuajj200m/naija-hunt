import type { AssetTier } from "./assetList";
import {
  DOOR_HEAD,
  DOOR_HEAD_SHUT,
  doorHalf,
  entrancesOnFrontage,
  type EntranceDef,
} from "../../explore/entrances";
import { bayCountOf, type Facing } from "./frontage";
import type { InstanceSpec, Vec3 } from "../sceneHelpers";

export type { Facing } from "./frontage";

/**
 * Which frontages get the new facade work. Anything not listed is left as a plain wall.
 * "simple" keeps a basic window rhythm on distant frontages that still face the camera.
 * Away-facing frontages are "none": the detail would never be seen.
 */
export type FacadeLevel = "full" | "medium" | "light" | "simple" | "none";

/** Ground floor and upper storey heights, in metres. Shared with the wall boxes. */
export const STOREY = { ground: 4, upper: 3.3 } as const;

const LEVELS: Record<string, Partial<Record<Facing, FacadeLevel>>> = {
  "ade-and-sons": { "+x": "full" },
  // The three-storey commercial building: three shop doors below, a window for every bay on the floors above.
  "palm-court": { "-z": "medium" },
  "glory-fabrics": { "+z": "medium", "+x": "light" },
  "zion-tyres": { "+z": "medium", "-x": "light" },
  // Distant, but they face the camera, so they keep a plain window rhythm.
  "left-lean-to": { "+x": "simple" },
  "left-far": { "+x": "simple" },
  "right-lean-to": { "-x": "simple" },
  "right-far": { "-x": "simple" },
  "cross-far-left": { "+z": "simple" },
  "cross-far-right": { "+z": "simple" },
  // Market street and the south road. Simple shopfronts only: the detailed kit stays on the hero junction.
  "market-east-north": { "-x": "simple" },
  "market-east-corner": { "-x": "simple", "-z": "simple" },
  "market-east-south": { "-x": "simple" },
  "market-east-far": { "-x": "simple" },
  "market-west-north": { "+x": "simple" },
  "market-west-tall": { "+x": "simple" },
  "market-west-low": { "+x": "simple" },
  "south-road-row": { "+z": "simple" },
};

export function facadeLevel(buildingId: string, facing: Facing): FacadeLevel {
  return LEVELS[buildingId]?.[facing] ?? "none";
}

/** The one window built as a real recess. Every other window uses a proud frame. */
export const RECESS_WINDOW = { buildingId: "ade-and-sons", facing: "+x" as const, bay: 4, floor: 2 };

const TRIM = {
  frame: "#2a2723",
  sill: "#efe6d0",
  rail: "#efe6d0",
  post: "#2a312e",
  slab: "#cfc6b6",
  grille: "#1c1b19",
  ac: "#5c5852",
  plinth: "#3a342c",
  /** Shop window bulkhead, the solid panel below the glass. */
  bulkhead: "#dccfb2",
  /** Doors. Open doorways get a cream frame with a gold cap; locked doors a dark frame and a painted leaf. */
  doorFrame: "#efe6d0",
  leaf: "#2f4a3a",
  panel: "#243c2f",
  gold: "#d9b04a",
  step: "#cfc6b6",
  /** Upper-floor glass is dark. Shopfront glass is lighter and shows a warm lit interior behind it. */
  shutter: "#bcc2c1",
  slat: "#7f8685",
  signboard: "#2a2723",
  glassDark: "#2b3b42",
  glassShop: "#9db8bb",
  interior: "#c99a62",
  shelf: "#5a4130",
};

/** Height of the centre of a business sign. */
const SIGN_Y = 4.22;

const AWNING_COLORS = ["#d9a62e", "#1d3226", "#efe6d0", "#c9694a"];

type WindowStyle = "tall" | "pair" | "wide";

const WINDOW_SIZE: Record<WindowStyle, { w: number; h: number }> = {
  tall: { w: 1.05, h: 1.75 },
  pair: { w: 1.65, h: 1.4 },
  wide: { w: 1.9, h: 1.05 },
};

export type FacadeRole =
  | "jamb"
  | "lintel"
  | "sill"
  | "mullion"
  | "frame"
  | "glass"
  | "interior"
  | "shelf"
  | "slat"
  | "signboard"
  | "grille"
  | "ac"
  | "slab"
  | "rail"
  | "post"
  | "doorframe"
  | "threshold"
  | "door"
  | "door-open"
  | "padlock"
  | "bulkhead"
  | "shutter"
  | "awning"
  | "fascia"
  | "plinth"
  | "canopy";

export type FacadePiece = {
  bucket: "trim" | "glass" | "shutter" | "awning";
  role: FacadeRole;
  bay: number;
  floor: number;
  spec: InstanceSpec;
};

export type SignSpot = {
  id: string;
  position: Vec3;
  yaw: number;
  width: number;
};

export type RecessOpening = {
  bay: number;
  floor: number;
  position: Vec3;
  yaw: number;
  openingW: number;
  openingH: number;
  depth: number;
};

export type FacadeLayout = {
  pieces: FacadePiece[];
  signs: SignSpot[];
  recess: RecessOpening | null;
};

const EMPTY: FacadeLayout = { pieces: [], signs: [], recess: null };

export type FacadeLayoutInput = {
  buildingId: string;
  facing: Facing;
  length: number;
  floors: number;
  tier: AssetTier;
  yaw: number;
  at: (offset: number, y: number, out: number) => Vec3;
  /** Floor heights, when the building's floors are not the standard ones (Palm Court's are 4.1 m apart). */
  storeys?: Storeys;
};

export type Storeys = { ground: number; upper: number };

const floorCenterY = (floor: number, storeys: Storeys): number => storeys.ground + (floor - 1) * storeys.upper + storeys.upper / 2;

/** Which signs hang over a building's doors, by the door's id. Every other building has one name sign over its first door. */
const DOOR_SIGNS: Record<string, string> = {
  "glow-pharmacy": "glow-pharmacy",
  "naija-phones": "naija-phones",
  "palm-court-lobby": "palm-court",
};

function windowStyle(level: FacadeLevel, bay: number, floor: number): WindowStyle {
  if (level === "light" || level === "simple") {
    return "tall";
  }
  if (level === "medium") {
    return bay % 2 === 0 ? "tall" : "pair";
  }
  const cycle = (bay + floor) % 3;
  return cycle === 0 ? "tall" : cycle === 1 ? "pair" : "wide";
}

/** Grilles and air-conditioners are desktop only: they are a few pixels tall on a phone. */
function wantsGrille(level: FacadeLevel, tier: AssetTier, bay: number): boolean {
  if (tier !== "desktop") {
    return false;
  }
  if (level === "full") {
    return bay % 2 === 0;
  }
  return level === "medium" && bay % 3 === 0;
}

function wantsAc(level: FacadeLevel, tier: AssetTier, bay: number, floor: number): boolean {
  if (tier !== "desktop") {
    return false;
  }
  if (level === "full") {
    return floor === 1 && bay % 3 === 1;
  }
  return level === "medium" && floor === 2 && bay % 4 === 0;
}

function wantsBalcony(level: FacadeLevel, bay: number, floor: number): boolean {
  if (level === "full") {
    return floor % 2 === 0 && bay % 2 === 1;
  }
  return level === "medium" && floor === 2 && bay % 2 === 0;
}

function fasciaColor(buildingId: string): string {
  if (buildingId === "ade-and-sons") {
    return "#1d3226";
  }
  if (buildingId === "glory-fabrics") {
    return "#efe6d0";
  }
  return "#2a312e";
}

/** Building-name sign, then one fictional shop sign, on the frontage the camera actually sees. */
function signPlan(buildingId: string, facing: Facing): { name: string; shop?: { id: string; along: number } } | null {
  if (buildingId === "ade-and-sons" && facing === "+x") {
    return { name: "ade-and-sons", shop: { id: "mallam-suya", along: 0.32 } };
  }
  if (buildingId === "glory-fabrics" && facing === "+z") {
    return { name: "glory-fabrics", shop: { id: "fresh-bread", along: 0.28 } };
  }
  if (buildingId === "zion-tyres" && facing === "+z") {
    return { name: "zion-tyres", shop: { id: "spare-parts", along: -0.28 } };
  }
  return null;
}

/** One shop sign on a market frontage. These reuse the shared atlas, so they add no draw call. */
const SIMPLE_SIGNS: Record<string, Partial<Record<Facing, string>>> = {
  "market-east-north": { "-x": "ankara-house" },
  "market-east-corner": { "-x": "mama-put" },
  "market-east-south": { "-x": "cold-room" },
  "market-west-north": { "+x": "fresh-bread" },
  "market-west-tall": { "+x": "mallam-suya" },
  "market-west-low": { "+x": "spare-parts" },
  "left-lean-to": { "+x": "welding-works" },
  "right-lean-to": { "-x": "carpentry" },
};

/**
 * Every box, sign and recess for one frontage. Pure: the same input always gives the same layout,
 * and a frontage with nothing to say returns no pieces at all.
 */
export function layoutFacade(input: FacadeLayoutInput): FacadeLayout {
  const level = facadeLevel(input.buildingId, input.facing);
  if (level === "none") {
    return EMPTY;
  }

  const pieces: FacadePiece[] = [];
  const { at, yaw, length, floors, tier, buildingId, facing } = input;
  const storeys = input.storeys ?? STOREY;
  const bays = bayCountOf(length);
  const bayWidth = length / bays;
  let recess: RecessOpening | null = null;

  const push = (
    bucket: FacadePiece["bucket"],
    role: FacadeRole,
    bay: number,
    floor: number,
    position: Vec3,
    scale: Vec3,
    color?: string,
    tilt = 0,
    turn = 0,
  ): void => {
    pieces.push({
      bucket,
      role,
      bay,
      floor,
      spec: {
        position,
        rotation: [tilt, yaw + turn, 0],
        rotationOrder: tilt === 0 ? "XYZ" : "YXZ",
        scale,
        color: color ?? (bucket === "glass" ? TRIM.glassDark : undefined),
      },
    });
  };

  const addProudWindow = (bay: number, floor: number, offset: number, y: number, w: number, h: number): void => {
    const out = 0.07;
    push("trim", "jamb", bay, floor, at(offset - w / 2, y, out), [0.08, h, 0.1], TRIM.frame);
    push("trim", "jamb", bay, floor, at(offset + w / 2, y, out), [0.08, h, 0.1], TRIM.frame);
    push("trim", "lintel", bay, floor, at(offset, y + h / 2, out), [w + 0.16, 0.1, 0.1], TRIM.frame);
    push("trim", "sill", bay, floor, at(offset, y - h / 2 - 0.04, 0.1), [w + 0.3, 0.08, 0.18], TRIM.sill);
    if (windowStyle(level, bay, floor) === "pair") {
      const paneW = w / 2 - 0.12;
      push("glass", "glass", bay, floor, at(offset - w / 4, y, 0.045), [paneW, h - 0.14, 0.02]);
      push("glass", "glass", bay, floor, at(offset + w / 4, y, 0.045), [paneW, h - 0.14, 0.02]);
      push("trim", "mullion", bay, floor, at(offset, y, out), [0.06, h, 0.1], TRIM.frame);
    } else {
      push("glass", "glass", bay, floor, at(offset, y, 0.045), [w - 0.12, h - 0.14, 0.02]);
    }
    if (wantsGrille(level, tier, bay)) {
      for (const side of [-0.22, 0.22]) {
        push("trim", "grille", bay, floor, at(offset + side * w, y, 0.13), [0.06, h * 0.72, 0.04], TRIM.grille);
      }
      push("trim", "grille", bay, floor, at(offset, y, 0.13), [w * 0.62, 0.06, 0.04], TRIM.grille);
    }
    if (wantsAc(level, tier, bay, floor)) {
      push("trim", "ac", bay, floor, at(offset + w * 0.2, y - h / 2 - 0.38, 0.22), [0.62, 0.36, 0.3], TRIM.ac);
    }
    if (wantsBalcony(level, bay, floor)) {
      const slabW = Math.min(bayWidth * 0.72, 2.4);
      const slabY = y - h / 2 - 0.2;
      push("trim", "slab", bay, floor, at(offset, slabY, 0.55), [slabW, 0.12, 1.05], TRIM.slab);
      push("trim", "rail", bay, floor, at(offset, slabY + 0.85, 1.02), [slabW, 0.045, 0.04], TRIM.rail);
      for (const side of [-0.42, -0.14, 0.14, 0.42]) {
        push("trim", "post", bay, floor, at(offset + side * slabW, slabY + 0.42, 1.02), [0.04, 0.84, 0.04], TRIM.post);
      }
    }
  };

  const doors = entrancesOnFrontage(buildingId, facing);
  // The business sign hangs above its door, above the awnings and the market canopies.
  const signOffset = doors.length > 0 ? (((doors[0] as EntranceDef).bay + 0.5) * bayWidth - length / 2) : 0;

  /**
   * A real door: frame, step, and a leaf that matches what the door does. Open doors are a gap in the
   * wall (the shell cuts it) with the leaf swung back. Closed shops have the roller shutter down.
   * Locked doors are shut, painted and padlocked. None of these is a dark rectangle.
   */
  const addDoor = (bay: number, offset: number, door: EntranceDef): void => {
    const half = doorHalf(door.state);
    const head = door.state === "open" ? DOOR_HEAD : DOOR_HEAD_SHUT;
    const frame = door.state === "locked" ? TRIM.frame : TRIM.doorFrame;
    push("trim", "doorframe", bay, 0, at(offset - half - 0.07, (head + 0.02) / 2, 0.07), [0.14, head + 0.02, 0.14], frame);
    push("trim", "doorframe", bay, 0, at(offset + half + 0.07, (head + 0.02) / 2, 0.07), [0.14, head + 0.02, 0.14], frame);
    push("trim", "doorframe", bay, 0, at(offset, head + 0.07, 0.07), [half * 2 + 0.42, 0.14, 0.14], frame);
    push("trim", "threshold", bay, 0, at(offset, 0.06, 0.32), [half * 2 + 0.3, 0.12, 0.65], TRIM.step);
    if (door.state === "open") {
      // Restrained gold on the lintel marks the way in, and the leaf is hooked back inside the reveal.
      push("trim", "doorframe", bay, 0, at(offset, head + 0.17, 0.07), [half * 2 + 0.5, 0.05, 0.16], TRIM.gold);
      // A sliding glass door has no leaf to hook back: its panels are live objects (glassDoor.ts), so the
      // facade leaves the opening clear. An open-front shop keeps its green leaf swung back inside the reveal.
      if (door.doorKind !== "sliding-glass") {
        const swing = 1.15;
        const leafW = 0.84;
        const hinge = offset + half - 0.03;
        push(
          "trim",
          "door-open",
          bay,
          0,
          at(hinge - (Math.cos(swing) * leafW) / 2, (head - 0.1) / 2, -0.1 - (Math.sin(swing) * leafW) / 2),
          [leafW, head - 0.1, 0.05],
          TRIM.leaf,
          0,
          -swing,
        );
      }
    } else if (door.state === "closed") {
      // A pale galvanised roller shutter with dark slat lines and a bottom rail. It is clearly shut, and
      // clearly lighter than the green painted doors of locked homes.
      push("trim", "shutter", bay, 0, at(offset, head / 2, 0.06), [half * 2, head, 0.05], TRIM.shutter);
      const slats = tier === "desktop" ? 8 : 5;
      for (let slat = 1; slat <= slats; slat += 1) {
        push("trim", "slat", bay, 0, at(offset, (head * slat) / (slats + 1), 0.092), [half * 2, 0.035, 0.03], TRIM.slat);
      }
      push("trim", "slat", bay, 0, at(offset, 0.07, 0.1), [half * 2, 0.14, 0.05], TRIM.slat);
    } else {
      push("trim", "door", bay, 0, at(offset, head / 2, 0.08), [half * 2 - 0.02, head - 0.04, 0.06], TRIM.leaf);
      push("trim", "door", bay, 0, at(offset, head * 0.7, 0.115), [half * 2 - 0.34, head * 0.34, 0.02], TRIM.panel);
      push("trim", "door", bay, 0, at(offset, head * 0.26, 0.115), [half * 2 - 0.34, head * 0.32, 0.02], TRIM.panel);
      push("trim", "padlock", bay, 0, at(offset + half * 0.55, 1.05, 0.14), [0.09, 0.12, 0.05], TRIM.gold);
    }
  };

  /** A shop window: raised on a solid bulkhead, framed, with a sill. Reads as glass, never as a door. */
  const addShopWindow = (bay: number, offset: number): void => {
    const w = bayWidth * 0.62;
    const bottom = 0.95;
    const top = 2.55;
    const h = top - bottom;
    const y = (top + bottom) / 2;
    push("trim", "jamb", bay, 0, at(offset - w / 2 - 0.05, y, 0.06), [0.1, h + 0.1, 0.12], TRIM.frame);
    push("trim", "jamb", bay, 0, at(offset + w / 2 + 0.05, y, 0.06), [0.1, h + 0.1, 0.12], TRIM.frame);
    push("trim", "lintel", bay, 0, at(offset, top + 0.05, 0.06), [w + 0.2, 0.1, 0.12], TRIM.frame);
    push("trim", "sill", bay, 0, at(offset, bottom - 0.04, 0.1), [w + 0.3, 0.08, 0.2], TRIM.sill);
    // A lit interior behind the glass: a warm back panel and a shelf, so the window is not a black box.
    push("trim", "interior", bay, 0, at(offset, y, 0.02), [w, h, 0.02], TRIM.interior);
    if (tier === "desktop") {
      push("trim", "shelf", bay, 0, at(offset, y - h * 0.08, 0.05), [w * 0.92, 0.05, 0.16], TRIM.shelf);
    }
    push("glass", "glass", bay, 0, at(offset, y, 0.045), [w, h, 0.02], TRIM.glassShop);
    if (w > 2.2) {
      push("trim", "mullion", bay, 0, at(offset, y, 0.06), [0.06, h, 0.1], TRIM.frame);
    }
    if (level === "simple") {
      push("trim", "bulkhead", bay, 0, at(offset, (bottom - 0.08) / 2, 0.05), [w + 0.2, bottom - 0.08, 0.1], TRIM.bulkhead);
    }
  };

  for (let bay = 0; bay < bays; bay += 1) {
    const offset = (bay + 0.5) * bayWidth - length / 2;

    // Every bay is a door (from the entrance table) or a window. Nothing else is door-shaped, so a
    // door-shaped opening always is a door.
    const door = doors.find((entry) => entry.bay === bay);
    if (door) {
      addDoor(bay, offset, door);
    } else {
      addShopWindow(bay, offset);
    }

    const marketAwning = level === "simple" && (buildingId.startsWith("market-") || buildingId.startsWith("south-road"));
    if (marketAwning || (level !== "simple" && level !== "full" && bay % 3 === 0)) {
      push("awning", "awning", bay, 0, at(offset, 2.95, 0.7), [bayWidth * 0.72, 0.05, 1.25], AWNING_COLORS[bay % AWNING_COLORS.length], 0.4);
    }

    if (level === "simple") {
      for (let floor = 1; floor < floors; floor += 1) {
        const y = floorCenterY(floor, storeys);
        push("trim", "frame", bay, floor, at(offset, y, 0.04), [1.15, 1.7, 0.07], TRIM.frame);
        push("glass", "glass", bay, floor, at(offset, y, 0.07), [0.9, 1.4, 0.02]);
      }
      continue;
    }

    for (let floor = 1; floor < floors; floor += 1) {
      const style = windowStyle(level, bay, floor);
      const size = WINDOW_SIZE[style];
      const w = Math.min(size.w, bayWidth * 0.7);
      const h = size.h;
      const y = floorCenterY(floor, storeys);
      const isRecess =
        buildingId === RECESS_WINDOW.buildingId &&
        facing === RECESS_WINDOW.facing &&
        bay === RECESS_WINDOW.bay &&
        floor === RECESS_WINDOW.floor;
      if (isRecess) {
        push("glass", "glass", bay, floor, at(offset, y, 0.04), [w - 0.08, h - 0.1, 0.02]);
        const depth = 0.2;
        recess = { bay, floor, position: at(offset, y, 0.015 + depth / 2), yaw, openingW: w, openingH: h, depth };
      } else {
        addProudWindow(bay, floor, offset, y, w, h);
      }
    }
  }

  /**
   * A business sign on a dark board, above its door. Its lowest edge clears the awnings and the market
   * canopies (which top out near 3.6 m), and its top edge stays under the first-floor windows.
   */
  const signboard = (id: string, offset: number, y: number, width: number): SignSpot => {
    push("trim", "signboard", -1, 0, at(offset, y, 0.15), [width + 0.14, width / 4 + 0.14, 0.06], TRIM.signboard);
    return { id, position: at(offset, y, 0.2), yaw, width };
  };

  if (level === "simple") {
    const signId = SIMPLE_SIGNS[buildingId]?.[facing];
    const signs: SignSpot[] = signId ? [signboard(signId, signOffset, SIGN_Y, Math.min(4.2, Math.max(3.2, bayWidth * 1.1)))] : [];
    return { pieces, signs, recess: null };
  }

  push("trim", "fascia", -1, 0, at(0, 3.55, 0.09), [length * 0.96, 0.34, 0.1], fasciaColor(buildingId));
  // The plinth runs under the windows and stops for each door.
  const gaps = doors
    .map((door) => {
      const offset = (door.bay + 0.5) * bayWidth - length / 2;
      const clear = doorHalf(door.state) + 0.25;
      return [offset - clear, offset + clear] as const;
    })
    .sort((a, b) => a[0] - b[0]);
  let cursor = -length * 0.49;
  for (const [from, to] of [...gaps, [length * 0.49, length * 0.49] as const]) {
    if (from - cursor > 0.2) {
      push("trim", "plinth", -1, 0, at((cursor + from) / 2, 0.4, 0.07), [from - cursor, 0.8, 0.1], TRIM.plinth);
    }
    cursor = Math.max(cursor, to);
  }
  if (level === "full") {
    push("shutter", "canopy", -1, 0, at(0, 3.15, 0.72), [length * 0.9, 0.05, 1.2], undefined, 0.34);
  }

  const signs: SignSpot[] = [];
  const named = doors.filter((door) => DOOR_SIGNS[door.id] !== undefined);
  if (named.length > 0) {
    // A building with several shops: each door carries its own sign, on its own board.
    for (const door of named) {
      const offset = (door.bay + 0.5) * bayWidth - length / 2;
      signs.push(signboard(DOOR_SIGNS[door.id] as string, offset, SIGN_Y, Math.min(3.3, bayWidth * 0.96)));
    }
    return { pieces, signs, recess };
  }
  const planned = signPlan(buildingId, facing);
  if (planned) {
    signs.push(signboard(planned.name, signOffset, SIGN_Y, Math.min(4.4, Math.max(3.2, length * 0.42))));
    if (planned.shop) {
      signs.push({
        id: planned.shop.id,
        position: at(planned.shop.along * (length / 2), 2.35, 0.16),
        yaw,
        width: 2.3,
      });
    }
  }

  return { pieces, signs, recess };
}
