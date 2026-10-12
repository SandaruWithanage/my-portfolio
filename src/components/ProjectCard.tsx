import { Link } from 'react-router-dom'
import type { Project } from '../data/projects'

export function ProjectCard({ project }: { project: Project }) {
  return (
    <article className="card">
      <span className="badge">Status: {project.status}</span>
      <h3>
        <Link to={`/projects/${project.slug}`}>{project.title}</Link>
      </h3>
      <p className="muted">{project.summary}</p>
      <ul className="tags" aria-label={`${project.title} technologies`}>
        {project.stack.map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ul>
    </article>
  )
}
