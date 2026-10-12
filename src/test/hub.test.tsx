import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { routes } from '../app/router'
import { destinations } from '../features/hub/destinations'

function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  render(<RouterProvider router={router} />)
  return router
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
  sessionStorage.clear()
  mockReducedMotion(false)
})
afterEach(() => sessionStorage.clear())

describe('hub boot', () => {
  it('starts dormant with identity visible and no destinations yet', () => {
    renderAt('/')
    expect(screen.getByRole('status')).toHaveTextContent(/Standby/)
    expect(screen.getByRole('heading', { level: 1, name: 'Sandaru Withanage' })).toBeInTheDocument()
    expect(screen.queryByRole('navigation', { name: 'Navigate systems' })).toBeNull()
  })

  it('can skip the boot sequence once it has started', async () => {
    const user = userEvent.setup()
    renderAt('/')
    await user.click(screen.getByRole('button', { name: 'Initialize lab' }))
    expect(screen.getByRole('status')).toHaveTextContent(/Initializing/)
    await user.click(screen.getByRole('button', { name: 'Skip' }))
    expect(screen.getByRole('navigation', { name: 'Navigate systems' })).toBeInTheDocument()
  })

  it('completes the boot on its own and moves focus to the destinations', async () => {
    const user = userEvent.setup()
    renderAt('/')
    await user.click(screen.getByRole('button', { name: 'Initialize lab' }))
    const nav = await screen.findByRole('navigation', { name: 'Navigate systems' }, { timeout: 4000 })
    await waitFor(() => expect(nav).toHaveFocus())
  })

  it('goes straight online under reduced motion (no boot sequence)', async () => {
    mockReducedMotion(true)
    const user = userEvent.setup()
    renderAt('/')
    await user.click(screen.getByRole('button', { name: 'Initialize lab' }))
    expect(screen.queryByRole('button', { name: 'Skip' })).toBeNull()
    expect(screen.getByRole('status')).toHaveTextContent(/System online/)
  })

  it('does not replay the boot within the same session', async () => {
    const user = userEvent.setup()
    const router = renderAt('/')
    await user.click(screen.getByRole('button', { name: 'Skip intro' }))
    await user.click(screen.getByRole('link', { name: /Projects & Systems/ }))
    expect(router.state.location.pathname).toBe('/projects')
    await user.click(screen.getByRole('link', { name: /Return to lab/ }))
    expect(screen.getByRole('status')).toHaveTextContent(/System online/)
    expect(screen.queryByRole('button', { name: 'Initialize lab' })).toBeNull()
  })

  it('still works when sessionStorage is unavailable', async () => {
    const orig = Storage.prototype.getItem
    const origSet = Storage.prototype.setItem
    Storage.prototype.getItem = () => {
      throw new Error('blocked')
    }
    Storage.prototype.setItem = () => {
      throw new Error('blocked')
    }
    try {
      const user = userEvent.setup()
      renderAt('/')
      await user.click(screen.getByRole('button', { name: 'Skip intro' }))
      expect(screen.getByRole('navigation', { name: 'Navigate systems' })).toBeInTheDocument()
    } finally {
      Storage.prototype.getItem = orig
      Storage.prototype.setItem = origSet
    }
  })
})

describe('hub destinations', () => {
  it('links each destination to an existing route, reachable by keyboard', async () => {
    const user = userEvent.setup()
    renderAt('/')
    await user.tab() // skip link
    await user.tab()
    expect(screen.getByRole('button', { name: 'Initialize lab' })).toHaveFocus()
    await user.tab()
    expect(screen.getByRole('button', { name: 'Skip intro' })).toHaveFocus()
    await user.keyboard('{Enter}')
    for (const d of destinations) {
      expect(screen.getByRole('link', { name: new RegExp(d.title) })).toHaveAttribute('href', d.to)
    }
  })

  it('contains no unpublished employer work or résumé link', async () => {
    const user = userEvent.setup()
    renderAt('/')
    await user.click(screen.getByRole('button', { name: 'Skip intro' }))
    const text = document.body.textContent ?? ''
    for (const banned of ['Breadcrumbs', 'BeyondHR', 'EZPOS', 'ezClerks', 'Divisarana', 'EV Charger', 'Résumé', 'Resume']) {
      expect(text, banned).not.toContain(banned)
    }
  })
})

describe('HUD bar on inner pages', () => {
  it('shows return-to-lab, back and the current destination on a direct URL', () => {
    renderAt('/projects/eduverse')
    expect(screen.getByRole('link', { name: /Return to lab/ })).toHaveAttribute('href', '/')
    expect(screen.getByRole('button', { name: 'Back' })).toBeInTheDocument()
    expect(screen.getByText(/Projects & Systems \/ Case study/)).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1, name: 'EduVerse' })).toBeInTheDocument()
  })

  it('Back returns to the lab when there is no in-app history', async () => {
    const user = userEvent.setup()
    const router = renderAt('/contact')
    await user.click(screen.getByRole('button', { name: 'Back' }))
    expect(router.state.location.pathname).toBe('/')
  })

  it('keeps the existing 3D lab on the Engineering Workshop page', () => {
    renderAt('/engineering')
    expect(screen.getByRole('heading', { name: /Explore EduVerse’s architecture/ })).toBeInTheDocument()
  })
})
