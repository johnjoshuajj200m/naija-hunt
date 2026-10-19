#!/usr/bin/env node
/**
 * Naija Hunt — asset processing pipeline (Visual Milestone 1).
 *
 * Turns the raw, locally cached Poly Haven downloads (.asset-cache/polyhaven, never committed)
 * into the small, web-delivered files under public/assets/ (committed).
 *
 *   npm run assets:process
 *
 * SECURITY: do NOT run this on untrusted or third-party input files. It only reads the
 * checksum-verified Poly Haven downloads listed in docs/POLYHAVEN_MANIFEST.json, and its dev
 * dependency chain has a known high-severity `braces` advisory (see docs/ASSET_LICENSES.md,
 * "Development-tool audit findings"). The advisory is dev-only; production has 0 vulnerabilities.
 *
 * What it does
 *   1. Re-verifies the MD5 of every input against docs/POLYHAVEN_MANIFEST.json. Stops on any mismatch.
 *   2. Tiling textures  -> WebP via `sharp`, in two tiers, at the per-set sizes in TEXTURES below
 *        (desktop 1024 / 512, phone 768 / 512 / 256; never upscaled)
 *   3. Props            -> single-file .glb via the glTF Transform CLI, textures resized per tier and
 *        recompressed to WebP. The barrel is remapped from its explosive-hazard textures to the
 *        CC0 "oxide_grey" variant (owner decision: no hazard markings).
 *   4. HDRI             -> copied unchanged (RGBE .hdr is already compact). Lighting only; the app must
 *        never use it as a visible background.
 *   5. Writes public/assets/processed-manifest.json (output -> source id, bytes, tier).
 *
 * Only assets that appear in the first hero-junction scene are processed. Phase 2 and on-hold
 * assets are not in the manifest and therefore cannot be processed by accident.
 *
 * Encoder settings are deliberately written down here so a re-run is reproducible.
 */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const MANIFEST_PATH = join(ROOT, "docs", "POLYHAVEN_MANIFEST.json");
const manifest = JSON.parse(readFileSync(MANIFEST_PATH, "utf8"));
const CACHE = join(ROOT, manifest.localRoot);
const OUT = join(ROOT, "public", "assets");
const WORK = join(ROOT, ".asset-cache", "work"); // git-excluded scratch space

// ---- What ships in the first scene ---------------------------------------------------------

/**
 * Tiling PBR texture sets. `desktop` / `mobile` are the edge lengths shipped to each tier. Every map of a
 * set uses the same edge. GPU cost per set is edge^2 x 4 bytes x 3 maps x 4/3 (mips), e.g. 1024 = 16.8 MB,
 * 512 = 4.2 MB, 256 = 1.0 MB. Sizes follow the texel density each surface needs on screen (see
 * docs/ASSET_LICENSES.md, "Gate 4"), so the busy, near-camera surfaces keep the most detail.
 * (Gate 4 reduced asphalt 2048 -> 1024 on desktop, and the minor sets 1024 -> 512 / 512 -> 256.)
 */
const TEXTURES = [
  { id: "asphalt_02", desktop: 1024, mobile: 768 }, // hero road, always in the foreground
  { id: "brick_pavement_02", desktop: 1024, mobile: 512 }, // near pavement
  { id: "painted_plaster_wall", desktop: 1024, mobile: 512 }, // large building faces
  { id: "beige_wall_001", desktop: 512, mobile: 256 }, // minor: tables and a few wall variants
  { id: "concrete", desktop: 1024, mobile: 512 }, // 4 m tile, so already the lowest density: kerbs and caps
  { id: "corrugated_iron_02", desktop: 512, mobile: 256 }, // shutters, roofs and stalls
  { id: "red_laterite_soil_stones", desktop: 512, mobile: 256 }, // ground lot, mostly out of view
];

/**
 * Props. `rewrite` substitutes the texture variant named in the glTF (barrel: explosive -> oxide_grey).
 * A prop's whole texture atlas covers one object about half a metre across, and it is a few dozen
 * to ~150 px tall on screen, so 512 (desktop) and 256 (phone) already exceed the on-screen density.
 */
const PROPS = [
  { id: "plastic_monobloc_chair_01", desktop: 512, mobile: 256 },
  { id: "Barrel_01", desktop: 512, mobile: 256, rewrite: [["explosive", "oxide_grey"]] },
  { id: "wooden_crate_01", desktop: 512, mobile: 256 },
  { id: "old_tyre", desktop: 512, mobile: 256 },
  { id: "utility_box_02", desktop: 512, mobile: 256 },
];

const HDRIS = ["sunset_jhbcentral"]; // the_sky_is_on_fire stays in the cache until a scene needs it

/** WebP quality per map. Normals get a higher setting because lossy artefacts show up as shading noise. */
const QUALITY = { diff: 82, arm: 85, nor: 92 };
const WEBP_EFFORT = 6;

// ---- Helpers --------------------------------------------------------------------------------

const log = (msg) => console.log(msg);
const md5 = (path) => createHash("md5").update(readFileSync(path)).digest("hex");
const ensureDir = (dir) => mkdirSync(dir, { recursive: true });
const kb = (bytes) => `${(bytes / 1000).toFixed(0)} kB`;

/**
 * Manifest ids are NOT unique (asphalt_02 has a 2k desktop and a 1k mobile entry; sunset_jhbcentral has
 * a Phase 1 1k and a deferred Phase 2 2k). Lookups therefore match id + phase 1 + tier, and must find
 * exactly one entry, so a wrong-resolution file can never be picked up silently.
 */
const requireAsset = (id, tier) => {
  const matches = manifest.assets.filter(
    (a) => a.id === id && a.phase === 1 && (a.tier === "all" || a.tier === tier),
  );
  if (matches.length !== 1) {
    throw new Error(`Expected exactly one Phase 1 "${id}" (${tier}) in the manifest, found ${matches.length}. Refusing to process it.`);
  }
  return matches[0];
};

/** Step 1: integrity check of every input file we are about to read. */
function verifyInputs(items) {
  const seen = new Set();
  for (const [id, tier] of items) {
    for (const file of requireAsset(id, tier).files) {
      if (seen.has(file.localPath)) continue;
      seen.add(file.localPath);
      const path = join(CACHE, file.localPath);
      if (!existsSync(path)) throw new Error(`Missing input: ${file.localPath}`);
      const actual = md5(path);
      if (actual !== file.md5) throw new Error(`MD5 mismatch for ${file.localPath}: ${actual} != ${file.md5}`);
    }
  }
  return seen.size;
}

const outputs = []; // collected for processed-manifest.json
const record = (path, source, tier, kind) =>
  outputs.push({ path: relative(join(ROOT, "public"), path).replaceAll("\\", "/"), bytes: statSync(path).size, source, tier, kind });

// ---- Textures -------------------------------------------------------------------------------

/** Poly Haven map name in the manifest -> short output name. */
const MAP_NAMES = { Diffuse: "diff", nor_gl: "nor", arm: "arm" };

async function processTexture({ id, desktop, mobile }) {
  for (const tier of ["desktop", "mobile"]) {
    const edge = tier === "desktop" ? desktop : mobile;
    // For asphalt_02 this selects the 2k files on desktop and the separate 1k files on mobile.
    const asset = requireAsset(id, tier);
    const outDir = join(OUT, "textures", tier, id);
    ensureDir(outDir);
    for (const file of asset.files) {
      const short = MAP_NAMES[file.map];
      if (!short) throw new Error(`Unexpected map "${file.map}" in ${id}`);
      const src = join(CACHE, file.localPath);
      const meta = await sharp(src).metadata();
      if (meta.width !== meta.height) throw new Error(`${file.localPath} is not square`);
      if (meta.width < edge) throw new Error(`${file.localPath} is ${meta.width}px; refusing to upscale to ${edge}px`);
      let img = sharp(src);
      if (meta.width > edge) img = img.resize(edge, edge, { kernel: "lanczos3" });
      const dest = join(outDir, `${short}.webp`);
      // smartSubsample: WebP lossy always subsamples chroma, which smears the independent channels of
      // normal and ARM maps. Smart subsampling costs ~5% size and measurably reduces that error.
      await img.webp({ quality: QUALITY[short], effort: WEBP_EFFORT, smartSubsample: true }).toFile(dest);
      record(dest, `${id}:${file.map}`, tier, "texture");
    }
  }
}

// ---- Props ----------------------------------------------------------------------------------

// The package's "exports" map hides bin/cli.js from require.resolve, so point at the file directly.
const CLI = join(ROOT, "node_modules", "@gltf-transform", "cli", "bin", "cli.js");
if (!existsSync(CLI)) throw new Error("@gltf-transform/cli is not installed. Run `npm ci` first.");
/** Runs the glTF Transform CLI with the current Node binary (no shell, so Windows quoting is a non-issue). */
const gltfTransform = (...args) => execFileSync(process.execPath, [CLI, ...args], { stdio: ["ignore", "pipe", "pipe"] }).toString();

/** Copies a Poly Haven model into a scratch dir, applying the texture-variant rewrite if requested. */
function stageProp({ id, rewrite = [] }) {
  const asset = requireAsset(id, "desktop");
  const stage = join(WORK, id);
  rmSync(stage, { recursive: true, force: true });
  ensureDir(join(stage, "textures"));

  const gltfFile = asset.files.find((f) => f.localPath.endsWith(".gltf"));
  const modelDir = dirname(join(CACHE, gltfFile.localPath));
  let json = readFileSync(join(CACHE, gltfFile.localPath), "utf8");
  for (const [from, to] of rewrite) json = json.replaceAll(from, to);
  writeFileSync(join(stage, "model.gltf"), json);

  for (const file of readdirSync(modelDir)) {
    if (file.endsWith(".bin")) copyFileSync(join(modelDir, file), join(stage, file));
  }
  const referenced = new Set([...json.matchAll(/"uri"\s*:\s*"([^"]+)"/g)].map((m) => m[1]));
  for (const uri of referenced) {
    if (uri.endsWith(".bin")) continue;
    const from = join(modelDir, uri);
    if (!existsSync(from)) throw new Error(`${id}: glTF references ${uri}, which is not in the cache`);
    copyFileSync(from, join(stage, uri));
  }
  return stage;
}

function processProp(prop) {
  const stage = stageProp(prop);
  for (const tier of ["desktop", "mobile"]) {
    const edge = tier === "desktop" ? prop.desktop : prop.mobile;
    const dest = join(OUT, "props", tier, `${prop.id}.glb`);
    ensureDir(dirname(dest));
    const glb = join(stage, `${tier}.glb`);
    gltfTransform("copy", join(stage, "model.gltf"), glb); // .gltf + .bin + .jpg -> one .glb
    if (edge < 1024) gltfTransform("resize", glb, glb, "--width", String(edge), "--height", String(edge));
    // Normal maps first at a higher quality, then whatever is still JPEG (diffuse + ARM).
    gltfTransform("webp", glb, glb, "--slots", "normalTexture", "--quality", String(QUALITY.nor), "--effort", String(WEBP_EFFORT));
    gltfTransform("webp", glb, glb, "--formats", "jpeg", "--quality", String(QUALITY.diff), "--effort", String(WEBP_EFFORT));
    gltfTransform("prune", glb, dest); // drops anything unused; writes the final file
    record(dest, prop.id, tier, "prop");
  }
  rmSync(stage, { recursive: true, force: true });
}

// ---- HDRI -----------------------------------------------------------------------------------

function processHdris() {
  const dir = join(OUT, "hdri");
  ensureDir(dir);
  for (const id of HDRIS) {
    const file = requireAsset(id, "desktop").files[0];
    const dest = join(dir, `${id}_1k.hdr`);
    copyFileSync(join(CACHE, file.localPath), dest);
    record(dest, id, "all", "hdri");
  }
}

// ---- Main -----------------------------------------------------------------------------------

async function main() {
  log("1/4  Verifying inputs against the manifest (MD5)...");
  // The barrel's hazard variant is deliberately absent from the manifest, so it can never be checked or read.
  const verified = verifyInputs([
    ...TEXTURES.flatMap((t) => [[t.id, "desktop"], [t.id, "mobile"]]),
    ...PROPS.map((p) => [p.id, "desktop"]),
    ...HDRIS.map((id) => [id, "desktop"]),
  ]);
  log(`     ${verified} files verified.`);

  rmSync(OUT, { recursive: true, force: true }); // outputs are fully regenerated, never patched
  ensureDir(OUT);
  ensureDir(WORK);

  log("2/4  Textures -> WebP (desktop + mobile tiers)...");
  for (const t of TEXTURES) {
    await processTexture(t);
    log(`     ${t.id}`);
  }

  log("3/4  Props -> .glb (glTF Transform CLI)...");
  for (const p of PROPS) {
    processProp(p);
    log(`     ${p.id}`);
  }

  log("4/4  HDRI (copied unchanged)...");
  processHdris();

  rmSync(WORK, { recursive: true, force: true });
  outputs.sort((a, b) => a.path.localeCompare(b.path));
  writeFileSync(
    join(OUT, "processed-manifest.json"),
    `${JSON.stringify({ licence: "CC0-1.0", generatedBy: "scripts/process-assets.mjs", outputs }, null, 2)}\n`,
  );

  const total = (pred) => outputs.filter(pred).reduce((n, o) => n + o.bytes, 0);
  const mb = (b) => (b / 1e6).toFixed(2); // decimal MB, matching docs/ASSET_LICENSES.md and the manifest
  log("\nDone. Payload by tier (bytes on the wire, before HTTP compression):");
  for (const tier of ["desktop", "mobile"]) {
    const tex = total((o) => o.tier === tier && o.kind === "texture");
    const props = total((o) => o.tier === tier && o.kind === "prop");
    const hdri = total((o) => o.kind === "hdri");
    log(`  ${tier.padEnd(8)} textures ${mb(tex)} MB + props ${mb(props)} MB + HDRI ${mb(hdri)} MB = ${mb(tex + props + hdri)} MB`);
  }
  log(`  files written: ${outputs.length} (${kb(total(() => true))})`);
}

main().catch((err) => {
  console.error(`\nPROCESSING STOPPED: ${err.message}`);
  rmSync(WORK, { recursive: true, force: true });
  process.exit(1);
});
