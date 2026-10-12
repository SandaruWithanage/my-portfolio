/** Largest head turn, in radians: enough to feel the room, never enough to lose it. */
export const MAX_YAW = 0.14
export const MAX_PITCH = 0.06

const clamp = (v: number) => Math.max(-0.5, Math.min(0.5, v))

/** Map a pointer position in [-0.5, 0.5] to camera yaw/pitch (mouse right → look right). */
export function lookAngles(x: number, y: number): { yaw: number; pitch: number } {
  return { yaw: -clamp(x) * 2 * MAX_YAW, pitch: -clamp(y) * 2 * MAX_PITCH }
}

/** Extra camera turn toward the side of a destination as its screen opens. */
export const FOCUS_YAW = 0.12
/** How long the room keeps rendering after a screen opens, so the turn can settle before it pauses. */
export const FOCUS_SETTLE_MS = 650
