# Roadmap

Honest status of each milestone. "Done" means it exists in the repository and was checked. Nothing here is a delivery promise, and no estimates are given. Estimates are only given case by case, and they are always labelled as estimates.

The specification is [`NAIJA_HUNT_CURSOR_MVP.md`](../NAIJA_HUNT_CURSOR_MVP.md). It has two kinds of milestones, and they use overlapping numbers. In this file:

- **Spec M0 to M5** are the engineering and gameplay milestones from the brief.
- **Visual M1 to M4** are the visual track from the approved Visual Direction Amendment.

## Where things stand

The project is a menu over a code-built 3D placeholder. There is no gameplay, no character and no imported art. See [`ARCHITECTURE.md`](ARCHITECTURE.md).

## Spec M0: repository foundation (current gate)

Done:
- Vite, React, TypeScript (strict) and Tailwind scaffold, with the folder structure from the brief.
- Scripts: `dev`, `build`, `preview`, `lint`, `typecheck`, `test`, `test:e2e`.
- ESLint, Vitest (7 unit tests) and Playwright (4 tests in 2 projects).
- A GitHub Actions workflow, committed locally.
- `README.md`, this file, `ARCHITECTURE.md`, `DECISIONS.md` and `.env.example`.

Not yet confirmed:
- The workflow has not run on GitHub, and its YAML is not independently validated.
- Nothing has been pushed, and branch protection is not set up.

Acceptance from the brief: fresh install works, the app renders, lint, typecheck, unit tests and build pass, and the Playwright smoke test passes. All of these were run locally and passed. The CI part awaits the first GitHub run.

## Visual track (next, after this gate is reviewed)

The owner wants visible progress here first. Each step stops for review before the next begins.

**Step 0: asset shortlist.** Research curated, commercially usable GLB/glTF environment assets and present a shortlist with previews, sources, prices, licence terms, formats and suitability. Create `docs/ASSET_LICENSES.md` when assets are approved. Download nothing before approval. Also needed: the owner's reference images in `docs/reference/`.

**Visual M1: hero environment.** One carefully composed, cinematic Nigerian urban junction.
- Image-based lighting, PBR materials from approved assets, atmospheric depth and a deliberate camera, with separate desktop and portrait mobile framing.
- A dev-only performance overlay (draw calls, triangles, frame time), so budgets come from measured numbers.
- The existing scene stays available for side-by-side comparison until the owner approves the replacement.
- Result to be judged against the owner's reference images.

**Visual M2: protagonist.** An original Nigerian male explorer, with a designed outfit and idle, walk and run animations, integrated into the environment. The model should be custom or commissioned. A licensed model is considered only if it meets the requirements in D6. Until it exists, the interface keeps saying the character is not in this build.

**Visual M3: cinematic main menu.** Compose the character and environment into the front screen, and refine the mission objective, Enter district and navigation around it. Preserve the working responsive layouts.

**Visual M4: performance and quality verification.** Check desktop and mobile sizes, measure frame rate and memory, optimise asset sizes, geometry, textures and lighting, and confirm the result is visible in the running app. Texture and geometry compression (KTX2, Draco or Meshopt) is decided here, from measurements.

Tooling that may need approval before use: Blender for baking, glTF and KTX2 compression tools, and any post-processing library. None is installed.

## Gameplay milestones (not started)

- **Spec M1: UI prototype.** The brief asks for a five-tab navigation, location selection drawer and loading and error states. Only a three-button navigation with placeholder panels exists today.
- **Spec M2: first playable 3D district.** Third-person movement, camera follow, collision and entering a location. The brief's "procedural geometry" wording for the environment is superseded by the visual amendment.
- **Spec M3: treasure loop.** Chest, clue, inventory, fictional coins, energy and XP, with local persistence marked insecure.
- **Spec M4: home vertical slice.** One furnished house, displaying a collected artifact.
- **Spec M5: Supabase.** Auth, profiles and server-validated rewards. No schema changes or service-role keys in the browser without explicit permission.

## Standing rules

From the brief: no real-money rewards, deposits, crypto or withdrawals. Crews, Chat, Jail, Heists, Multiplayer and Cash Rewards remain clearly marked future features. No fabricated working features. No push, deploy or schema change without explicit permission.

## Open decisions

See "Open" in [`DECISIONS.md`](DECISIONS.md): first-run CI verification, pushing, and the missing reference images. The Tailwind source-scanning question is resolved (O1 under "Resolved" there).
