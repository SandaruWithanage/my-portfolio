import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { HubBackdrop } from '../features/hub/backdrop/HubBackdrop'
import { lookAngles, MAX_PITCH, MAX_YAW } from '../features/hub/backdrop/look'

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
