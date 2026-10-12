export type ProjectSection = {
  heading: string
  body: string[]
}

export type Project = {
  slug: string
  title: string
  summary: string
  period: string
  status: string
  role: string
  stack: string[]
  url?: string
  highlights: string[]
  sections: ProjectSection[]
}

// Only verified facts belong here. Do not add metrics without evidence.
export const projects: Project[] = [
  {
    slug: 'eduverse',
    title: 'EduVerse',
    summary:
      'Live multi-tenant SaaS for Sri Lankan schools with database-enforced tenant isolation and offline-first data capture.',
    period: 'September 2025 – Present',
    status: 'In production (Phase 1, first school)',
    role: 'Lead developer, architect and project owner (team project)',
    stack: ['NestJS', 'Next.js', 'PostgreSQL', 'Prisma', 'Redis', 'BullMQ', 'Docker'],
    url: 'https://eduverse.site',
    highlights: [
      'PostgreSQL Row-Level Security for tenant data isolation',
      'Offline-first sync with conflict resolution',
      'RBAC, OAuth2/JWT authentication with MFA',
      'School-website CMS with per-school subdomains',
    ],
    sections: [
      {
        heading: 'Problem and requirements',
        body: [
          'Schools need one platform that keeps each school’s data strictly separate, keeps working where connectivity is poor, and can publish a public school website in Sinhala and English.',
        ],
      },
      {
        heading: 'Architecture',
        body: [
          'A NestJS API and Next.js frontend on PostgreSQL, with Redis and BullMQ for background work. The stack is containerised with Docker and Phase 1 is deployed to a Contabo VPS.',
          'The data model represents the Ministry of Education’s multi-level administrative hierarchy, with permission-driven role-based access control. CI/CD runs on GitHub Actions.',
        ],
      },
      {
        heading: 'Engineering decisions',
        body: [
          'Tenant isolation is enforced in the database with PostgreSQL Row-Level Security, not only in application code.',
          'Offline-first sync uses IndexedDB (Dexie.js) on the client and BullMQ on the server, with conflict resolution so data capture continues in low-connectivity environments.',
          'The public school-website CMS runs on wildcard *.eduverse.site subdomains. Content is sanitised and moves through draft, preview and publish versions, and a least-privilege database role secures the public read path via RLS.',
        ],
      },
      {
        heading: 'Testing and reliability',
        body: [
          'Core modules (attendance, marks, academic years, and student promotion with audit logging and an approval-based exception workflow) are verified with live rehearsal tests (6 of 6 passing).',
          'Live tenant-isolation proofs and a Lighthouse and accessibility audit found and fixed systemic tenant-context and authorization bugs.',
        ],
      },
      {
        heading: 'Outcome',
        body: [
          'Phase 1 is deployed to production for its first school. Further phases are in progress.',
        ],
      },
    ],
  },
]

export function getProject(slug: string | undefined): Project | undefined {
  return projects.find((p) => p.slug === slug)
}
