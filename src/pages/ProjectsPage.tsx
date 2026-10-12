import { useRef } from 'react'
import { useReveal } from '../components/motion/useReveal'
import { ProjectCard } from '../components/ProjectCard'
import { projects } from '../data/projects'
import { useDocumentTitle } from '../app/useDocumentTitle'

export function ProjectsPage() {
  useDocumentTitle('Projects')
  const gridRef = useRef<HTMLDivElement>(null)
  useReveal(gridRef, { selector: '[data-motion]', duration: 350 })
  return (
    <div className="container page">
      <p className="eyebrow">Projects</p>
      <h1>Selected work</h1>
      <p className="lead">Case studies with architecture, decisions and verification.</p>
      <div className="grid section" ref={gridRef}>
        {projects.map((p) => (
          <ProjectCard key={p.slug} project={p} />
        ))}
      </div>
    </div>
  )
}
