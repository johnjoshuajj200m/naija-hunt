import { BUILDINGS } from "../scenes/junction/junctionBuildings";
import { doorwaysCollision, footprintBox } from "./entrances";
import { WORLD_ENTRANCES } from "./entranceWorld";
import type { CameraVolume } from "./cameraRig";
import { PLAY_BOUNDS, type Aabb } from "./movement";

/** Parked buses the explorer should walk around. Sizes match the procedural danfo, roughly. */
const BUSES: Aabb[] = [
  { minX: -1.6, maxX: 3.4, minZ: 7.2, maxZ: 9.8 },
  { minX: -4.6, maxX: -2.2, minZ: -12, maxZ: -7 },
  { minX: -24.6, maxX: -19.4, minZ: -26, maxZ: -23.2 },
  { minX: 2, maxX: 4.4, minZ: -46.5, maxZ: -41.5 },
  { minX: -4.4, maxX: -2, minZ: -64.5, maxZ: -59.5 },
];

/** Flyover piers. The deck is overhead, so only the piers block a person. */
const PIERS: Aabb[] = [-62, -44, -26, -9, 9, 26, 44, 62].map((x) => ({
  minX: x - 1.1,
  maxX: x + 1.1,
  minZ: -74.4,
  maxZ: -69.6,
}));

/** The plaza tower. The canopy is open underneath and is not a wall. */
const TOWER: Aabb = { minX: -111.8, maxX: -108.2, minZ: -8.8, maxZ: -5.2 };

/**
 * Every solid the explorer cannot pass: buildings, the tower, piers and parked buses. A building with an
 * open door is solid except for its doorway notch. Closed and locked doors do not change the footprint,
 * so those buildings cannot be entered at all.
 */
export function collisionBoxes(): Aabb[] {
  const buildings = BUILDINGS.flatMap((building) => {
    const open = WORLD_ENTRANCES.filter((entrance) => entrance.buildingId === building.id && entrance.state === "open");
    return open.length > 0 ? doorwaysCollision(building, open) : [footprintBox(building)];
  });
  return [...buildings, TOWER, ...PIERS, ...BUSES];
}

/**
 * What the street follow camera may not enter. Every building is a solid block here, doorway or not: the
 * walkable notch at a door is a 2D pocket under a lintel, and a camera at head height above the player
 * would otherwise slide into it and end up inside the wall. Market buildings are padded by their awnings,
 * which reach 1.35 m past the wall, so the camera stays outside them and not under them.
 */
const AWNING_CLEARANCE = 1.4;

const FOOTPRINTS = BUILDINGS.map((building) => {
  const base = footprintBox(building);
  const awninged = building.id.startsWith("market-") || building.id.startsWith("south-road");
  const padded: Aabb = awninged
    ? {
        minX: base.minX - AWNING_CLEARANCE,
        maxX: base.maxX + AWNING_CLEARANCE,
        minZ: base.minZ - AWNING_CLEARANCE,
        maxZ: base.maxZ + AWNING_CLEARANCE,
      }
    : base;
  return { base, padded };
});

const OTHER_SOLIDS: Aabb[] = [TOWER, ...PIERS, ...BUSES];
const PADDED_SOLIDS: Aabb[] = [...FOOTPRINTS.map((entry) => entry.padded), ...OTHER_SOLIDS];

export function cameraBoxes(): Aabb[] {
  return PADDED_SOLIDS;
}

/**
 * The camera's solids for a player standing at (x, z). A player who is inside a building's awning padding
 * (at its door, say) is measured against the wall itself, so the camera can still stand behind them
 * instead of being pushed up against them.
 */
export function cameraSolidsAt(x: number, z: number): readonly Aabb[] {
  let near = false;
  for (const entry of FOOTPRINTS) {
    if (entry.padded !== entry.base && x > entry.padded.minX && x < entry.padded.maxX && z > entry.padded.minZ && z < entry.padded.maxZ) {
      near = true;
      break;
    }
  }
  if (!near) {
    return PADDED_SOLIDS;
  }
  return [
    ...FOOTPRINTS.map((entry) =>
      x > entry.padded.minX && x < entry.padded.maxX && z > entry.padded.minZ && z < entry.padded.maxZ ? entry.base : entry.padded,
    ),
    ...OTHER_SOLIDS,
  ];
}

/** Where the street camera may be: anywhere on the playable ground that is not a building, the tower, a pier or a bus. */
export const STREET_CAMERA: CameraVolume = { regions: [PLAY_BOUNDS], solids: cameraSolidsAt };
