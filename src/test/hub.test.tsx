import { act, render, screen, waitFor, within } from '@testing-library/react'
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
    await user.click(screen.getByRole('button', { name: /Projects & Systems/ }))
    await user.click(screen.getByRole('link', { name: 'Open as page: Projects & Systems' }))
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
  it('shows each destination as a screen tile, reachable by keyboard', async () => {
    const user = userEvent.setup()
    renderAt('/')
    await user.tab() // skip link
    await user.tab()
    expect(screen.getByRole('button', { name: 'Initialize lab' })).toHaveFocus()
    await user.tab()
    expect(screen.getByRole('button', { name: 'Skip intro' })).toHaveFocus()
    await user.keyboard('{Enter}')
    for (const d of destinations) {
      expect(screen.getByRole('button', { name: new RegExp(d.title) })).toHaveAttribute('aria-expanded', 'false')
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

describe('holographic screens', () => {
  const tile = (name: RegExp) =>
    within(screen.getByRole('navigation', { name: 'Navigate systems' })).getByRole('button', { name })
  const region = (name: string) => screen.queryByRole('region', { name })

  it('opens a screen in place, keeps its route as a link and updates the URL', async () => {
    const user = userEvent.setup()
    const router = renderAt('/')
    await user.click(screen.getByRole('button', { name: 'Skip intro' }))
    await user.click(tile(/Identity & Communications/))
    expect(router.state.location.pathname).toBe('/')
    expect(router.state.location.search).toBe('?screen=contact')
    expect(region('Identity & Communications')).toBeInTheDocument()
    expect(tile(/Identity & Communications/)).toHaveAttribute('aria-expanded', 'true')
    for (const d of destinations.filter((x) => x.id === 'contact')) {
      expect(screen.getByRole('link', { name: `Open as page: ${d.title}` })).toHaveAttribute('href', d.to)
    }
  })

  it('sends the open screen back when another opens, and brings it forward again', async () => {
    const user = userEvent.setup()
    renderAt('/')
    await user.click(screen.getByRole('button', { name: 'Skip intro' }))
    await user.click(tile(/Skills & Education/))
    await user.click(tile(/Identity & Communications/))
    const back = region('Skills & Education')!
    expect(back).toHaveAttribute('inert')
    expect(region('Identity & Communications')).not.toHaveAttribute('inert')
    await user.click(screen.getByRole('button', { name: 'Bring Skills & Education forward' }))
    expect(region('Skills & Education')).not.toHaveAttribute('inert')
    expect(region('Identity & Communications')).toHaveAttribute('inert')
  })

  it('closing the front screen returns the one behind it; Esc closes too', async () => {
    mockReducedMotion(true)
    const user = userEvent.setup()
    const router = renderAt('/')
    await user.click(screen.getByRole('button', { name: 'Skip intro' }))
    await user.click(tile(/Skills & Education/))
    await user.click(tile(/Identity & Communications/))
    await user.click(screen.getByRole('button', { name: 'Close Identity & Communications' }))
    expect(region('Identity & Communications')).toBeNull()
    expect(region('Skills & Education')).not.toHaveAttribute('inert')
    expect(router.state.location.search).toBe('?screen=background')
    await user.keyboard('{Escape}')
    expect(region('Skills & Education')).toBeNull()
    expect(router.state.location.search).toBe('')
    expect(tile(/Skills & Education/)).toHaveFocus()
  })

  it('switches screens from the rail while one is open', async () => {
    const user = userEvent.setup()
    renderAt('/')
    await user.click(screen.getByRole('button', { name: 'Skip intro' }))
    await user.click(tile(/Skills & Education/))
    const rail = screen.getByRole('navigation', { name: 'Switch screen' })
    expect(within(rail).getByRole('button', { name: /Skills & Education/ })).toHaveAttribute('aria-current', 'true')
    await user.click(within(rail).getByRole('button', { name: /Projects & Systems/ }))
    expect(region('Projects & Systems')).not.toHaveAttribute('inert')
    expect(region('Skills & Education')).toHaveAttribute('inert')
  })

  it('closing updates state at once; the exit animation is an inert copy that then goes away', async () => {
    const user = userEvent.setup()
    const router = renderAt('/')
    await user.click(screen.getByRole('button', { name: 'Skip intro' }))
    await user.click(tile(/Skills & Education/))
    await user.click(screen.getByRole('button', { name: 'Close Skills & Education' }))
    expect(router.state.location.search).toBe('')
    expect(region('Skills & Education')).toBeNull()
    const copy = document.querySelector('.holo-window--exiting')
    expect(copy).toHaveAttribute('aria-hidden', 'true')
    await waitFor(() => expect(document.querySelector('.holo-window--exiting')).toBeNull(), { timeout: 2000 })
  })

  it('reopening a screen mid-exit cancels the exit and keeps it open', async () => {
    const user = userEvent.setup()
    renderAt('/')
    await user.click(screen.getByRole('button', { name: 'Skip intro' }))
    await user.click(tile(/Skills & Education/))
    await user.click(screen.getByRole('button', { name: 'Close Skills & Education' }))
    await user.click(tile(/Skills & Education/))
    expect(region('Skills & Education')).not.toHaveAttribute('inert')
    await new Promise((r) => setTimeout(r, 600))
    expect(region('Skills & Education')).toBeInTheDocument()
    expect(document.querySelector('.holo-window--exiting')).toBeNull()
  })

  it('leaves no inline styles on the identity after its reveal, so it can fade behind screens', async () => {
    const user = userEvent.setup()
    renderAt('/')
    await user.click(screen.getByRole('button', { name: 'Skip intro' }))
    const identity = document.querySelector<HTMLElement>('.hub-identity')!
    await waitFor(() => expect(identity.style.opacity).toBe(''), { timeout: 3000 })
    expect(identity.style.transform).toBe('')
  })

  it('opens a screen directly from its link, skipping the boot', () => {
    renderAt('/?screen=background')
    expect(screen.getByRole('status')).toHaveTextContent(/System online/)
    expect(region('Skills & Education')).toBeInTheDocument()
  })

  it('ignores an unknown screen id', () => {
    renderAt('/?screen=nope')
    expect(screen.getByRole('button', { name: 'Initialize lab' })).toBeInTheDocument()
    for (const d of destinations) expect(region(d.title)).toBeNull()
  })

  it('browser Back moves to the previous screen, then closes it', async () => {
    const user = userEvent.setup()
    const router = renderAt('/')
    await user.click(screen.getByRole('button', { name: 'Skip intro' }))
    await user.click(tile(/Skills & Education/))
    await user.click(tile(/Identity & Communications/))
    await act(() => router.navigate(-1))
    expect(region('Skills & Education')).not.toHaveAttribute('inert')
    await act(() => router.navigate(-1))
    for (const d of destinations) expect(region(d.title)).toBeNull()
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
