import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { LabSection } from '../features/engineering-lab/LabSection'
import { homeDistance, moduleX } from '../features/engineering-lab/scene/layout'

const setup = () =>
  render(
    <MemoryRouter>
      <LabSection />
    </MemoryRouter>,
  )

describe('layout helpers', () => {
  it('centres modules on the origin', () => {
    expect(moduleX(0, 1)).toBe(0)
    expect(moduleX(0, 3)).toBeCloseTo(-moduleX(2, 3))
    expect(moduleX(1, 3)).toBe(0)
  })
  it('pulls the camera back as modules are added', () => {
    expect(homeDistance(3)).toBeGreaterThan(homeDistance(1))
  })
})

describe('LabSection without WebGL', () => {
  it('shows the 2D fallback with an explanation', () => {
    setup()
    expect(screen.getByText(/WebGL is not available/)).toBeInTheDocument()
    expect(document.querySelector('canvas')).toBeNull()
  })

  it('still lets keyboard users select a project and reach its case study', async () => {
    const user = userEvent.setup()
    setup()
    await user.tab()
    expect(screen.getByRole('button', { name: /EduVerse/ })).toHaveFocus()
    await user.keyboard('{Enter}')
    expect(screen.getByRole('button', { name: /EduVerse/ })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('link', { name: /Read the EduVerse case study/ })).toHaveAttribute(
      'href',
      '/projects/eduverse',
    )
    await user.keyboard('{Enter}')
    expect(screen.getByText(/Select a module/)).toBeInTheDocument()
  })
})
