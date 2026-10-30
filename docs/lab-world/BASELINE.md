# Lab World 2.0 — Baseline (factual, before implementation)

Recorded on branch `feature/lab-world-2`, created from `dev` @ `3e73e8a` with the working tree carried over.

## Repository
- Stack: React 19.2, React Router 7, Vite, TypeScript (strict, ES2023), three 0.186.1, animejs 4.5.0,
  Vitest 5 + jsdom + Testing Library, oxlint. No other runtime dependencies.
- Scripts: `dev`, `build` (`tsc -b && vite build`), `lint` (oxlint), `preview`, `test` (vitest run),
  `check:bundle` (entry chunk ≤ 420 kB, no three.js in the entry chunk).
- Deploy config: `vercel.json` rewrites all paths to `index.html` (SPA).

## Baseline validation (before any Lab World change)
- `npx tsc -b`: clean. `npx vitest run`: 11 files, **72/72 passed**.

## Routes
- `/` — legacy command-centre hub (`src/features/hub`), its 3D backdrop, HoloScreens overlay windows.
- `/projects`, `/projects/:slug` (case study), `/engineering` (EduVerse 3D architecture explorer),
  `/background`, `/contact`, `*` not found — all inside `Layout`.

## Canonical content (`src/data`)
- `profile.ts`: name, role, tagline, summary, email, GitHub, LinkedIn, site, location; 6 skill groups
  (Languages, Backend, Frontend, Data, DevOps, Testing); 3 education entries. **No CV/résumé URL exists.**
- `projects.ts`: **one** project, `eduverse` (summary, period, status, role, stack, url, highlights, sections).
- `eduverse-graph.ts`: 7 nodes (client, api, db, queue, sync, cms, infra), 7 edges (one unconfirmed),
  3 request traces.

## Assets
- `public/` held only `favicon.svg`. No models, textures, sounds or fonts were shipped.
- Added for Lab World: `public/models/robot/RobotExpressive.glb` (CC0, provenance in its LICENSE.md).

## Dirty work preserved
Uncommitted on `dev` and carried to this branch (Phase 1a/1a.1 workshop grounding, Phase A city):
`src/features/hub/backdrop/{createBackdrop,workshop,HubBackdrop}.ts(x)`, `props.ts`, `city.ts`,
`src/test/{render-budget,props,city}.test.ts`. Archived as a patch outside the repo before any change.

## Reusable pieces
- `features/engineering-lab/support.ts` `isWebGLAvailable` (WebGL detection).
- `features/hub/backdrop/core.ts` `buildCore`/`coreTiers` (data-driven EduVerse core mesh).
- Render-on-demand, quality-tier and disposal patterns from `createBackdrop.ts`.
