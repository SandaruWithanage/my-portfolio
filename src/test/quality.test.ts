import { describe, expect, it } from 'vitest'
import { detectQuality, maxPixelRatio } from '../features/engineering-lab/scene/quality'

describe('detectQuality', () => {
  it('defaults to high on a capable desktop', () => {
    expect(detectQuality('', 1440, { deviceMemory: 8, hardwareConcurrency: 8 })).toBe('high')
  })
  it('drops to low on narrow viewports and weak devices', () => {
    expect(detectQuality('', 375, {})).toBe('low')
    expect(detectQuality('', 1440, { deviceMemory: 2 })).toBe('low')
    expect(detectQuality('', 1440, { hardwareConcurrency: 2 })).toBe('low')
  })
  it('lets ?quality override detection both ways', () => {
    expect(detectQuality('?quality=low', 1440, {})).toBe('low')
    expect(detectQuality('?quality=high', 375, {})).toBe('high')
    expect(detectQuality('?quality=bogus', 1440, {})).toBe('high')
  })
  it('caps pixel ratio lower on the low tier', () => {
    expect(maxPixelRatio('low')).toBeLessThan(maxPixelRatio('high'))
  })
})
