import type { QualityChoice } from '../state/settings'

export type Tier = 'high' | 'medium' | 'low'

export const TIER_SETTINGS: Record<Tier, { pixelRatio: number; shadows: boolean; particles: number; pointLights: boolean }> = {
  high: { pixelRatio: 2, shadows: true, particles: 400, pointLights: true },
  medium: { pixelRatio: 1.5, shadows: false, particles: 160, pointLights: true },
  low: { pixelRatio: 1, shadows: false, particles: 0, pointLights: false },
}

type Hints = { width: number; deviceMemory?: number; hardwareConcurrency?: number; coarsePointer?: boolean }

/** Conservative starting tier from device hints; `auto` then adapts from measured frame time. */
export function initialTier(choice: QualityChoice, hints: Hints): Tier {
  if (choice !== 'auto') return choice
  if (hints.width < 700 || hints.coarsePointer) return 'low'
  if ((hints.deviceMemory ?? 8) <= 4 || (hints.hardwareConcurrency ?? 8) <= 4) return 'medium'
  return 'high'
}

const ORDER: Tier[] = ['low', 'medium', 'high']

/**
 * Auto quality with hysteresis: step down after ~3 s of slow frames, step up only
 * after ~8 s of comfortably fast ones, never above the starting cap. Never flips per frame.
 */
export function createAutoTier(start: Tier) {
  let tier = start
  let slow = 0
  let fast = 0
  return {
    get tier() {
      return tier
    },
    /** Feed one frame's duration (ms); returns the tier (possibly changed). */
    sample(frameMs: number): Tier {
      if (frameMs > 30) {
        slow += frameMs
        fast = 0
      } else if (frameMs < 15) {
        fast += frameMs
        slow = Math.max(0, slow - frameMs)
      } else {
        slow = Math.max(0, slow - frameMs)
        fast = 0
      }
      const i = ORDER.indexOf(tier)
      if (slow > 3000 && i > 0) {
        tier = ORDER[i - 1]
        slow = 0
      } else if (fast > 8000 && i < ORDER.indexOf(start)) {
        tier = ORDER[i + 1]
        fast = 0
      }
      return tier
    },
  }
}
