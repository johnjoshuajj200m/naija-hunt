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

### D10. Tailwind scans the whole project, so one file is excluded
Tailwind turned the word "fixed" in a comment in `playwright.config.ts` into an unused `.fixed` utility. `src/index.css` excludes that file with `@source not "../playwright.config.ts";`. This restored the original CSS output byte for byte.

### D11. CI design
`.github/workflows/ci.yml` runs on pull requests to `main` and pushes to `main`. It is pinned to `ubuntu-24.04` with a 20-minute timeout. It uses `contents: read` only, with no secrets, deployment, publishing or automatic commits. Playwright report and traces are uploaded for 14 days only if the smoke tests fail. In-progress runs are cancelled only for pull requests. Actions are referenced by major version tags (`@v7`), not by commit SHA, which is a possible later hardening.

## Open

### O1. Tailwind's whole-project scan keeps generating unused CSS
Tailwind reads every non-ignored file for class names, including Markdown and the workflow. Ordinary words then become utilities. Measured on 2026-10-15:
- Original build: 14,770 B.
- With `ci.yml`: 14,797 B. The extra 27 B is `.contents{display:contents}`, from `permissions:` then `contents: read`.
- With `ci.yml` and these docs: 15,067 B, which is 297 B over the original. Words in the docs and config such as `fixed`, `contents` and `shadow` produce rules (`.fixed`, `.contents`, `.shadow`) that no app source uses. Other generated rules may also be affected, but this was not traced rule by rule.

These rules match no element, so the app looks and behaves the same. The cost is a slightly larger CSS file, and it will recur with every new document. Options for the owner:
1. Leave it.
2. Add one `@source not` line per excluded path in `src/index.css`. This is whack-a-mole as files are added.
3. Make scanning explicit, by importing Tailwind with `source(none)` and listing only `index.html` and `src/` with `@source`. This looks like the durable fix, but it has not been tried in this repository.

Either change touches `src/index.css`, so it waits for the owner's decision.

### O2. CI is unverified on GitHub
The workflow has not run on GitHub, and its YAML has not been checked by an independent validator because none is installed. Still unconfirmed: `npm ci` on Ubuntu, the action tags resolving, and Playwright's bundled Chromium installing and passing.

### O3. Nothing has been pushed
All work is on the local `feature/milestone-0` branch. The remote is `origin` on GitHub. Pushing, merging and branch protection need the owner's explicit go-ahead.

### O4. Reference images
The owner's visual reference images are not in the repository, and the folder `docs/reference/` does not exist. Visual acceptance depends on them.
