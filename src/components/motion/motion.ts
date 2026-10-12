// Anime.js owns DOM motion; Three.js owns the scene (see features/engineering-lab).
// Durations follow the blueprint's motion spec. CSS owns plain hover/focus colour
// transitions, so Anime never animates properties on those elements.
export const DURATION = {
  reveal: 600,
  panel: 350,
  route: 200,
  canvas: 600,
} as const

export const STAGGER_MS = 70
