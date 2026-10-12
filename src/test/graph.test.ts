import { describe, expect, it } from 'vitest'
import {
  edgeById,
  graphEdges,
  graphNodes,
  graphTraces,
  nodeById,
  traceNodeIds,
} from '../data/eduverse-graph'
import { getProject } from '../data/projects'

const slug = (h: string) => h.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

describe('EduVerse graph integrity', () => {
  it('has unique node and edge ids', () => {
    expect(new Set(graphNodes.map((n) => n.id)).size).toBe(graphNodes.length)
    expect(new Set(graphEdges.map((e) => e.id)).size).toBe(graphEdges.length)
  })

  it('has edges that connect existing nodes', () => {
    for (const e of graphEdges) {
      expect(nodeById(e.from), e.id).toBeDefined()
      expect(nodeById(e.to), e.id).toBeDefined()
    }
  })

  it('has traces that follow real edges, end to end', () => {
    for (const t of graphTraces) {
      expect(t.steps.length).toBeGreaterThan(0)
      let prevTo: string | null = null
      for (const s of t.steps) {
        const e = edgeById(s.edge)
        expect(e, `${t.id}:${s.edge}`).toBeDefined()
        if (prevTo && e) expect(e.from === prevTo || e.to === prevTo, `${t.id} is contiguous`).toBe(true)
        prevTo = e?.to ?? null
      }
    }
  })

  it('links every node to a real case-study section', () => {
    const sections = getProject('eduverse')!.sections.map((s) => slug(s.heading))
    for (const n of graphNodes) {
      expect(n.summary).not.toBe('')
      expect(sections, n.id).toContain(n.anchor)
    }
  })

  it('collects the nodes touched so far in a trace', () => {
    const t = graphTraces[0]
    expect(traceNodeIds(t, 0).sort()).toEqual(['api', 'client'])
    expect(traceNodeIds(t, 1).sort()).toEqual(['api', 'client', 'db'])
  })

  it('tracks edges that still need owner confirmation', () => {
    expect(graphEdges.filter((e) => !e.confirmed).map((e) => e.id)).toEqual(['queue-api'])
  })
})
