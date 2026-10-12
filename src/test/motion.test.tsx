import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useRef } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const calls = vi.hoisted(() => ({ animate: 0, set: 0, revert: 0, scopes: 0 }))

vi.mock('animejs', () => ({
  animate: () => {
    calls.animate++
  },
  stagger: () => 0,
  utils: {
    set: () => {
      calls.set++
    },
  },
  createScope: () => {
    calls.scopes++
    const scope = {
      add(cb: () => void) {
        cb()
        return scope
      },
      revert: () => {
        calls.revert++
      },
    }
    return scope
  },
}))

import { useReveal } from '../components/motion/useReveal'
import { LabSection } from '../features/engineering-lab/LabSection'

function Demo({ dep = 0 }: { dep?: number }) {
  const ref = useRef<HTMLDivElement>(null)
  useReveal(ref, { selector: '[data-motion]', deps: [dep] })
  return (
    <div ref={ref}>
      <p data-motion>hello</p>
    </div>
  )
}

function mockReducedMotion(reduce: boolean) {
  window.matchMedia = ((q: string) => ({
    matches: reduce && q.includes('reduce'),
    media: q,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia
}

beforeEach(() => {
  calls.animate = calls.set = calls.revert = calls.scopes = 0
  mockReducedMotion(false)
})

describe('useReveal', () => {
  it('animates its targets and reverts on unmount', () => {
    const { unmount } = render(<Demo />)
    expect(calls.animate).toBe(1)
    expect(calls.set).toBe(1)
    unmount()
    expect(calls.revert).toBe(1)
  })

  it('does nothing under prefers-reduced-motion', () => {
    mockReducedMotion(true)
    render(<Demo />)
    expect(calls.scopes).toBe(0)
    expect(calls.animate).toBe(0)
    expect(screen.getByText('hello')).toBeVisible()
  })

  it('reverts the previous run before starting a new one when deps change', () => {
    const { rerender } = render(<Demo dep={0} />)
    for (let i = 1; i <= 10; i++) rerender(<Demo dep={i} />)
    expect(calls.animate).toBe(11)
    expect(calls.revert).toBe(10)
  })
})

describe('lab panel transitions', () => {
  it('reverts and restarts on each rapid selection toggle and leaves content visible', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <LabSection />
      </MemoryRouter>,
    )
    const button = screen.getByRole('button', { name: /EduVerse/ })
    const before = calls.revert
    for (let i = 0; i < 10; i++) await user.click(button)
    expect(calls.revert - before).toBe(10)
    expect(screen.getByText(/Select a module/)).toBeVisible()
  })

  it('explains why the 2D view is shown when WebGL is missing', () => {
    render(
      <MemoryRouter>
        <LabSection />
      </MemoryRouter>,
    )
    expect(screen.getByText(/WebGL is not available/)).toBeInTheDocument()
  })
})
