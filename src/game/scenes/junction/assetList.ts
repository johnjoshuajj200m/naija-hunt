/**
 * The Poly Haven (CC0) files the Palm Mile hero junction uses. Everything under public/assets/ must be
 * listed here and everything listed here must exist there; assetList.test.ts enforces both directions,
 * so an unused processed file cannot be committed by accident. Licence records: docs/ASSET_LICENSES.md.
 */

export type AssetTier = "desktop" | "mobile";

export const TEXTURE_IDS = [
  "asphalt_02",
  "brick_pavement_02",
  "painted_plaster_wall",
  "beige_wall_001",
  "concrete",
  "corrugated_iron_02",
  "red_laterite_soil_stones",
] as const;
export type TextureId = (typeof TEXTURE_IDS)[number];

/** Real-world size of one texture tile in metres (Poly Haven's published value). Sets texel density. */
export const TEXTURE_TILE_METRES: Record<TextureId, number> = {
  asphalt_02: 3,
  brick_pavement_02: 2,
  painted_plaster_wall: 2,
  beige_wall_001: 3,
  concrete: 4,
  corrugated_iron_02: 2.7,
  red_laterite_soil_stones: 2,
};

export const TEXTURE_MAPS = ["diff", "nor", "arm"] as const;
export type TextureMap = (typeof TEXTURE_MAPS)[number];

export const PROP_IDS = [
  "plastic_monobloc_chair_01",
  "Barrel_01",
  "wooden_crate_01",
  "old_tyre",
  "utility_box_02",
] as const;
export type PropId = (typeof PROP_IDS)[number];

export const ASSET_TIERS: readonly AssetTier[] = ["desktop", "mobile"];

/** Lighting and reflections only. Never assigned to scene.background. */
export const HDRI_FILE = "hdri/sunset_jhbcentral_1k.hdr";

const base = (): string => import.meta.env.BASE_URL;

/** Path of an asset relative to public/assets/. */
export const texturePath = (tier: AssetTier, id: TextureId, map: TextureMap): string =>
  `textures/${tier}/${id}/${map}.webp`;
export const propPath = (tier: AssetTier, id: PropId): string => `props/${tier}/${id}.glb`;

export const assetUrl = (relativePath: string): string => `${base()}assets/${relativePath}`;

/** Every file the app can request, relative to public/assets/. Used by tests and nothing at runtime. */
export function allAssetPaths(): string[] {
  const paths: string[] = [HDRI_FILE];
  for (const tier of ASSET_TIERS) {
    for (const id of TEXTURE_IDS) {
      for (const map of TEXTURE_MAPS) {
        paths.push(texturePath(tier, id, map));
      }
    }
    for (const id of PROP_IDS) {
      paths.push(propPath(tier, id));
    }
  }
  return paths;
}

/**
 * Phones and tablets get the small tier. The decision uses the same 1024 px breakpoint as the menu
 * layout, and also treats a touch-first device as small whatever its window width, because texture
 * memory, not width, is the constraint there.
 */
export const COMPACT_LAYOUT_MAX_WIDTH = 1023;

export function chooseAssetTier(viewportWidth: number, coarsePointer: boolean): AssetTier {
  return viewportWidth <= COMPACT_LAYOUT_MAX_WIDTH || coarsePointer ? "mobile" : "desktop";
}

export function detectAssetTier(): AssetTier {
  const coarse = typeof window.matchMedia === "function" && window.matchMedia("(pointer: coarse)").matches;
  return chooseAssetTier(window.innerWidth, coarse);
}
