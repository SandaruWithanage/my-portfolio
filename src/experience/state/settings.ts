export type QualityChoice = 'auto' | 'high' | 'medium' | 'low'

export type Settings = {
  quality: QualityChoice
  /** Sound is *preferred*; it still only starts after a user gesture each visit. */
  soundPreferred: boolean
  volume: number
  sensitivity: number
  invertY: boolean
  /** null = follow the OS `prefers-reduced-motion` setting. */
  reducedMotion: boolean | null
  captions: boolean
  seenHints: boolean
}

export const DEFAULT_SETTINGS: Settings = {
  quality: 'auto',
  soundPreferred: false,
  volume: 0.7,
  sensitivity: 1,
  invertY: false,
  reducedMotion: null,
  captions: true,
  seenHints: false,
}

const KEY = 'lab-world-settings-v1'

/** Only non-sensitive preferences are stored (graphics, captions, sound preference). */
export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return DEFAULT_SETTINGS
    const v = JSON.parse(raw) as Partial<Settings>
    const out = { ...DEFAULT_SETTINGS }
    if (v.quality && ['auto', 'high', 'medium', 'low'].includes(v.quality)) out.quality = v.quality
    if (typeof v.soundPreferred === 'boolean') out.soundPreferred = v.soundPreferred
    if (typeof v.volume === 'number') out.volume = Math.max(0, Math.min(1, v.volume))
    if (typeof v.sensitivity === 'number') out.sensitivity = Math.max(0.3, Math.min(2.5, v.sensitivity))
    if (typeof v.invertY === 'boolean') out.invertY = v.invertY
    if (v.reducedMotion === null || typeof v.reducedMotion === 'boolean') out.reducedMotion = v.reducedMotion ?? null
    if (typeof v.captions === 'boolean') out.captions = v.captions
    if (typeof v.seenHints === 'boolean') out.seenHints = v.seenHints
    return out
  } catch {
    return DEFAULT_SETTINGS
  }
}

export function saveSettings(s: Settings) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s))
  } catch {
    // Storage blocked: settings simply don't persist.
  }
}
