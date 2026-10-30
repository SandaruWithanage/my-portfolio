import type { Vec2 } from '../world/layout'

export type Candidate = {
  id: string
  x: number
  z: number
  /** How close the robot must be to use it. */
  radius: number
  /** If true, the robot must roughly face it (within ~110°). */
  facing?: boolean
  enabled?: boolean
}

/** Extra reach for the currently focused target, so the prompt doesn't flicker at the edge. */
export const HYSTERESIS = 0.5
const FACING_LIMIT = (110 * Math.PI) / 180

/**
 * Pick the single interactable to focus: nearest eligible target within reach, with
 * a small facing preference and hysteresis for the one already focused.
 */
export function resolveTarget(pos: Vec2, heading: number, items: Candidate[], current: string | null): string | null {
  let best: string | null = null
  let bestScore = Infinity
  for (const it of items) {
    if (it.enabled === false) continue
    const dx = it.x - pos.x
    const dz = it.z - pos.z
    const d = Math.hypot(dx, dz)
    const reach = it.radius + (it.id === current ? HYSTERESIS : 0)
    if (d > reach) continue
    let angle = 0
    if (d > 0.3) {
      const want = Math.atan2(dx, dz)
      angle = Math.abs(Math.atan2(Math.sin(want - heading), Math.cos(want - heading)))
      if (it.facing && angle > FACING_LIMIT) continue
    }
    // Distance dominates; facing breaks near-ties.
    const score = d + angle * 0.35 - (it.id === current ? 0.2 : 0)
    if (score < bestScore) {
      bestScore = score
      best = it.id
    }
  }
  return best
}

/** Per-target cooldown so repeated E presses or pad stomps can't spam actions. */
export function makeCooldowns(ms: number) {
  const last = new Map<string, number>()
  return {
    ready(id: string, now: number) {
      const t = last.get(id)
      if (t !== undefined && now - t < ms) return false
      last.set(id, now)
      return true
    },
  }
}
