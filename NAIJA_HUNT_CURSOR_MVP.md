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
- Use procedural geometry (no Blender requirement yet) for ground, roads, 3 buildings, trees, daylight, and 2 selectable locations.
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
