import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { HubBackdrop } from '../features/hub/backdrop/HubBackdrop'
import { createLookSource } from '../features/hub/lookSource'
import { lookAngles, MAX_PITCH, MAX_YAW } from '../features/hub/backdrop/look'
import { AMBIENT_FRAME_MS, MONITOR_START_MS, monitorOn, monitorsSettleMs, shouldDraw } from '../features/hub/backdrop/sequence'
import { coreTiers } from '../features/hub/backdrop/core'
import { graphNodes } from '../data/eduverse-graph'

describe('hub backdrop', () => {
  it('maps the pointer to a small, clamped head turn', () => {
    expect(lookAngles(0, 0)).toEqual({ yaw: -0, pitch: -0 })
    expect(lookAngles(0.5, 0.5)).toEqual({ yaw: -MAX_YAW, pitch: -MAX_PITCH })
    expect(lookAngles(-3, -3)).toEqual({ yaw: MAX_YAW, pitch: MAX_PITCH })
  })

  it('renders nothing without WebGL, leaving the CSS background', () => {
    const { container } = render(<HubBackdrop online paused={false} focus={0} look={createLookSource()} reducedMotion={false} />)
    expect(container.querySelector('canvas')).toBeNull()
  })
})

describe('activation sequence', () => {
  it('powers the bench monitors on left to right, all within the boot', () => {
    expect(monitorOn(0, MONITOR_START_MS - 1)).toBe(false)
    expect(monitorOn(0, MONITOR_START_MS)).toBe(true)
    expect(monitorOn(1, MONITOR_START_MS)).toBe(false)
    expect(monitorOn(3, monitorsSettleMs(4))).toBe(true)
    // The boot log runs ~0.9s; the desk should be fully lit by then.
    expect(monitorsSettleMs(4)).toBeLessThanOrEqual(900)
  })
})

describe('centerpiece', () => {
  it('places every EduVerse component on exactly one tier, infra at the base', () => {
    const tiers = coreTiers(graphNodes)
    const placed = tiers.flatMap((t) => t.ids)
    expect(placed.sort()).toEqual(graphNodes.map((n) => n.id).sort())
    expect(tiers[0].ids).toEqual(['infra'])
    expect(tiers[3].ids).toEqual(['client'])
  })

  it('caps ambient rendering at 30 fps but never throttles a transition', () => {
    expect(shouldDraw(false, 10)).toBe(false)
    expect(shouldDraw(false, AMBIENT_FRAME_MS)).toBe(true)
    expect(shouldDraw(true, 0)).toBe(true)
  })
})

describe('shared look source', () => {
  it('gives every subscriber the same reading, including the current one on subscribe', () => {
    const src = createLookSource()
    const a: unknown[] = []
    const b: unknown[] = []
    src.set({ x: 0.2, y: -0.1 })
    const offA = src.subscribe((l) => a.push(l))
    src.subscribe((l) => b.push(l))
    src.set({ x: -0.3, y: 0.4 })
    offA()
    src.set({ x: 0, y: 0 })
    expect(a).toEqual([{ x: 0.2, y: -0.1 }, { x: -0.3, y: 0.4 }])
    expect(b).toEqual([{ x: 0.2, y: -0.1 }, { x: -0.3, y: 0.4 }, { x: 0, y: 0 }])
  })
})
