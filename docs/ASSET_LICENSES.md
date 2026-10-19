# Asset licence register

Status of this file: **uncommitted working draft.** Created 2026-10-15, updated the same day after the owner's Visual Milestone 1 decisions.

## Status legend

| Status | Meaning |
|---|---|
| `APPROVED-DOWNLOAD` | Owner approved this exact asset and resolution. Source page, licence evidence, resolution and intended use are recorded below. It may be downloaded **only in the step the owner authorises**. |
| `APPROVED-DEFERRED` | Owner approved it, but it is not part of the first build. Download only when needed. |
| `BLOCKOUT-ONLY` | Temporary stand-in during blockout. Never final art. Licence and attribution recorded. |
| `ON-HOLD` | Not to be used. Provenance or fit unresolved. |
| `COMMISSION-PLANNED` | A custom asset the owner intends to commission. A draft brief exists in `COMMISSION_BRIEFS.md`. **No artist has been contacted and nothing is agreed.** |
| `EXCLUDED` | Rejected. |

Rules (owner decisions):

- **Downloaded (local cache only), processed and integrated into the Palm Mile hero junction: the Phase 1 Poly Haven assets in section A5 (integration status is in A5). Nothing has been purchased. Nothing else has been downloaded.**
- Every approved CC BY asset must be recorded here, with its attribution text, before download or integration.
- Paid-marketplace models are excluded unless the seller confirms in writing that the licence permits commercial browser-game delivery.
- Mixamo is not relied on until Adobe clarifies browser-delivery rights.
- The Credits screen is deferred to menu refinement. Attribution strings are prepared here so none are lost.
- Facts are marked **verified** (read on the cited page or API on the date checked) or **unverified**.
- Date checked for every entry unless stated: 2026-10-15.

The exact download list (URLs, MD5 checksums, sizes, local paths) is in `docs/POLYHAVEN_MANIFEST.json`.

---

## A. Poly Haven CC0, APPROVED-DOWNLOAD

**Licence evidence (verified):**
- https://polyhaven.com/license states all Poly Haven assets are CC0: commercial use allowed, no attribution required, redistribution inside a product allowed.
- Each asset page below was loaded on 2026-10-15 and shows a "CC0 License" link to that page.
- Maps, resolutions, file sizes, MD5 checksums, authors and triangle counts come from `https://api.polyhaven.com/info/<id>` and `/files/<id>`.

**Attribution:** not required. Optional courtesy credit: "Assets from Poly Haven (polyhaven.com), CC0, by the named authors."

**Selected formats:** textures use the JPG variants of Diffuse (colour), `nor_gl` (OpenGL-convention normal map, matches three.js) and `arm` (ambient occlusion, roughness and metalness packed in one image). Models use the glTF package with its `.bin` and textures.

### A1. Textures (page: `https://polyhaven.com/a/<id>`)

| Asset id | Authors | Resolution | Download | Phase | Intended use |
|---|---|---|---|---|---|
| `asphalt_02` | Rob Tuytel | **2k** | 9.32 MB | 1 (desktop tier) | Hero road surface |
| `asphalt_02` | Rob Tuytel | 1k | 2.27 MB | 1 (mobile tier) | Same asset at a smaller size for phones, so they do not fetch 9.32 MB |
| `brick_pavement_02` | Charlotte Baglioni | 1k | 2.71 MB | 1 | Pavements |
| `painted_plaster_wall` | Amal Kumar | 1k | 2.10 MB | 1 | Painted walls of placeholder buildings |
| `beige_wall_001` | Dimitrios Savva, Rico Cilliers | 1k | 0.27 MB | 1 | Plain wall base tint (near-flat colour) |
| `concrete` | Rob Tuytel | 1k | 0.78 MB | 1 | Kerbs, walls, flyover |
| `corrugated_iron_02` | Jenelle van Heerden, Sergej Majboroda | 1k | 1.96 MB | 1 | Roofs and stall sheets |
| `red_laterite_soil_stones` | Amal Kumar | 1k | 3.46 MB | 1 | Roadside red earth |
| `corrugated_iron` | Jenelle van Heerden, Dimitrios Savva | 1k | 1.99 MB | **2, deferred** | Optional second corrugated pattern. `APPROVED-DEFERRED` |

### A2. HDRIs. Lighting and reflections ONLY

| Asset id | Authors | Resolution | Download | Phase | Intended use |
|---|---|---|---|---|---|
| `sunset_jhbcentral` ("Joburg Central Sunset") | Greg Zaal, Dimitrios Savva | 1k HDR | 1.57 MB | 1 | Primary image-based lighting and reflections |
| `the_sky_is_on_fire` | Greg Zaal, Rico Cilliers | 1k HDR | 1.53 MB | 1 | Alternate lighting mood |
| `sunset_jhbcentral` | as above | 2k HDR | 6.10 MB | **2, deferred** | Desktop tier. Only if 1k reflections look too soft. `APPROVED-DEFERRED` |

**Mandatory rule (owner decision):** HDRIs are used as `scene.environment` only. They are **never** assigned to `scene.background` and never rendered as a visible sky or skyline. The Johannesburg skyline must not appear in any view. The visible sky stays our own. This is an acceptance check (see the implementation plan).

### A3. Props (glTF, 1k package)

| Asset id | Author | Triangles | Real size (m) | Download | Phase | Intended use |
|---|---|---|---|---|---|---|
| `plastic_monobloc_chair_01` | Kuutti Siitonen | 3,356 | 0.64 x 0.63 x 0.88 | 1.95 MB | 1 | Market and café seating |
| `Barrel_01` | Jorge Camacho | 2,682 | 0.56 x 0.56 x 0.88 | 0.70 MB | 1 | Street dressing. **Retextured** (see below) |
| `wooden_crate_01` | James Ray Cock | 6,576 | 0.83 x 0.41 x 0.35 | 2.28 MB | 1 | Market stalls |
| `old_tyre` | MP | 2,880 | 0.60 x 0.16 x 0.60 | 2.24 MB | 1 | Street dressing |
| `utility_box_02` | James Ray Cock | 6,268 | 0.92 x 0.43 x 1.12 | 2.03 MB | 1 | Street dressing |

**Barrel retexture (owner decision).** The default glTF ships the "explosive" textures with hazard markings, so those three images are **not downloaded**. Instead the manifest lists Poly Haven's own CC0 `oxide_grey` variant (`diff`, `nor_gl`, `arm`) of the same barrel, and the glTF image URIs are rewritten at processing time. Evidence: the page's own preview of `oxide_grey_diff` was viewed on 2026-10-15 and shows grey-blue metal with rust and **no hazard symbols**. If any marking appears after download, fall back to painting it out with a script.

**Total for Phase 1:** 51 files, 35.16 MB of source downloads (a desktop device would use 32.89 MB of that, a phone 25.84 MB, if the loose files were shipped unprocessed). **Phase 2 (deferred):** 4 files, 8.09 MB. These are source JPG and HDR sizes before any processing.

### A4. Excluded from the first build (owner decision)

| Asset id | Status | Reason |
|---|---|---|
| `exterior_aircon_unit` | `ON-HOLD` | 18,986 triangles, 7.67 MB at 1k. Heavy for its role |
| `metal_trash_can` | `ON-HOLD` | 13,960 triangles, 4.99 MB at 1k. Heavy for its role |
| `street_lamp_01`, `modular_electricity_poles` | `EXCLUDED` | 30,610 and 200,610 triangles |
| Every Poly Haven tree | `EXCLUDED` | 1.7 to 4.7 M triangles. There is no palm |

### A5. Download verification and processing (2026-10-15)

**Downloaded (owner-authorised, Phase 1 only).** 51 of 51 files fetched from `dl.polyhaven.org` into `.asset-cache/polyhaven/` (local only, excluded via `.git/info/exclude`, never committed). **Every file's MD5 matched the manifest**; total 35,161,365 bytes, equal to the manifest. Per-file record: `.asset-cache/polyhaven/_verification.json` (local). **Not downloaded:** all Phase 2 assets, `corrugated_iron`, the 2k HDRI, the `Barrel_01` explosive textures, and every `ON-HOLD`, `BLOCKOUT-ONLY` and `EXCLUDED` item. The `the_sky_is_on_fire` HDRI is downloaded and verified but is **not shipped**, because the first scene does not use it.

**Processed** by `scripts/process-assets.mjs` (`npm run assets:process`), which re-verifies every input MD5 against the manifest before reading it. Outputs are in `public/assets/`, with `processed-manifest.json` mapping each output to its source id. Sizes are decimal MB, as above.

| Asset | Source | Desktop output | Mobile output |
|---|---|---|---|
Sizes shown are the **current** (Gate 4) outputs. The earlier Gate 2 outputs were larger; see "Gate 4 resolution changes" below.

| Asset | Source | Desktop output | Mobile output |
|---|---|---|---|
| `asphalt_02` | 2k desktop and 1k mobile files | 1024 px WebP, 1.35 MB (was 2048 px, 5.12 MB) | 768 px WebP, 0.69 MB (was 1024 px, 1.26 MB) |
| `brick_pavement_02` | 1k | 1024 px, 0.84 MB | 512 px, 0.20 MB |
| `painted_plaster_wall` | 1k | 1024 px, 0.55 MB | 512 px, 0.07 MB |
| `beige_wall_001` | 1k | 512 px, 0.03 MB (was 1024) | 256 px, under 0.01 MB (was 512) |
| `concrete` | 1k | 1024 px, 0.40 MB | 512 px, 0.09 MB |
| `corrugated_iron_02` | 1k | 512 px, 0.05 MB (was 1024) | 256 px, 0.01 MB (was 512) |
| `red_laterite_soil_stones` | 1k | 512 px, 0.28 MB (was 1024) | 256 px, 0.05 MB (was 512) |
| `plastic_monobloc_chair_01` | 1k | 512 px `.glb`, 0.27 MB (was 1024) | 256 px, 0.18 MB (was 512) |
| `Barrel_01` (oxide_grey) | 1k | 512 px `.glb`, 0.22 MB (was 1024) | 256 px, 0.12 MB (was 512) |
| `wooden_crate_01` | 1k | 512 px `.glb`, 0.31 MB (was 1024) | 256 px, 0.23 MB (was 512) |
| `old_tyre` | 1k | 512 px `.glb`, 0.22 MB (was 1024) | 256 px, 0.12 MB (was 512) |
| `utility_box_02` | 1k | 512 px `.glb`, 0.31 MB (was 1024) | 256 px, 0.24 MB (was 512) |
| `sunset_jhbcentral` | 1k HDR | copied unchanged, 1.57 MB (both tiers) | same file |

**Totals (all files the scene could request, before HTTP compression):** desktop 6.40 MB (textures 3.49, props 1.34, HDRI 1.57); phone 3.58 MB (textures 1.11, props 0.89, HDRI 1.57). Before Gate 4: desktop 13.03 MB, phone 4.88 MB. Proposed budgets were 25 MB and 12 MB. These are file sizes, not measured frame rate or GPU memory.

#### Gate 4 resolution changes (2026-10-15, uncommitted)

GPU memory was measured by recording the real WebGL texture allocations in Chrome (not only the in-app estimate). On desktop the original 301.5 MB was: 6 tiling sets at 1024 px, 100.8 MB (33%); 15 prop maps at 1024 px, 84.0 MB (28%); asphalt at 2048 px, 67.1 MB (22%); the 2048 px shadow map (depth plus colour), 33.6 MB (11%); the filtered HDRI, 6.3 MB; procedural canvas textures, about 10 MB. No duplicated uploads and no unused maps were found, so the savings come from resolution only.

Each reduction was checked against on-screen texel density (the canvas is capped at devicePixelRatio 1.5), and before and after screenshots at 1440x900 and DPR 1.5 were compared at native resolution for the foreground asphalt, the building facade and the pavement, props and kerb. No visible difference was found.

- **Props:** 1024 to 512 (desktop) and 512 to 256 (phone). A prop's whole texture atlas covers one object about half a metre across, and a prop is a few dozen to ~150 px tall on screen.
- **Asphalt:** 2048 to 1024 (desktop) and 1024 to 768 (phone). 1024 px over the 3 m tile is 341 texels per metre, which meets or exceeds the screen density even at the bottom edge of the frame. The earlier 2048 px file (and its separate 1k phone source) are no longer shipped.
- **Minor sets (`beige_wall_001`, `corrugated_iron_02`, `red_laterite_soil_stones`):** halved on both tiers. They cover tables, shutters, roofs and a lot that is mostly out of view.
- **Unchanged:** `brick_pavement_02`, `painted_plaster_wall` and `concrete` (the large near-camera surfaces) keep their sizes on desktop and phone.
- The `.glb` and `.webp` outputs are regenerated by `npm run assets:process` from the MD5-verified Poly Haven downloads only. The Gate 3 outputs were backed up locally to `.asset-cache/backup_assets_gate3/` (git-excluded).

**Encoder settings (recorded for reproducibility).** Textures: `sharp` WebP, effort 6, smart chroma subsampling on, Lanczos3 downscale (never upscale); quality 82 diffuse, 85 ARM, 92 normal. Props: glTF Transform CLI 4.5.1 `copy` (to one `.glb`), `resize`, `webp` (normal 92, the rest 82), `prune`. Geometry is untouched, with triangle counts identical to the sources (verified). Prop edge lengths are now 512 (desktop) and 256 (phone); `resize` is applied to both tiers. Props require the `EXT_texture_webp` extension, which three's `GLTFLoader` supports.

**Measured quality loss (measured on the Gate 2 outputs, before the Gate 4 resolution cuts).** Mean absolute error against the source JPEG, per 8-bit channel: props 1.5 to 3.1 (desktop) and 2.6 to 5.9 (mobile). Normal maps: mean angular error 1.1 to 3.3 degrees on the checked 1k sets at 512 px, 6 degrees on the desktop asphalt, which is fine grain noise in the source (lit previews of source and shipped file are visually indistinguishable). Near-lossless would cut that to 0.4 degrees but costs 3.5 times the bytes.

**Barrel check.** The shipped barrel `.glb` files reference `oxide_grey`, contain no "explosive" string, and the embedded diffuse matches the `oxide_grey` source. The diffuse atlas was viewed and shows no hazard symbols or lettering.

**Integration status (Visual Milestone 1 scene integration, 2026-10-15, uncommitted).** All 7 texture sets, all 5 props and `sunset_jhbcentral` are used by the Palm Mile junction scene (`src/game/scenes/junction/`). The single list of shipped assets is `src/game/scenes/junction/assetList.ts`. A unit test fails if a processed file in `public/assets/` is not on that list, or a listed file is missing, so unused assets cannot ship by accident. Nothing was removed because nothing was unused.

- **Tiering.** The asset tier is chosen once per page load: viewport width of 1023 px or less, or a coarse primary pointer, loads the `mobile` tier. Everything else loads `desktop`. Only the chosen tier is requested (verified in a production build at 390x844, 1100x640 and 1440x900: 27 asset requests each, all HTTP 200, one tier only).
- **HDRI use.** `sunset_jhbcentral` is used **only** as `scene.environment` (image-based lighting and reflections). It is never assigned to `scene.background`, so its Johannesburg skyline is never shown. The visible sky is our own gradient dome. At load, the image is rotated horizontally so that the HDRI's sun matches the scene's directional light.
- **`the_sky_is_on_fire`:** downloaded and verified in the local cache only. **Not shipped, not referenced by code.** The deferred 2k HDRI and every Phase 2 asset are untouched.
- **Prop notes.** The barrel uses the `oxide_grey` variant. `exterior_aircon_unit` and `metal_trash_can` are excluded. `old_tyre`, `wooden_crate_01`, `Barrel_01` and `utility_box_02` are instanced.

**Still PLACEHOLDER in the scene** (each is a named `PLACEHOLDER_*` group in the scene graph and none is finished art): procedural danfo buses; procedural palm trees; the box buildings (stand-ins for the commissioned modular Nigerian building kit); the flyover; the distant skyline silhouettes; the direction sign (our own original text and arrows, not a real road sign). The character is still not implemented. The Poly Pizza danfo van and Quaternius palm were **not** downloaded, so no CC BY attribution is owed yet.

**Development-tool audit findings (kept on record).** `npm audit` (re-run 2026-10-15) reports 3 high-severity items, all one chain: `braces` (stack-exhaustion denial of service on deeply nested glob patterns, advisory GHSA-vfj7-8cjw-p6xm) reached through `micromatch`, which `@gltf-transform/cli` depends on. All of it is dev-only and not shipped. `npm audit --omit=dev` reports **0 vulnerabilities**, so the production bundle is not affected. The only fix npm offers is downgrading the CLI to 2.0.5, which is a breaking change and was **not** applied. **Do not run `npm run assets:process` on untrusted or third-party input files**: the pipeline is only meant for the checksum-verified Poly Haven downloads in `.asset-cache/polyhaven/`.

---

## B. ON-HOLD: do not use (provenance unresolved)

Both are replaced by `COMMISSION-PLANNED` slots (section D).

### DANFO-A: "Lagos Danfo Bus" by Iam_thearchitect (Sketchfab), `ON-HOLD`

| Field | Evidence |
|---|---|
| Source page | https://sketchfab.com/3d-models/lagos-danfo-bus-41b71827dcc94339b627fb79d9a7adb7 (verified) |
| Author | Iam_thearchitect (`@arcoma330`), https://sketchfab.com/arcoma330. Basic account, 11 models, empty bio (verified) |
| Licence | "CC Attribution", mapped by Sketchfab's licence list to CC BY 4.0 (verified) |
| Why on hold | Uploader's own tags include **`meshy`**, an AI 3D generator. Meshy's terms (https://help.meshy.ai/en/articles/10137554-what-is-the-ownership-of-the-generated-models) say that on the free plan Meshy owns the output and licenses it under CC BY 4.0 with credit to Meshy. The uploader's plan is unknown, so the chain of title is **unresolved** |
| Geometry (verified) | 40,922 faces, 20,397 vertices. GLB 14.6 MB, 3 textures at up to 2048 (search data). Model endpoint reports 4 textures |
| Unverified | Texture quality, baked lighting, whether download needs a login |

### PALM-D: "Palm Tree Realistic" by 00amza (Sketchfab), `ON-HOLD`

| Field | Evidence |
|---|---|
| Source page | https://sketchfab.com/3d-models/palm-tree-realistic-ced3b31f14f940d0b7480a83e6f8c9c0 (verified) |
| Author | 00amza, https://sketchfab.com/00amza. 60 models. Bio lists services including "Ripping and Sorting" and "Environment Reskinning" (verified) |
| Licence | "CC Attribution", mapped to CC BY 4.0 (verified) |
| Why on hold | Mesh provenance **unresolved** (possible ripped asset). Also a date-palm look, while the description says coconut |
| Geometry (verified) | 1,812 faces. GLB 3.1 MB, 1 texture at 2048 |

---

## C. BLOCKOUT-ONLY (temporary, never final art)

Neither has been downloaded. The first build can keep the existing procedural danfo and palms as labelled placeholders instead, which needs no download and no attribution. Download these only if the owner asks.

### BLOCKOUT-DANFO: "Lagos Danfo Bus" by Mobolaji (Poly Pizza)

| Field | Evidence |
|---|---|
| Source page | https://poly.pizza/m/QxZGVmiuGG (verified) |
| Exact file | https://static.poly.pizza/01b8408e-03bd-40f3-b702-d22ecc297f1c.glb. HTTP HEAD verified: status 200, `content-length` 587,920 bytes (574 KiB), `gltf-binary` |
| Licence | **CC BY 3.0**, https://creativecommons.org/licenses/by/3.0/ (verified: page link and "Creative Commons Attribution") |
| Author | Mobolaji. Published Nov 16, 2025 |
| Geometry | 5.8k triangles. FBX and GLTF. Flat-shaded yellow van, no stripe or decals (seen) |
| Attribution (required if ever shipped) | "Lagos Danfo Bus" by Mobolaji, https://poly.pizza/m/QxZGVmiuGG, licensed under CC BY 3.0 (https://creativecommons.org/licenses/by/3.0/). Changes made: [list at integration] |
| Unverified | Whether the model is human-authored |

### BLOCKOUT-PALM: "Palm Tree" by Quaternius (Poly Pizza)

| Field | Evidence |
|---|---|
| Source page | https://poly.pizza/m/A6cKJYFsIb (verified) |
| Exact file | https://static.poly.pizza/4c17decd-3087-4afe-9611-cfd92cca47cd.glb. HTTP HEAD verified: status 200, `content-length` 118,032 bytes (115 KiB), `gltf-binary` |
| Licence | **Public Domain (CC0)**, https://creativecommons.org/publicdomain/zero/1.0/ (verified on the page) |
| Author | Quaternius. Published Nov 5, 2023 |
| Geometry | 3.1k triangles. FBX and GLTF. Very cartoony low-poly (seen) |
| Attribution | Not required. Optional: "Quaternius (CC0)" |

### BLOCKOUT-KENNEY: Kenney Building Kit

| Field | Evidence |
|---|---|
| Pack | https://poly.pizza/bundle/Building-Kit-HMVCsp80XU |
| Licence | CC0. Kenney's official https://kenney.nl/support says all its game assets are public domain (CC0), attribution not required (verified) |
| Status | Blockout only. **No exact pieces chosen, so nothing is approved for download.** Never final hero art |

---

## D. COMMISSION-PLANNED (custom Nigerian asset set)

Each is described in `docs/COMMISSION_BRIEFS.md`. **No artist has been contacted, no request published, no quote agreed, no money spent.**

| Slot | Replaces | Brief |
|---|---|---|
| Hero danfo minibus | DANFO-A | Brief 1 |
| Palms | PALM-D | Brief 1 |
| Modular Lagos-inspired buildings, mural wall, flyover, street furniture | Procedural placeholder buildings | Brief 1 |
| Nigerian male protagonist | none | Brief 2 |

Until these exist, the placeholders are the current procedural danfo, palms and building shells, labelled as placeholders in the code and the report.

---

## E. EXCLUDED

| Item | Reason |
|---|---|
| CGTrader Royalty Free models | Terms §21A.2 and §21A.3 require preventing end-user access to the model. A browser game delivers the file to every visitor. Excluded unless the seller confirms in writing |
| 3DExport and RenderHub models | Licence texts not read. Excluded under the owner's paid-marketplace rule |
| Mixamo characters and animations | Not relied on until Adobe clarifies browser-delivery rights |
| KidBi-Gaming market cart and coffee kiosk | Skipped for the first hero junction (owner decision) |
| Sketchfab "Passenger Tricycle (Keke Napep)" | 260,009 faces, 21 MB GLB. Too heavy |
| Sketchfab "Lagos state Commercial Bus" (kesterTolu) | 120,600 faces, no textures. Too heavy |
| Innerscene "Explorer male" and marketplace characters | The protagonist is a commission first |
| 3dassets.dev shopfront modules | Contributor-reported AI use |

---

## F. Tools

| Tool | Status |
|---|---|
| `@gltf-transform/cli` 4.5.1 (MIT) | **Installed 2026-10-15** as an exact-pinned dev dependency. Used only by `scripts/process-assets.mjs`. Not shipped to browsers |
| `sharp` 0.35.5 (Apache-2.0) | **Installed 2026-10-15** as an exact-pinned dev dependency (the newest release inside the CLI's `~0.35.3` range, so there is one copy). Dev only. Not shipped |
| Blender | **Not installed. Do not install** (owner decision) |
