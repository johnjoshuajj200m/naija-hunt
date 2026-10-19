# Naija Hunt

A mobile-first, browser-based 3D treasure-hunting game inspired by Nigerian urban life.

## Current status (read this first)

Naija Hunt is an early prototype. It is **not a playable game yet**, and the 3D scene does **not** yet meet the project's visual target.

What exists today:

- A menu screen over a live 3D preview of **Palm Mile**, a fictional Lagos-inspired street.
- Honest placeholder panels for Map, Inventory, Character and Profile. Each says plainly that the feature is not built.
- An **Enter district** button that does nothing except report that walking and treasure hunting are not built yet.
- A fallback message when the browser cannot run WebGL.
- Automated checks: lint, type checking, unit tests, a production build, and browser smoke tests.

What does **not** exist yet:

- No gameplay: no movement, no treasure, no inventory, no coins, no saving.
- No protagonist. There is no character in the scene.
- No imported 3D models or image assets. The Palm Mile preview is built entirely in code (simple shapes with textures drawn on a canvas). It is a placeholder, not finished art.
- No accounts, database, multiplayer or rewards.

The approved visual direction (authored glTF assets, image-based lighting, a cinematic camera) is described in [`NAIJA_HUNT_CURSOR_MVP.md`](NAIJA_HUNT_CURSOR_MVP.md). None of it is implemented yet. See [`docs/ROADMAP.md`](docs/ROADMAP.md).

## Requirements

- Node.js `^22.22.2`, `^24.15.0` or `>=26` (see `engines` in `package.json`). CI uses Node 22, and `.nvmrc` contains `22`.
- npm.

## Run it

```bash
npm ci          # reproducible install from package-lock.json
npm run dev     # development server, http://localhost:5173
```

## Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | Vite development server |
| `npm run build` | Type-check (`tsc -b`) and build for production into `dist/` |
| `npm run preview` | Serve the production build on port 4173 |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript project build check (`tsc -b`) |
| `npm run test` | Vitest in watch mode. Use `npm run test -- --run` for a single run |
| `npm run test:e2e` | Playwright smoke tests (desktop and mobile) |

## Testing

- **Unit and component tests:** Vitest with React Testing Library, in `src/**/*.test.tsx`. 7 tests in `src/app/App.test.tsx`.
- **Browser smoke tests:** Playwright, in `e2e/smoke.spec.ts`. 4 tests run in each of 2 projects (`desktop-chromium` at 1100×640 and `mobile-chromium` at 390×844), so 8 in total. They build and serve a fresh production build, and they fail if the browser logs console errors or failed requests.

Playwright needs a browser. By default it uses its own Chromium, which you install once with `npx playwright install chromium`. To use a browser you already have, set `PW_BROWSER_CHANNEL`:

```powershell
$env:PW_BROWSER_CHANNEL = "chrome"
npm run test:e2e
```

What the tests do **not** prove: the 3D smoke test only checks that a canvas element or the fallback text is present. It does not check that the scene looks right or runs at a good frame rate. Frame rate and memory have not been measured yet.

## Continuous integration

`.github/workflows/ci.yml` runs on pull requests to `main` and pushes to `main`. It installs with `npm ci`, then runs lint, typecheck, unit tests, the production build and the Playwright smoke tests. It has read-only permissions and no secrets. **It has not yet run on GitHub**, and its YAML has not been checked by an independent validator.

## Project layout

```
src/app/                 App shell and its tests
src/components/ui/       Menu overlay and "not built yet" panels
src/game/scenes/         The procedural Palm Mile preview (Three.js / React Three Fiber)
src/assets/              Empty placeholder (no assets yet)
src/features/, src/lib/, src/stores/, src/game/{entities,systems,controls}/
                         Empty placeholders for later milestones
e2e/                     Playwright smoke tests
tests/                   Vitest setup
docs/                    Architecture, decisions and roadmap
```

More detail is in [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md), and the reasons behind choices are in [`docs/DECISIONS.md`](docs/DECISIONS.md).

## Environment variables

None are read yet. See [`.env.example`](.env.example).

## Known limitations

- The Palm Mile scene is a code-built placeholder and is not at the target visual quality.
- The 3D chunk is large (about 937 kB, about 251 kB gzipped, mostly Three.js). Vite warns about it, and the warning is intentionally left visible.
- The browser console shows one warning, `THREE.Clock: This module has been deprecated`. It comes from a dependency, because nothing in `src/` uses `Clock`.
- Performance has not been measured.
- No licence file has been added to the repository yet.
