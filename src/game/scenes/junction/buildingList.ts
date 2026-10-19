import type { TextureId } from "./assetList";
import type { Facing } from "./frontage";
import { CROSS_FAR_Z, CROSS_NEAR_Z, ROAD_HALF, SIDEWALK_WIDTH } from "./junctionLayout";

/**
 * The district's building footprints. Data only, so the entrance table, the interiors and the
 * collision list can read it without pulling in the scene builders (which read them back).
 */

export type Building = {
  id: string;
  x0: number;
  x1: number;
  z0: number;
  z1: number;
  /** Storeys including the ground floor. */
  floors: number;
  tint: string;
  wall?: TextureId;
  faces: Facing[];
  roof?: "flat" | "lean-to";
  tank?: boolean;
};

/** Building line: set back 10 cm from the pavement edge so the two never share a face. */
const AVENUE_LINE = ROAD_HALF + SIDEWALK_WIDTH + 0.1;
const NEAR_CROSS_LINE = CROSS_NEAR_Z + SIDEWALK_WIDTH + 0.1;
const FAR_CROSS_LINE = CROSS_FAR_Z - SIDEWALK_WIDTH - 0.1;

const left = (id: string, z0: number, z1: number, floors: number, tint: string, extra: Partial<Building> = {}): Building => ({
  id,
  x0: -AVENUE_LINE - 15,
  x1: -AVENUE_LINE,
  z0,
  z1,
  floors,
  tint,
  faces: ["+x"],
  ...extra,
});

const right = (id: string, z0: number, z1: number, floors: number, tint: string, extra: Partial<Building> = {}): Building => ({
  id,
  x0: AVENUE_LINE,
  x1: AVENUE_LINE + 15,
  z0,
  z1,
  floors,
  tint,
  faces: ["-x"],
  ...extra,
});

export const BUILDINGS: Building[] = [
  left("palm-mile-pharmacy", 22, 8, 3, "#d2825f"),
  left("ade-and-sons", 8, -12.9, 4, "#e5bd8a", { faces: ["+x", "-z"], tank: true }),
  right("buka-and-grill", 19, 5, 3, "#a7bda0"),
  left("glory-fabrics", -35.1, -55, 5, "#dba86c", { faces: ["+x", "+z"], wall: "beige_wall_001" }),
  // The flyover crosses at z = -72, so both rows leave a gap there.
  left("left-lean-to", -55, -64, 4, "#c9694a", { roof: "lean-to" }),
  left("left-far", -80, -102, 6, "#e6d3a8", { wall: "beige_wall_001" }),
  right("zion-tyres", -35.1, -55, 6, "#cf9068", { faces: ["-x", "+z"], tank: true }),
  right("right-lean-to", -55, -64, 4, "#8fa88a", { roof: "lean-to" }),
  right("right-far", -80, -105, 7, "#e0b98d", { wall: "beige_wall_001" }),
  // Palm Court: the three-storey commercial building (explore/court). Its shell and facade are its own.
  { id: "palm-court", x0: -52, x1: -28, z0: 8, z1: NEAR_CROSS_LINE, floors: 3, tint: "#d8b48c", faces: ["-z"] },
  { id: "cross-near-right", x0: 28, x1: 54, z0: 4, z1: NEAR_CROSS_LINE, floors: 3, tint: "#b8c4a6", faces: ["-z"], wall: "beige_wall_001" },
  { id: "cross-far-left", x0: -64, x1: -28, z0: FAR_CROSS_LINE, z1: -58, floors: 4, tint: "#d9ae80", faces: ["+z"] },
  { id: "cross-far-right", x0: 28, x1: 62, z0: FAR_CROSS_LINE, z1: -60, floors: 5, tint: "#cc8a64", faces: ["+z"] },
  // West of the junction: the market street's two sides, and a row along the south road.
  // Footprints stay off the carriageways (market road x=-91..-81, cross street z=-30..-18, south road z=-107..-97).
  { id: "market-east-north", x0: -78, x1: -66, z0: 20, z1: 4, floors: 3, tint: "#d2825f", faces: ["-x"] },
  { id: "market-east-corner", x0: -78, x1: -66, z0: 2, z1: -10, floors: 4, tint: "#e5bd8a", faces: ["-x", "-z"] },
  { id: "market-east-south", x0: -78, x1: -66, z0: -40, z1: -64, floors: 5, tint: "#c9694a", faces: ["-x"] },
  { id: "market-east-far", x0: -78, x1: -66, z0: -68, z1: -92, floors: 3, tint: "#dba86c", faces: ["-x"] },
  { id: "market-west-north", x0: -128, x1: -116, z0: 18, z1: 2, floors: 4, tint: "#cf9068", faces: ["+x"] },
  { id: "market-west-tall", x0: -128, x1: -116, z0: -42, z1: -70, floors: 6, tint: "#a7bda0", faces: ["+x"] },
  { id: "market-west-low", x0: -128, x1: -116, z0: -74, z1: -98, floors: 2, tint: "#e6d3a8", faces: ["+x"] },
  { id: "south-road-row", x0: -110, x1: -40, z0: -112, z1: -126, floors: 3, tint: "#c9a07a", faces: ["+z"] },
];
