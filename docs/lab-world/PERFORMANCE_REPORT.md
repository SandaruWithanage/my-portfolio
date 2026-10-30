# Lab World 2.0 — performance report

Draw calls, low tier (renderer.info): atrium ~128, skills 99, core 96, gallery 70, sound 61, comms 46.
Meets the high-tier target (<150); misses the low-tier target (<80) in atrium, skills and core.

Bundles: entry 387.3 kB; Lab route and engine are lazy chunks. Robot GLB 464 kB.
Resources stable across remounts (59 geometries / 25 textures).

FPS: not measurable here (SwiftShader). To measure: `npm run build && npm run preview`, open `/?stats=1` on target devices, read the stats panel; use DevTools Performance for frame timing.
