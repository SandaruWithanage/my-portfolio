import { describe, expect, it } from 'vitest'
import { projects } from '../data/projects'

describe('project data', () => {
  it('has unique, URL-safe slugs', () => {
    const slugs = projects.map((p) => p.slug)
    expect(new Set(slugs).size).toBe(slugs.length)
    for (const s of slugs) expect(s).toMatch(/^[a-z0-9-]+$/)
  })

  it('gives every project a role, status and at least one section', () => {
    for (const p of projects) {
      expect(p.role).not.toBe('')
      expect(p.status).not.toBe('')
      expect(p.sections.length).toBeGreaterThan(0)
    }
  })
})
