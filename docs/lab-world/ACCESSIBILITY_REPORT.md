# Lab World 2.0 — accessibility report

- All exhibit content is real DOM (InspectPanel), readable by screen readers; `/portfolio` gives the full content without 3D.
- Keyboard: boot choices focusable, Esc menu traps focus, M map, 1–7 room jumps.
- `prefers-reduced-motion`: arrival fly-through and door animation skipped.
- Audio is opt-in only; captions accompany the tour.
- No-WebGL users get the 2D fallback automatically.
- Not yet audited with a real screen reader or axe; recommended before release.
