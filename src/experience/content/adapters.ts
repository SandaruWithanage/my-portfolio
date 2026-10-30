import { graphNodes, graphTraces, type GraphNode, type Trace } from '../../data/eduverse-graph'
import { education, profile, skills } from '../../data/profile'
import { projects, type Project } from '../../data/projects'

/**
 * Adapters from the canonical portfolio data to what the lab displays. Nothing here
 * invents content: every exhibit maps to a real record, and empty fields stay empty.
 */

export type SkillCategory = 'languages' | 'backend' | 'frontend' | 'data' | 'devops' | 'testing' | 'other'

export type SkillExhibit = {
  id: string
  label: string
  category: SkillCategory
  items: string[]
  /** Projects whose verified stack uses at least one of these skills. */
  projectSlugs: string[]
  /** Short description of what the bench's prop represents. */
  metaphor: string
}

const CATEGORY: Record<string, SkillCategory> = {
  Languages: 'languages',
  Backend: 'backend',
  Frontend: 'frontend',
  Data: 'data',
  DevOps: 'devops',
  Testing: 'testing',
}

const METAPHOR: Record<SkillCategory, string> = {
  languages: 'Glyph stack — the languages everything else is written in.',
  backend: 'Routing nodes — requests flowing between services.',
  frontend: 'Layered panels — interfaces composed from components.',
  data: 'Storage columns — databases, caches and queues.',
  devops: 'Pipeline rollers — build, test and deploy.',
  testing: 'Test console — checks that keep the system honest.',
  other: 'Workbench.',
}

const norm = (s: string) => s.toLowerCase().replace(/\s*\(.*\)\s*/g, '').trim()

export function skillExhibits(groups = skills, list: Project[] = projects): SkillExhibit[] {
  return groups.map((g) => {
    const category = CATEGORY[g.group] ?? 'other'
    const wanted = new Set(g.items.map(norm))
    const projectSlugs = list.filter((p) => p.stack.some((t) => wanted.has(norm(t)))).map((p) => p.slug)
    return { id: `skill-${category}`, label: g.group, category, items: [...g.items], projectSlugs, metaphor: METAPHOR[category] }
  })
}

export type ProjectExhibit = {
  id: string
  slug: string
  title: string
  summary: string
  status: string
  period: string
  role: string
  technologies: string[]
  highlights: string[]
  externalUrl?: string
  caseStudyUrl: string
}

export function projectExhibits(list: Project[] = projects): ProjectExhibit[] {
  return list.map((p) => ({
    id: `project-${p.slug}`,
    slug: p.slug,
    title: p.title,
    summary: p.summary,
    status: p.status,
    period: p.period,
    role: p.role,
    technologies: [...p.stack],
    highlights: [...p.highlights],
    externalUrl: p.url,
    caseStudyUrl: `/projects/${p.slug}`,
  }))
}

/** Real, existing companion exhibits (no invented projects). */
export const companionExhibits = [
  {
    id: 'exhibit-explorer',
    title: 'EduVerse Architecture Explorer',
    summary: 'An interactive 3D map of EduVerse’s modules, data flow and request traces — part of this portfolio.',
    href: '/engineering',
    linkLabel: 'Open the explorer',
  },
  {
    id: 'exhibit-lab',
    title: 'This lab',
    summary:
      'Lab World itself: React + TypeScript shell, Three.js world, data-driven floor plan, circle-vs-box collision and opt-in Web Audio — built without extra runtime dependencies.',
    href: '/portfolio',
    linkLabel: 'View the plain portfolio',
  },
] as const

export type CoreLayer = { id: string; title: string; nodes: GraphNode[] }

/** EduVerse tiers, bottom to top, matching the core mesh (infra → data → services → clients). */
export function coreLayers(nodes: GraphNode[] = graphNodes): CoreLayer[] {
  const by = (kinds: GraphNode['kind'][]) => nodes.filter((n) => kinds.includes(n.kind))
  return [
    { id: 'layer-clients', title: 'Clients', nodes: by(['client']) },
    { id: 'layer-services', title: 'Services', nodes: by(['api', 'sync', 'cms']) },
    { id: 'layer-data', title: 'Data & queues', nodes: by(['database', 'queue']) },
    { id: 'layer-infra', title: 'Infrastructure', nodes: by(['infra']) },
  ].filter((l) => l.nodes.length > 0)
}

export const coreTraces = (): Trace[] => graphTraces

export const identity = {
  name: profile.name,
  role: profile.role,
  tagline: profile.tagline,
  summary: profile.summary,
  location: profile.location,
  education,
}

export type ContactLink = { id: string; label: string; href: string; external: boolean; display: string }

/** Only links that exist in the profile. No CV link is shown because none exists in the data. */
export function contactLinks(): ContactLink[] {
  const out: ContactLink[] = []
  if (profile.email) out.push({ id: 'email', label: 'Email', href: `mailto:${profile.email}`, external: false, display: profile.email })
  if (profile.github) out.push({ id: 'github', label: 'GitHub', href: profile.github, external: true, display: profile.github.replace('https://', '') })
  if (profile.linkedin) out.push({ id: 'linkedin', label: 'LinkedIn', href: profile.linkedin, external: true, display: profile.linkedin.replace('https://www.', '') })
  return out
}
