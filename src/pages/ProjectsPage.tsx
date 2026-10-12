import { ProjectCard } from '../components/ProjectCard'
import { projects } from '../data/projects'
import { useDocumentTitle } from '../app/useDocumentTitle'

export function ProjectsPage() {
  useDocumentTitle('Projects')
  return (
    <div className="container page">
      <p className="eyebrow">Projects</p>
      <h1>Selected work</h1>
      <p className="lead">Case studies with architecture, decisions and verification.</p>
      <div className="grid section">
        {projects.map((p) => (
          <ProjectCard key={p.slug} project={p} />
        ))}
      </div>
    </div>
  )
}
