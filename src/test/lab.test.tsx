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
    screen.getByRole('button', { name: /Next.js client/ }).focus()
    expect(screen.getByRole('button', { name: /Next.js client/ })).toHaveFocus()
    await user.keyboard('{Enter}')
    expect(screen.getByRole('button', { name: /Next.js client/ })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('link', { name: /See this in the EduVerse case study/ })).toHaveAttribute(
      'href',
      '/projects/eduverse#architecture',
    )
    await user.keyboard('{Enter}')
    expect(screen.getByText(/Select a module/)).toBeInTheDocument()
  })
})

describe('trace controls', () => {
  it('steps through a trace with captions and resets', async () => {
    const user = userEvent.setup()
    setup()
    await user.click(screen.getByRole('button', { name: 'Tenant-isolated request' }))
    expect(screen.getByText(/Step 1 of 2:/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Next' }))
    expect(screen.getByText(/Step 2 of 2:/)).toBeInTheDocument()
    expect(screen.getByText(/Row-Level Security, so only that tenant/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Reset' }))
    expect(screen.queryByText(/Step 1 of/)).toBeNull()
  })

  it('clears the trace when a module is selected, and vice versa', async () => {
    const user = userEvent.setup()
    setup()
    await user.click(screen.getByRole('button', { name: 'NestJS API' }))
    expect(screen.getByRole('button', { name: 'NestJS API' })).toHaveAttribute('aria-pressed', 'true')
    await user.click(screen.getByRole('button', { name: 'Public school site' }))
    expect(screen.getByText(/Step 1 of 2:/)).toBeInTheDocument()
    expect(screen.getByText(/Select a module/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'NestJS API' }))
    expect(screen.queryByText(/Step 1 of/)).toBeNull()
  })

  it('renders the 2D architecture diagram as the fallback with an accessible description', () => {
    setup()
    expect(screen.getByRole('img', { name: /EduVerse system architecture/ })).toBeInTheDocument()
  })
})
