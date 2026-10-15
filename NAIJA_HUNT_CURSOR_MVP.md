# NAIJA HUNT — CURSOR MASTER BUILD BRIEF

## Mission
Build a maintainable, mobile-first, browser-based 3D treasure-hunting game inspired by Nigerian urban life. The first release is a vertical slice, NOT a full open world. Use a realistic-stylized daylight aesthetic, restrained colors, clear HUD, and performant 3D.

## Non-negotiable engineering rules
1. Work in small, reviewable milestones. Before changing code, explain the goal, files affected, risks, and acceptance tests in plain English.
2. Never silently change architecture or install major dependencies. Explain tradeoffs and ask for approval.
3. Do not implement real-money rewards, deposits, crypto, or withdrawals.
4. No fabricated working features. Use visible placeholders and TODOs for deferred functionality.
5. Never commit secrets or service-role keys. Provide .env.example with placeholders.
6. Do not call a milestone complete until lint, typecheck, tests, and production build pass.
7. Keep game mechanics independent from React UI components. Avoid a giant Game.tsx.
8. Prefer simple, accessible mobile controls. Limit draw calls, polygon counts, and textures.
9. Every milestone must end with: changed files, how to run, tests executed, known limitations, next step.
10. Do not run git push, deploy to production, or change database schema without explicit permission.

## Stack
Vite + React + TypeScript, Three.js + @react-three/fiber + @react-three/drei, @react-three/rapier for physics when needed, Zustand for local state, Tailwind CSS for UI, Supabase for auth and persistence in a later milestone, Vitest + React Testing Library for unit/component tests, Playwright for end-to-end smoke tests, GitHub Actions CI, Vercel for hosting.

## Visual identity
Portrait-first mobile. Daylight, warm neutral roads and buildings, muted greenery, charcoal/dark green HUD panels, small gold accents. Lagos-inspired fictional district, not a geographically exact map. No neon sci-fi aesthetic. Realistic proportions, readable touch targets, restrained effects.

## Vertical-slice gameplay
Start screen -> city scene/map -> select market or park -> show location details -> travel/enter scene -> third-person movement -> interact with one treasure chest -> validate collection -> update fictional coins and inventory -> visit home -> display collected artifact. Save locally for first iteration, then replace with server-validated Supabase persistence.

## Screen inventory for first slice
NH-01 Welcome; NH-03 Avatar Selection (preset characters); NH-04 City; NH-05 Location Details; NH-06 Treasure Discovery; NH-13 Missions; NH-H01 House Interior; NH-H02 Inventory/Display. Keep Crews, Chat, Jail, Heists, Multiplayer, and Cash Rewards clearly marked future features.

## Milestone 0: repository foundation
- Scaffold Vite React TS and Tailwind.
- Create src/app, src/components/ui, src/game/scenes, src/game/entities, src/game/systems, src/game/controls, src/features, src/lib, src/stores, src/assets, tests, docs.
- Add scripts: dev, build, preview, lint, typecheck, test, test:e2e.
- Configure ESLint, TypeScript strict mode, Vitest, Playwright smoke test, and GitHub Actions.
- Add README, ARCHITECTURE.md, DECISIONS.md, ROADMAP.md, .env.example.
- Acceptance: fresh install works; app renders; lint, typecheck, unit tests and build pass; Playwright homepage smoke test passes.

## Milestone 1: UI prototype
- Responsive HUD and five-tab navigation: City, Hunt, Crews (disabled/coming soon), Rankings (placeholder), My World.
- Location selection drawer, travel choices and cost labels; avoid invented travel metrics.
- Accessible keyboard/touch interactions and loading/error states.
- Acceptance: mobile viewport usable without horizontal scrolling; navigation and drawer tests pass.

## Milestone 2: first playable 3D district
- Use procedural geometry (no Blender requirement yet) for ground, roads, 3 buildings, trees, daylight, and 2 selectable locations. (Environment art approach superseded by the Visual Direction Amendment at the end of this document.)
- Add third-person placeholder avatar, joystick/touch input, desktop WASD, camera follow, basic collision, scene entry/exit.
- Performance target: aim for smooth operation on a midrange phone; measure FPS and memory rather than guaranteeing 60 FPS.
- Acceptance: player moves and can reach/interact with one location on desktop and mobile touch simulator.

## Milestone 3: treasure loop
- Add chest interaction, clue, inventory, fictional coins, energy and XP.
- Centralize reward calculations in pure tested functions; prevent duplicate chest collection.
- First pass local persistence only; explicitly mark it insecure and not authoritative.
- Acceptance: chest collectible once per save; rewards correct; reload restores progress.

## Milestone 4: home vertical slice
- One small furnished house scene; enter through door, walk inside, display collected artifact.
- Optional furniture repositioning for one item, with bounds checks and saved transform.
- Acceptance: house entry works; collected item displayed; furniture placement remains in bounds.

## Milestone 5: Supabase integration
- Add email or OAuth auth, profiles, inventory, game progress, furniture layout tables with RLS.
- Server-side reward validation and idempotent claim operations via trusted backend/database functions.
- Do not expose service role key in browser. Add migration files and tests.
- Acceptance: two accounts cannot read/modify each other's private saves; repeated reward claims do not double pay.

## CI and deployment policy
- Branches: main = production; develop optional; feature/<milestone-name> for work.
- Open pull request to main. Require GitHub Actions checks: npm ci, npm run lint, npm run typecheck, npm run test -- --run, npm run build, npm run test:e2e (with installed browser).
- Protect main: require PR, passing checks, and review if available on plan/repository.
- Vercel preview deployment for PR; production only after merge to main.
- IMPORTANT: local Git hooks are bypassable; GitHub branch protection and CI are the enforcement layer. CI cannot guarantee no runtime bugs. Preview and manual gameplay testing remain necessary.
- Never push broken code intentionally. If a check fails, show the precise error and fix the cause before retrying. Do not disable checks to make CI green.

## Cursor operating protocol
For EACH milestone:
A. Inspect repository and read docs before editing.
B. Propose a small implementation plan and wait for approval if the scope changes.
C. Implement only the approved milestone.
D. Run all relevant checks and fix failures.
E. Explain in plain English what changed, where to click, how to verify, and any known issues.
F. Suggest a commit message; ask before pushing.

## First instruction to Cursor
Start with Milestone 0 ONLY. Do not build the entire game. First show the planned directory tree, dependency list, npm scripts, and CI workflow. Then implement the foundation, execute verification commands, and summarize results. If you cannot execute a command, state that clearly; do not claim it passed.

## Visual Direction Amendment (2026-10-15)
Proposed, pending owner approval. Once approved, where this section conflicts with earlier text, this section wins. All other rules above, including every non-negotiable engineering rule, still apply.

### Why
The procedural-geometry Palm Mile preview (plain boxes, canvas-drawn colour textures, one sun, no imported models, no character) does not reach the intended quality. Adding more primitive geometry will not close that gap.

### Target
A premium, cinematic, realistic-stylized 3D adventure set in a futuristic Nigerian environment. This is NOT photorealism and must never be described as such. Naija Hunt has its own identity: do not copy another game's characters, interface, world or assets. The Nigerian setting stays recognizable through architecture, roads, markets, vegetation, transport (danfo, keke and similar), signage and other local detail. Futuristic infrastructure must be believable and restrained; the earlier "no neon sci-fi aesthetic" rule remains.

### Rendering and asset pipeline
- Keep Three.js and @react-three/fiber. Do not switch engines.
- Move from procedural primitives to authored or licensed glTF/GLB environment assets with PBR materials, baked or carefully optimized lighting, image-based lighting, a curated cinematic camera and lightweight atmospheric effects.
- The Milestone 1 plan will propose any new runtime dependency (for example @react-three/drei) for approval before it is installed.
- Optimize assets with compression (Draco or Meshopt for geometry, KTX2 for textures), trim sheets or atlases, level of detail, and quality tiers. Concrete performance and download budgets are set from measured numbers in Milestone 1, then enforced.
- Frame rate, memory and draw calls are measured, never guessed or promised.

### Asset sourcing and licences
- Sourcing order: (1) open or licensed kits whose exact licence has been checked; (2) commissioned or modified assets for what is missing, especially the Nigerian protagonist and Lagos-specific props.
- The exact licence of every external asset is read on its source page and recorded (source URL, licence, attribution requirement, date checked) in docs/ASSET_LICENSES.md BEFORE the asset is downloaded or integrated. Do not assume a licence from memory. Unclear or restrictive terms mean the asset is not used.
- No asset is downloaded and no character is integrated without the owner's explicit approval of that specific asset.
- Never present a placeholder as a finished asset. The character stays clearly labelled "not implemented" in the UI until an approved protagonist is integrated.

### Revised milestone order for the visual track
- Milestone 0 is completed first (Playwright smoke test, CI workflow, README, ARCHITECTURE.md, DECISIONS.md, ROADMAP.md, .env.example).
- Visual M1: look-development gate with a few hero assets, then one curated hero junction with baked lighting, image-based lighting, atmosphere and a cinematic camera. Owner reviews against the reference images before the scene is scaled up.
- Visual M2: approved Nigerian protagonist with appropriate clothing and idle, walk and run animations.
- Visual M3: polished game menu composed around the real environment and character.
- Visual M4: performance optimization and verified mobile and desktop rendering.
- Later: movement, exploration and treasure discovery, then the persistence work already listed above.
