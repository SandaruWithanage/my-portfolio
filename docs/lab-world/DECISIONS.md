# Lab World 2.0 — Decisions

1. **Same repository, isolated module.** New code lives in `src/experience/`; existing pages and data are untouched.
2. **Routing.** Built at `/lab`; after validation `/` serves the Lab. The legacy hub stays reachable at `/classic`
   (not deleted) because it carries the user's uncommitted Phase 1a/A work; all other routes unchanged.
3. **2D portfolio home.** New `/portfolio` page (inside the existing Layout) is the "View portfolio" target and the
   automatic fallback when WebGL is unavailable. Recruiter path: `/` → View portfolio → case study (2 actions).
4. **No new dependencies.** Collision is circle-vs-AABB against a static, data-defined floor plan; audio is Web Audio;
   loading uses `fetch` streaming for real byte progress and three's bundled `GLTFLoader`.
5. **World is data first.** `world/layout.ts` defines rooms, corridors, walls (derived), doors, spawns and the room
   graph as pure data with tests; meshes are built from it, so collision and visuals cannot drift apart.
6. **Robot.** RobotExpressive (CC0, verified). If it fails to load, a procedural robot is used and the UI says so.
7. **Content only from `src/data`.** One real project (EduVerse); the gallery adds only real, existing exhibits
   (the Architecture Explorer route and this lab) and no invented projects or achievements. No CV link (none exists).
8. **React owns phase/UI state** through a pure reducer; the engine emits typed events and never owns copy.
