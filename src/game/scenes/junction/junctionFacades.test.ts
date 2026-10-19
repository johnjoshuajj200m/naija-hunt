import * as THREE from "three";
import { describe, expect, it } from "vitest";

import { ENTRANCES, entranceForBay, resolveEntrance } from "../../explore/entrances";
import { BUILDINGS, layoutFrontage, type Building } from "./junctionBuildings";
import {
  facadeLevel,
  layoutFacade,
  RECESS_WINDOW,
  type FacadeLayout,
  type FacadeLayoutInput,
  type Facing,
} from "./junctionFacades";
import { paintWallVariation } from "./junctionKit";
import { createRecessPanel, recessTriangleCount } from "./junctionRecess";
import { estimateSignBytes, SIGN_CELLS, SIGN_PAD, signAtlasSize, signCellPixels } from "./junctionSigns";

const FACINGS: Facing[] = ["+x", "-x", "+z", "-z"];

const inputFor = (building: Building, facing: Facing, tier: "desktop" | "mobile"): FacadeLayoutInput => {
  const alongZ = facing === "+x" || facing === "-x";
  return {
    buildingId: building.id,
    facing,
    length: Math.abs(alongZ ? building.z0 - building.z1 : building.x1 - building.x0),
    floors: building.floors,
    tier,
    yaw: 0,
    at: (offset, y, out) => [offset, y, out],
  };
};

const layoutOf = (id: string, facing: Facing, tier: "desktop" | "mobile" = "desktop"): FacadeLayout => {
  const building = BUILDINGS.find((entry) => entry.id === id);
  if (!building) {
    throw new Error(id);
  }
  return layoutFacade(inputFor(building, facing, tier));
};

const roles = (layout: FacadeLayout, role: string): number => layout.pieces.filter((piece) => piece.role === role).length;

describe("facade levels", () => {
  it("gives the approved treatment to the frontages the camera sees", () => {
    expect(facadeLevel("ade-and-sons", "+x")).toBe("full");
    expect(facadeLevel("glory-fabrics", "+z")).toBe("medium");
    expect(facadeLevel("zion-tyres", "+z")).toBe("medium");
    expect(facadeLevel("glory-fabrics", "+x")).toBe("light");
    expect(facadeLevel("zion-tyres", "-x")).toBe("light");
  });

  it("leaves away-facing and behind-the-camera frontages empty", () => {
    const bare = ["palm-mile-pharmacy", "buka-and-grill", "cross-near-right"];
    for (const id of bare) {
      for (const facing of FACINGS) {
        expect(facadeLevel(id, facing), id).toBe("none");
        expect(layoutOf(id, facing).pieces, id).toHaveLength(0);
      }
    }
    expect(facadeLevel("ade-and-sons", "-z")).toBe("none");
    expect(layoutOf("ade-and-sons", "-z").pieces).toHaveLength(0);
    expect(layoutFrontage(BUILDINGS.find((entry) => entry.id === "palm-mile-pharmacy") as Building, "+x", "desktop")).toBeNull();
  });

  it("gives Palm Court a front with three shop doors, a sign over each and windows on both upper floors", () => {
    expect(facadeLevel("palm-court", "-z")).toBe("medium");
    for (const facing of ["+x", "-x", "+z"] as const) {
      expect(facadeLevel("palm-court", facing), facing).toBe("none");
    }
    const layout = layoutOf("palm-court", "-z");
    expect(roles(layout, "threshold")).toBe(3);
    expect(layout.signs.map((sign) => sign.id).sort()).toEqual(["glow-pharmacy", "naija-phones", "palm-court"]);
    const upperGlass = layout.pieces.filter((piece) => piece.role === "glass" && piece.floor > 0);
    expect([...new Set(upperGlass.map((piece) => piece.floor))].sort()).toEqual([1, 2]);
  });
});

describe("layoutFacade", () => {
  it("leaves a ground-floor opening in Mama Put's market front", () => {
    const layout = layoutOf("market-east-corner", "-x");
    const ground = layout.pieces.filter((piece) => piece.floor === 0 && piece.bay === 2);
    const kinds = new Set(ground.map((piece) => piece.role));
    // A frame, a threshold and an awning. The opening is clear: Mama Put's sliding glass panels are live
    // objects (glassDoor.ts), so the static facade carries no leaf, glass or shutter in it.
    expect(kinds).toEqual(new Set(["doorframe", "threshold", "awning"]));
    expect(layout.signs.map((sign) => sign.id)).toEqual(["mama-put"]);
    expect(layout.pieces.some((piece) => piece.floor > 0 && piece.bay === 2 && piece.role === "frame")).toBe(true);
  });

  it("draws an open, a closed and a locked entrance differently", () => {
    const groundAt = (id: string, facing: Facing, bay: number) =>
      new Set(layoutOf(id, facing).pieces.filter((piece) => piece.floor === 0 && piece.bay === bay).map((piece) => piece.role));

    // Fresh Bread is an open-front shop: its leaf stands open inside the reveal.
    const open = groundAt("market-west-north", "+x", 1);
    const glass = groundAt("market-east-corner", "-x", 2);
    const closed = groundAt("ade-and-sons", "+x", 2);
    const locked = groundAt("market-east-far", "-x", 3);

    expect(open.has("door-open")).toBe(true);
    expect(open.has("shutter")).toBe(false);
    expect(open.has("padlock")).toBe(false);

    expect(glass.has("doorframe")).toBe(true);
    expect(glass.has("door-open")).toBe(false);
    expect(glass.has("shutter")).toBe(false);

    expect(closed.has("doorframe")).toBe(true);
    expect(closed.has("shutter")).toBe(true);
    expect(closed.has("door-open")).toBe(false);

    expect(locked.has("doorframe")).toBe(true);
    expect(locked.has("door")).toBe(true);
    expect(locked.has("padlock")).toBe(true);
    expect(locked.has("door-open")).toBe(false);
    expect(locked.has("shutter")).toBe(false);
  });

  it("names every shop above its own door, clear of the awnings and the first-floor windows", () => {
    const cellText = (id: string) => SIGN_CELLS.find((cell) => cell.id === id)?.text ?? "";
    for (const entrance of ENTRANCES.filter((row) => row.type !== "residential")) {
      const building = BUILDINGS.find((entry) => entry.id === entrance.buildingId) as Building;
      const layout = layoutFrontage(building, entrance.facing, "desktop");
      expect(layout, entrance.id).not.toBeNull();
      const door = resolveEntrance(entrance, building).door;
      const named = (layout?.signs ?? []).filter((sign) => cellText(sign.id).startsWith(entrance.name.toUpperCase()));
      expect(named.length, `${entrance.name} has a sign`).toBe(1);
      const sign = named[0] as NonNullable<typeof named[0]>;
      // Above the door along the street.
      const along = entrance.facing === "+x" || entrance.facing === "-x" ? sign.position[2] - door.z : sign.position[0] - door.x;
      expect(Math.abs(along), entrance.id).toBeLessThan(0.05);
      // The lowest edge is above the awnings and the market canopies (3.6 m). The top is under the first-floor windows (4.8 m).
      expect(sign.position[1] - sign.width / 8, entrance.id).toBeGreaterThan(3.65);
      expect(sign.position[1] + sign.width / 8, entrance.id).toBeLessThan(4.85);
      // Wide enough to read: a letter is about a third of the board's height.
      expect(sign.width, entrance.id).toBeGreaterThanOrEqual(3.2);
    }
  });

  it("has no shutter-shaped bay anywhere except on a closed door", () => {
    for (const building of BUILDINGS) {
      for (const facing of FACINGS) {
        const layout = layoutOf(building.id, facing);
        for (const piece of layout.pieces.filter((entry) => entry.role === "shutter")) {
          const door = entranceForBay(building.id, facing, piece.bay);
          expect(door?.state, `${building.id} ${facing} bay ${piece.bay}`).toBe("closed");
        }
      }
    }
  });

  it("gives every table entrance a frame and a threshold, and never an unframed dark opening", () => {
    for (const entrance of ENTRANCES) {
      const building = BUILDINGS.find((entry) => entry.id === entrance.buildingId) as Building;
      const layout = layoutOf(building.id, entrance.facing);
      const bay = layout.pieces.filter((piece) => piece.floor === 0 && piece.bay === entrance.bay);
      const rolesHere = new Set(bay.map((piece) => piece.role));
      expect(rolesHere.has("doorframe"), entrance.id).toBe(true);
      expect(rolesHere.has("threshold"), entrance.id).toBe(true);
    }
    for (const building of BUILDINGS) {
      for (const facing of FACINGS) {
        const used = new Set(layoutOf(building.id, facing).pieces.map((piece) => piece.role as string));
        expect(used.has("opening"), `${building.id} ${facing}`).toBe(false);
      }
    }
  });

  it("is deterministic", () => {
    const building = BUILDINGS.find((entry) => entry.id === "ade-and-sons") as Building;
    const input = inputFor(building, "+x", "desktop");
    expect(layoutFacade(input)).toEqual(layoutFacade(input));
  });

  it("puts grilles and air-conditioners on desktop only", () => {
    const desktop = layoutOf("ade-and-sons", "+x", "desktop");
    const mobile = layoutOf("ade-and-sons", "+x", "mobile");
    expect(roles(desktop, "grille")).toBeGreaterThan(0);
    expect(roles(desktop, "ac")).toBeGreaterThan(0);
    expect(roles(mobile, "grille")).toBe(0);
    expect(roles(mobile, "ac")).toBe(0);
    const shopfront = (tier: "desktop" | "mobile") => layoutOf("market-east-south", "-x", tier);
    expect(roles(shopfront("desktop"), "shelf")).toBeGreaterThan(0);
    expect(roles(shopfront("mobile"), "shelf")).toBe(0);
    // Both tiers show a lit interior behind every shop window.
    expect(roles(shopfront("mobile"), "interior")).toBe(roles(shopfront("desktop"), "interior"));
    expect(roles(shopfront("mobile"), "interior")).toBeGreaterThan(0);
    expect(roles(layoutOf("zion-tyres", "+z", "mobile"), "grille")).toBe(0);
    expect(roles(layoutOf("glory-fabrics", "+x", "desktop"), "grille")).toBe(0);
  });

  it("recesses exactly one ADE window and does not also frame it", () => {
    const layout = layoutOf("ade-and-sons", "+x", "desktop");
    expect(layout.recess).toMatchObject({ bay: RECESS_WINDOW.bay, floor: RECESS_WINDOW.floor });
    const framed = layout.pieces.some(
      (piece) => piece.role === "jamb" && piece.bay === RECESS_WINDOW.bay && piece.floor === RECESS_WINDOW.floor,
    );
    const glazed = layout.pieces.some(
      (piece) => piece.role === "glass" && piece.bay === RECESS_WINDOW.bay && piece.floor === RECESS_WINDOW.floor,
    );
    expect(framed).toBe(false);
    expect(glazed).toBe(true);
    for (const building of BUILDINGS) {
      for (const facing of FACINGS) {
        if (building.id === "ade-and-sons" && facing === "+x") {
          continue;
        }
        expect(layoutOf(building.id, facing).recess, building.id).toBeNull();
      }
    }
  });

  it("uses the fictional shop signs and no others", () => {
    const ids = [
      ...layoutOf("ade-and-sons", "+x").signs,
      ...layoutOf("glory-fabrics", "+z").signs,
      ...layoutOf("zion-tyres", "+z").signs,
    ].map((sign) => sign.id);
    expect(ids).toEqual(["ade-and-sons", "mallam-suya", "glory-fabrics", "fresh-bread", "zion-tyres", "spare-parts"]);
    expect(layoutOf("glory-fabrics", "+x").signs).toHaveLength(0);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) {
      expect(SIGN_CELLS.some((cell) => cell.id === id)).toBe(true);
    }
  });

  it("stays inside a triangle budget that leaves the scene under its cap", () => {
    // One box is 12 triangles. The recess panel is counted separately. Shadowed pieces are the
    // shutters, canopies and awnings, which the shadow pass draws a second time.
    for (const tier of ["desktop", "mobile"] as const) {
      let main = 0;
      let shadowed = 0;
      for (const building of BUILDINGS) {
        for (const facing of FACINGS) {
          const layout = layoutOf(building.id, facing, tier);
          main += layout.pieces.length * 12;
          shadowed += layout.pieces.filter((piece) => piece.bucket === "shutter" || piece.bucket === "awning").length * 12;
        }
      }
      // Baseline scene is about 86k (mobile) and 188k (desktop). This is the facade's own cost,
      // counted once for the main pass and again for the pieces that cast shadows.
      expect(main + shadowed, tier).toBeLessThan(tier === "mobile" ? 30000 : 34000);
    }
  });
});

describe("paintWallVariation", () => {
  it("keeps the top of a wall lighter than its base", () => {
    const geometry = new THREE.BoxGeometry(2, 10, 2);
    paintWallVariation(geometry, "#e5bd8a");
    const color = geometry.getAttribute("color");
    const position = geometry.getAttribute("position");
    let bottom = 0;
    let top = 0;
    let bottomCount = 0;
    let topCount = 0;
    for (let i = 0; i < position.count; i += 1) {
      const lightness = color.getX(i) + color.getY(i) + color.getZ(i);
      if (position.getY(i) < -4) {
        bottom += lightness;
        bottomCount += 1;
      }
      if (position.getY(i) > 4) {
        top += lightness;
        topCount += 1;
      }
    }
    expect(top / topCount).toBeGreaterThan(bottom / bottomCount);
  });
});

describe("sign atlas", () => {
  it("pads cells so they neither touch nor overflow the canvas", () => {
    const { width, height } = signAtlasSize();
    const rects = SIGN_CELLS.map((_, index) => signCellPixels(index));
    for (const rect of rects) {
      expect(rect.x).toBeGreaterThanOrEqual(SIGN_PAD);
      expect(rect.y).toBeGreaterThanOrEqual(SIGN_PAD);
      expect(rect.x + rect.w).toBeLessThanOrEqual(width - SIGN_PAD);
      expect(rect.y + rect.h).toBeLessThanOrEqual(height);
    }
    for (let i = 0; i < rects.length - 1; i += 1) {
      const below = rects[i] as (typeof rects)[number];
      const above = rects[i + 1] as (typeof rects)[number];
      expect(above.y - (below.y + below.h)).toBeGreaterThanOrEqual(SIGN_PAD);
    }
  });

  it("costs little more than one texture per sign", () => {
    const { separate, atlas } = estimateSignBytes();
    expect(atlas).toBeGreaterThan(separate);
    expect(atlas).toBeLessThan(separate * 1.4);
  });
});

describe("recess panel", () => {
  it("is one small holed panel, not a rebuilt facade", () => {
    const geometry = createRecessPanel(1.05, 1.75, 0.22, 0.12, "#e5bd8a");
    const triangles = recessTriangleCount(geometry);
    expect(triangles).toBeGreaterThan(20);
    expect(triangles).toBeLessThan(150);
    expect(geometry.getAttribute("color").count).toBe(geometry.getAttribute("position").count);
    expect(geometry.getAttribute("uv").count).toBe(geometry.getAttribute("position").count);
  });
});
