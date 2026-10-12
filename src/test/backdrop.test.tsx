import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { HubBackdrop } from '../features/hub/backdrop/HubBackdrop'
import { lookAngles, MAX_PITCH, MAX_YAW } from '../features/hub/backdrop/look'
import { MONITOR_START_MS, monitorOn, monitorsSettleMs } from '../features/hub/backdrop/sequence'

describe('hub backdrop', () => {
  it('maps the pointer to a small, clamped head turn', () => {
    expect(lookAngles(0, 0)).toEqual({ yaw: -0, pitch: -0 })
    expect(lookAngles(0.5, 0.5)).toEqual({ yaw: -MAX_YAW, pitch: -MAX_PITCH })
    expect(lookAngles(-3, -3)).toEqual({ yaw: MAX_YAW, pitch: MAX_PITCH })
  })

  it('renders nothing without WebGL, leaving the CSS background', () => {
    const { container } = render(<HubBackdrop online paused={false} reducedMotion={false} />)
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
