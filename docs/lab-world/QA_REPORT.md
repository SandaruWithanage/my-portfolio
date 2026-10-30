# Lab World 2.0 — QA report

Environment: headless Chromium with SwiftShader (software WebGL), production build via `vite preview`.

| Check | Result |
|---|---|
| `npx tsc -b` | clean |
| `npx oxlint` | clean |
| `npx vitest run` | 12 files, 112 tests pass |
| `npm run build` + `check:bundle` | entry 387.3 kB (budget 420 kB), no three.js in entry |
| Desktop journey (boot → arrival skip → door scan → atrium → EduVerse panel → case study → back/resume → map to all rooms → tour) | pass, 0 console errors |
| Mobile 390×844 touch | low tier auto-selected; joystick moved robot 4.25 m; map teleports work |
| Reduced motion | arrival → doorstep in ~0.4 s, no fly-through |
| Keyboard | Enter the lab focused at boot; Tab reaches tour; Esc opens menu with focus inside; Esc closes |
| Sound | 0 AudioContexts created without opt-in |
| Remount ×3 | 59 geometries / 25 textures each time (no growth) |
| No WebGL | `/` renders the 2D portfolio fallback with case-study links |

Known gaps
- Mobile: after map teleport to the gallery, no prompt appeared in the automated run (spawn spot is outside interact range); walking to an exhibit shows it.
- Real-GPU frame rate not measured (software renderer only, 1–2 fps).
