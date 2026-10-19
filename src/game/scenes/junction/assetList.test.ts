import { describe, expect, it } from "vitest";

import {
  allAssetPaths,
  assetUrl,
  chooseAssetTier,
  HDRI_FILE,
  PROP_IDS,
  propPath,
  TEXTURE_IDS,
  texturePath,
} from "./assetList";

// Keys only: the files are never imported, this just lists what exists in public/assets/.
const onDisk = Object.keys(import.meta.glob("../../../../public/assets/**/*.{webp,glb,hdr}", { query: "?url" })).map(
  (key) => key.replace("../../../../public/assets/", ""),
);

describe("asset tier selection", () => {
  it("gives phones the mobile tier and wide desktops the desktop tier", () => {
    expect(chooseAssetTier(390, true)).toBe("mobile");
    expect(chooseAssetTier(1440, false)).toBe("desktop");
    expect(chooseAssetTier(1100, false)).toBe("desktop");
  });

  it("uses the same breakpoint as the menu: 1024 px and wider is the wide layout", () => {
    expect(chooseAssetTier(1023, false)).toBe("mobile");
    expect(chooseAssetTier(1024, false)).toBe("desktop");
  });

  it("gives a touch-first device the mobile tier even in a wide window", () => {
    expect(chooseAssetTier(1366, true)).toBe("mobile");
  });
});

describe("asset paths", () => {
  it("builds tier-specific texture and prop paths", () => {
    expect(texturePath("mobile", "asphalt_02", "nor")).toBe("textures/mobile/asphalt_02/nor.webp");
    expect(propPath("desktop", "Barrel_01")).toBe("props/desktop/Barrel_01.glb");
  });

  it("prefixes the Vite base so the app works from a sub-path", () => {
    expect(assetUrl("hdri/x.hdr")).toBe(`${import.meta.env.BASE_URL}assets/hdri/x.hdr`);
  });

  it("lists each tier's files once: 7 texture sets x 3 maps + 5 props, plus one shared HDRI", () => {
    const paths = allAssetPaths();
    expect(new Set(paths).size).toBe(paths.length);
    expect(paths).toHaveLength(1 + 2 * (TEXTURE_IDS.length * 3 + PROP_IDS.length));
  });
});

describe("processed assets match the asset list exactly", () => {
  it("has every listed file on disk", () => {
    const missing = allAssetPaths().filter((path) => !onDisk.includes(path));
    expect(missing).toEqual([]);
  });

  it("has no processed file the scene does not use (unused assets must be removed)", () => {
    const listed = new Set(allAssetPaths());
    expect(onDisk.filter((path) => !listed.has(path))).toEqual([]);
  });

  it("ships only the lighting HDRI, never an unused one", () => {
    expect(onDisk.filter((path) => path.startsWith("hdri/"))).toEqual([HDRI_FILE]);
  });
});
