// EduVerse system graph. Every node and edge is derived from the EduVerse résumé
// bullets; `confirmed: false` marks an edge that is a reasonable reading but has not
// been explicitly confirmed by the project owner.

export type NodeKind = 'client' | 'api' | 'database' | 'queue' | 'sync' | 'cms' | 'infra'

export type GraphNode = {
  id: string
  label: string
  kind: NodeKind
  summary: string
  /** id of the matching section in the EduVerse case study */
  anchor: string
  /** floor position of the 3D module (x, z) */
  pos: [number, number]
  /** position in the 2D diagram (viewBox 800 x 440) */
  diagram: [number, number]
}

export type GraphEdge = {
  id: string
  from: string
  to: string
  label: string
  confirmed: boolean
}

export type TraceStep = { edge: string; caption: string }
export type Trace = { id: string; title: string; steps: TraceStep[] }

export const graphNodes: GraphNode[] = [
  {
    id: 'client',
    label: 'Next.js client',
    kind: 'client',
    summary: 'Next.js frontend for the school application and the per-school public websites.',
    anchor: 'architecture',
    pos: [-6.5, -1.5],
    diagram: [100, 190],
  },
  {
    id: 'api',
    label: 'NestJS API',
    kind: 'api',
    summary: 'NestJS backend with permission-driven RBAC, OAuth2/JWT authentication and MFA.',
    anchor: 'architecture',
    pos: [1.8, -6.5],
    diagram: [380, 80],
  },
  {
    id: 'db',
    label: 'PostgreSQL + RLS',
    kind: 'database',
    summary:
      'PostgreSQL with Row-Level Security enforcing tenant data isolation, plus a least-privilege database role for the public read path.',
    anchor: 'engineering-decisions',
    pos: [5, -5],
    diagram: [660, 190],
  },
  {
    id: 'queue',
    label: 'Redis + BullMQ',
    kind: 'queue',
    summary: 'Redis-backed BullMQ queues used by the offline-first synchronization design.',
    anchor: 'engineering-decisions',
    pos: [-1.8, -6.5],
    diagram: [250, 330],
  },
  {
    id: 'sync',
    label: 'Offline sync',
    kind: 'sync',
    summary:
      'IndexedDB (Dexie.js) on the client with conflict-resolution strategies, so data capture continues in low-connectivity environments.',
    anchor: 'engineering-decisions',
    pos: [-5, -5],
    diagram: [100, 330],
  },
  {
    id: 'cms',
    label: 'School CMS',
    kind: 'cms',
    summary:
      'Multi-tenant school-website CMS on wildcard *.eduverse.site subdomains: draft, preview and publish versioning, sanitized structured content, Sinhala/English support.',
    anchor: 'engineering-decisions',
    pos: [6.5, -1.5],
    diagram: [420, 220],
  },
  {
    id: 'infra',
    label: 'Infrastructure',
    kind: 'infra',
    summary: 'Docker on a Contabo VPS, with a GitHub Actions CI/CD pipeline.',
    anchor: 'architecture',
    pos: [0, -10.5],
    diagram: [660, 340],
  },
]

export const graphEdges: GraphEdge[] = [
  { id: 'client-api', from: 'client', to: 'api', label: 'authenticated requests (JWT, RBAC)', confirmed: true },
  { id: 'api-db', from: 'api', to: 'db', label: 'tenant-scoped queries under RLS', confirmed: true },
  { id: 'client-sync', from: 'client', to: 'sync', label: 'offline writes to IndexedDB', confirmed: true },
  { id: 'sync-queue', from: 'sync', to: 'queue', label: 'queued changes', confirmed: true },
  { id: 'queue-api', from: 'queue', to: 'api', label: 'processed server-side', confirmed: false },
  { id: 'client-cms', from: 'client', to: 'cms', label: 'school-site requests by host', confirmed: true },
  { id: 'cms-db', from: 'cms', to: 'db', label: 'public reads via read-only role', confirmed: true },
]

export const graphTraces: Trace[] = [
  {
    id: 'tenant-request',
    title: 'Tenant-isolated request',
    steps: [
      { edge: 'client-api', caption: 'A signed-in user’s request reaches the NestJS API, where JWT authentication and RBAC permission checks apply.' },
      { edge: 'api-db', caption: 'Queries run against PostgreSQL under Row-Level Security, so only that tenant’s rows are visible.' },
    ],
  },
  {
    id: 'offline-sync',
    title: 'Offline sync',
    steps: [
      { edge: 'client-sync', caption: 'With poor connectivity, changes are captured locally in IndexedDB (Dexie.js).' },
      { edge: 'sync-queue', caption: 'Captured changes are queued for synchronization through BullMQ.' },
      { edge: 'queue-api', caption: 'Queued changes are processed server-side, with conflict-resolution strategies.' },
      { edge: 'api-db', caption: 'Accepted changes are written to PostgreSQL under Row-Level Security.' },
    ],
  },
  {
    id: 'public-site',
    title: 'Public school site',
    steps: [
      { edge: 'client-cms', caption: 'A visitor opens a school’s *.eduverse.site subdomain and the CMS resolves the school by host.' },
      { edge: 'cms-db', caption: 'Published content is read through a least-privilege database role, secured via Row-Level Security.' },
    ],
  },
]

export const nodeById = (id: string) => graphNodes.find((n) => n.id === id)
export const edgeById = (id: string) => graphEdges.find((e) => e.id === id)
export const traceById = (id: string) => graphTraces.find((t) => t.id === id)

/** Node ids touched by steps 0..step (inclusive) of a trace. */
export function traceNodeIds(trace: Trace, step: number): string[] {
  const ids = new Set<string>()
  for (const s of trace.steps.slice(0, step + 1)) {
    const e = edgeById(s.edge)
    if (e) {
      ids.add(e.from)
      ids.add(e.to)
    }
  }
  return [...ids]
}
