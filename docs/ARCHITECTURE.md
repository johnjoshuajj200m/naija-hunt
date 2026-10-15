# Architecture

This document describes the application **as it exists today**. Anything planned is labelled as planned. For status see [`ROADMAP.md`](ROADMAP.md); for the reasons behind choices see [`DECISIONS.md`](DECISIONS.md).

## Stack in use

Installed and used:

- Vite 8, React 19, TypeScript 6 (strict), Tailwind CSS 4 (`@tailwindcss/vite`).
- Three.js 0.186 with `@react-three/fiber` 9.
- Vitest with jsdom and React Testing Library, Playwright, ESLint 10.

Named in the project brief but **not installed**: `@react-three/drei`, `@react-three/rapier`, Zustand (it appears in `node_modules` only as a transitive dependency of another package), Supabase, and any post-processing library. Hosting on Vercel is also planned and not configured.

## Runtime structure

```
index.html
  src/main.tsx                 mounts <App /> in StrictMode
    src/app/App.tsx            owns three pieces of UI state
      <section> 3D preview     lazy-loaded DistrictPreview, or a text fallback
      <MainMenu />             menu overlay (title, objective, Enter district, shortcuts, nav)
      <PrototypeSheet />       modal "Not built yet" dialog for Map, Inventory, Character, Profile
```

`App` holds:

- `webgl`: whether the browser can create a WebGL context, detected once. If not, a text message replaces the 3D view.
- `panel`: which placeholder panel is open, if any.
- `entryAttempted`: set when Enter district is pressed. It only reveals a message that nothing has launched, and it starts no gameplay.

The 3D module is loaded with `React.lazy`, so the menu appears before the Three.js code downloads. The production build therefore produces a separate scene chunk.

## The 3D scene

All of the scene is in `src/game/scenes/` and is built in code. **There are no imported models, textures or other asset files.**

- `DistrictPreview.tsx` is the React Three Fiber canvas. It sets up:
  - an ACES tone-mapped renderer (exposure 1.05) and a pixel ratio capped at 1.5;
  - a warm haze colour with matching fog;
  - two lights: one hemisphere light and one shadow-casting directional "sun" with a 1024 px shadow map;
  - `CameraRig`, which drifts the camera slightly and changes the lens and view offset by layout. At widths of 1024 px and above it uses a 62° lens and shifts the view clear of the 368 px menu column. Below that it uses a 98° lens and shifts the view to the band between the header and the bottom panel.
- `createDistrict.ts` assembles the scene into one group and returns `{ root, update, dispose }`. `update(elapsed)` moves the train, one minibus, the palm crowns and the marker gem. `dispose()` frees geometries, materials and textures.
- `street.ts`, `buildings.ts`, `props.ts` and `vehicles.ts` build the road, the elevated guideway, towers, a market, palms, danfo-style minibuses and the discovery marker. `sky.ts` draws the sky dome with a small shader.
- `materials.ts` defines the material palette. `textures.ts` draws every texture on a 2D canvas at runtime.
- `layout.ts` holds shared street dimensions in metres. `sceneHelpers.ts` holds small mesh and geometry helpers.

Not present in the scene: image-based lighting or environment maps, normal, roughness or ambient-occlusion maps, glTF loading, post-processing, a character, or any human figure.

## UI

- `MainMenu.tsx` is a layout overlay built with Tailwind. On wide screens it is a left column. On narrow screens it is a bottom panel with a header at the top.
- `PrototypeSheet.tsx` is an accessible modal dialog. Every panel states that the feature is not built. The Profile panel lists Crews, Chat, Heists and Multiplayer and says none of them exist.
- Design tokens (colours, fonts) are in `src/index.css` under `@theme`.

## Testing and quality gates

- Unit tests (`src/app/App.test.tsx`, 7 tests) cover the menu, the placeholder panels and the honest Enter district behaviour. jsdom cannot create WebGL contexts, so it logs "not implemented" notices for the canvas.
- Playwright smoke tests (`e2e/smoke.spec.ts`) run against a production build that Playwright builds and serves itself with `vite preview` on port 4173. They run in two projects: desktop (1100×640) and mobile (390×844). Server reuse is off on purpose.
- TypeScript is strict, with `noUncheckedIndexedAccess` and unused-code checks. ESLint covers `.ts` and `.tsx`.
- CI (`.github/workflows/ci.yml`) runs install, lint, typecheck, unit tests, build and Playwright. It has not yet run on GitHub.

Not covered by any test: how the 3D scene looks, its frame rate, its memory use, and anything on a real phone.

## Empty placeholders

These folders exist only as `.gitkeep` files and contain no code: `src/assets`, `src/features`, `src/lib`, `src/stores`, `src/game/entities`, `src/game/systems` and `src/game/controls`.

## Rule for future code

Game mechanics must stay independent of React UI components. There are no mechanics yet, so nothing currently tests this rule.
