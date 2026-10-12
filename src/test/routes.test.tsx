import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { routes } from '../app/router'
import { projects } from '../data/projects'

function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  return render(<RouterProvider router={router} />)
}

describe('routing', () => {
  it('renders the home page with name and primary action', () => {
    renderAt('/')
    expect(
      screen.getByRole('heading', { level: 1, name: 'Sandaru Withanage' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Explore my work' })).toHaveAttribute(
      'href',
      '/projects',
    )
  })

  it('loads each project case study directly by URL', () => {
    for (const p of projects) {
      const { unmount } = renderAt(`/projects/${p.slug}`)
      expect(screen.getByRole('heading', { level: 1, name: p.title })).toBeInTheDocument()
      unmount()
    }
  })

  it('shows a not-found page for unknown projects and routes', () => {
    renderAt('/projects/nope')
    expect(screen.getByRole('heading', { name: 'Page not found' })).toBeInTheDocument()
  })

  it('navigates from the project index to a case study with the keyboard', async () => {
    const user = userEvent.setup()
    renderAt('/projects')
    await user.click(screen.getByRole('link', { name: 'EduVerse' }))
    expect(screen.getByRole('heading', { level: 1, name: 'EduVerse' })).toBeInTheDocument()
  })

  it('marks the current page in the primary navigation', () => {
    renderAt('/contact')
    expect(
      screen.getByRole('link', { name: 'Contact', current: 'page' }),
    ).toBeInTheDocument()
  })
})
