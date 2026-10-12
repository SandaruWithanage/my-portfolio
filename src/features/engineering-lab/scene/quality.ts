export type Quality = 'high' | 'low'

type NavigatorHints = { deviceMemory?: number; hardwareConcurrency?: number }

/** Pick a render tier. `?quality=low|high` overrides detection (useful for testing). */
export function detectQuality(
  search: string = typeof location === 'undefined' ? '' : location.search,
  width: number = typeof innerWidth === 'undefined' ? 1280 : innerWidth,
  nav: NavigatorHints = typeof navigator === 'undefined' ? {} : (navigator as NavigatorHints),
): Quality {
  const forced = new URLSearchParams(search).get('quality')
  if (forced === 'low' || forced === 'high') return forced
  if (width < 640) return 'low'
  if (nav.deviceMemory !== undefined && nav.deviceMemory <= 2) return 'low'
  if (nav.hardwareConcurrency !== undefined && nav.hardwareConcurrency <= 2) return 'low'
  return 'high'
}

export const maxPixelRatio = (q: Quality) => (q === 'low' ? 1.25 : 2)
