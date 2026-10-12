// Hub destinations. Each maps to an existing route so direct URLs keep working.
// Only published, approved content is linked here (no résumé until it is reviewed).
export type Destination = {
  id: string
  code: string
  title: string
  summary: string
  to: string
}

export const destinations: Destination[] = [
  {
    id: 'workshop',
    code: 'SYS-01',
    title: 'Engineering Workshop',
    summary: 'EduVerse architecture explorer: modules, data flow and request traces.',
    to: '/engineering',
  },
  {
    id: 'projects',
    code: 'SYS-02',
    title: 'Projects & Systems',
    summary: 'Case studies with architecture, decisions and verification.',
    to: '/projects',
  },
  {
    id: 'background',
    code: 'SYS-03',
    title: 'Skills & Education',
    summary: 'Technical skills and academic background.',
    to: '/background',
  },
  {
    id: 'contact',
    code: 'SYS-04',
    title: 'Identity & Communications',
    summary: 'Email, GitHub and LinkedIn.',
    to: '/contact',
  },
]

/** Label for the HUD's "current destination" readout. */
export function destinationLabel(pathname: string): string {
  if (pathname.startsWith('/projects/')) return 'Projects & Systems / Case study'
  const d = destinations.find((x) => pathname === x.to)
  return d ? d.title : 'Unknown sector'
}
