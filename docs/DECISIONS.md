# Decisions

A short log of decisions that shape the project. Newest decisions are added at the end. Each entry says what was decided, why, and whether it is settled or still open. All dates are 2026-10-15 unless noted.

The governing specification is [`NAIJA_HUNT_CURSOR_MVP.md`](../NAIJA_HUNT_CURSOR_MVP.md).

## Settled

### D1. Stack
Vite, React 19, strict TypeScript, Tailwind CSS 4, Three.js and React Three Fiber. Three.js and React Three Fiber are kept as the rendering stack and the engine will not be switched (Visual Direction Amendment). Other libraries named in the brief (`@react-three/drei`, `@react-three/rapier`, Zustand, Supabase) are **not installed**, and each needs approval and a stated reason before it is added.

### D2. Node version
CI and `.nvmrc` use Node 22. `engines` in `package.json` allows `^22.22.2 || ^24.15.0 || >=26.0.0`. One source of truth for CI is `.nvmrc`.

### D3. Honest interface
Unbuilt features are shown as unbuilt, in the interface and in the docs. Enter district never claims anything launched. The character stays labelled "not in this build" until an approved protagonist is integrated. A placeholder is never presented as finished art.

### D4. The procedural Palm Mile preview is a placeholder
The current scene, built from code, was kept as a checkpoint commit (`f6b94b5`). It is not the target look. The Visual Direction Amendment supersedes the "procedural geometry" wording in the spec's Milestone 2.

### D5. Visual direction
"Realistic-stylized", never described as photorealism, with Naija Hunt's own identity. The amendment moves the project to authored or licensed glTF/GLB assets with PBR materials, image-based lighting, a curated cinematic camera and light atmosphere. It is approved by the project owner and is authoritative where it conflicts with earlier text. The visual track is Visual M1 (hero environment), M2 (protagonist), M3 (menu), M4 (performance). Nothing in it is implemented yet.

### D6. Art sourcing (owner decision)
A hybrid, asset-driven approach.
- **Environment:** research curated, commercially usable GLB/glTF assets for the hero junction, with original composition and Nigerian architectural detail.
- **Protagonist:** prioritise a custom or commissioned model. A licensed existing model is considered only if its quality, animation support, customisation rights and commercial licence meet the requirements.
- **Gate:** a shortlist with previews, sources, prices, licence terms, formats and suitability is presented first. Nothing is downloaded or integrated until the owner approves the specific assets. Approved licences are recorded in `docs/ASSET_LICENSES.md`, which does not exist yet.

### D7. Order of work
Milestone 0 is completed first, including these docs, and reviewed. Visual M1 begins after that review. Deferring the docs until after Visual M1 was considered, and the owner chose to finish them first.

### D8. The 3D scene loads lazily, and the chunk-size warning stays visible
The scene is loaded after the menu so the first screen appears sooner. Vite warns that the scene chunk is over 500 kB (about 937 kB, about 251 kB gzipped, mostly Three.js). The warning is deliberately not silenced. Budgets are to be set from measured numbers in Visual M1.

### D9. Playwright smoke tests
- They build and serve a fresh production build themselves (`npm run build && npm run preview`) with `reuseExistingServer: false`. If something already listens on port 4173, Playwright stops with an error instead of testing stale output. This was tested with a decoy server.
- The preview port is fixed at 4173 (`strictPort`).
- `PW_BROWSER_CHANNEL` lets a locally installed browser such as Chrome be used. CI uses Playwright's own Chromium.
- Two projects: desktop 1100×640 and mobile 390×844.
- The 3D test accepts either a canvas or the fallback text, and records which. It does not claim the scene rendered correctly.
- Traces are kept only for failures.

### D10. Tailwind source detection is explicit
`src/index.css` imports Tailwind with `@import "tailwindcss" source(none);`, which turns off automatic whole-project scanning. It then names the only two places Tailwind reads for class names: `@source "../index.html";` and `@source "./";` (all of `src/`, including its test files). Paths are relative to `src/index.css`. Class names used anywhere else need their own `@source` line.

History: the first fix excluded a single file, `playwright.config.ts`, with `@source not`, after the word "fixed" in one of its comments produced an unused `.fixed` rule. That did not scale, because every new file could cause the same problem, so it was replaced by the explicit configuration above and the exclusion line was removed. See O1 under "Resolved".

### D11. CI design
`.github/workflows/ci.yml` runs on pull requests to `main` and pushes to `main`. It is pinned to `ubuntu-24.04` with a 20-minute timeout. It uses `contents: read` only, with no secrets, deployment, publishing or automatic commits. Playwright report and traces are uploaded for 14 days only if the smoke tests fail. In-progress runs are cancelled only for pull requests. Actions are referenced by major version tags (`@v7`), not by commit SHA, which is a possible later hardening.

## Open

### O2. CI is unverified on GitHub
The workflow has not run on GitHub, and its YAML has not been checked by an independent validator because none is installed. Still unconfirmed: `npm ci` on Ubuntu, the action tags resolving, and Playwright's bundled Chromium installing and passing.

### O3. Nothing has been pushed
All work is on the local `feature/milestone-0` branch. The remote is `origin` on GitHub. Pushing, merging and branch protection need the owner's explicit go-ahead.

### O4. Reference images
The owner's visual reference images are not in the repository, and the folder `docs/reference/` does not exist. Visual acceptance depends on them.

## Resolved

### O1. Tailwind generated unused CSS from documentation and workflow text (resolved 2026-10-15)
Tailwind used to read every file that was not git-ignored, including Markdown and the workflow, and turned ordinary words into utilities. Measured builds:
- Original build: 14,770 B.
- With `ci.yml`: 14,797 B. The extra 27 B was `.contents{display:contents}`, from `permissions:` then `contents: read`.
- With `ci.yml` and the docs: 15,067 B, which was 297 B over the original. The unused rules were `.contents`, `.fixed` and `.shadow`.

Resolution, approved by the owner: the explicit configuration in D10. After it, the build is `index-BIdJc1ix.css`, 14,770 B (SHA-256 beginning `4279F565CBDE9333`), the same size and content-hash filename as the original build. Compared with the 15,067 B build, exactly those three rules were removed and none were added. All 100 classes that the app source uses and that had a rule are still present. The app's behaviour is unchanged.

Consequence to remember: documentation and CI text no longer affect the built CSS, and a class name used outside `index.html` or `src/` will not be generated until an `@source` line for it is added.
