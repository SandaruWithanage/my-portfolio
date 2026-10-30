import { lazy, Suspense } from 'react'

// Lab World is code-split: its UI and 3D engine never load for the plain pages.
const ExperienceRoot = lazy(() => import('../experience/ExperienceRoot').then((m) => ({ default: m.ExperienceRoot })))

export function LabRoute() {
  return (
    <Suspense fallback={<p className="visually-hidden">Loading the lab…</p>}>
      <ExperienceRoot />
    </Suspense>
  )
}
