import { Link } from 'react-router-dom'
import { ProjectCard } from '../components/ProjectCard'
import { projects } from '../data/projects'
import { profile } from '../data/profile'
import { useDocumentTitle } from '../app/useDocumentTitle'

export function HomePage() {
  useDocumentTitle()
  return (
    <div className="container">
      <section className="hero" aria-labelledby="intro">
        <p className="eyebrow">{profile.role}</p>
        <h1 id="intro">{profile.name}</h1>
        <p className="lead">{profile.summary}</p>
        <div className="actions">
          <Link className="btn btn-primary" to="/projects">
            Explore my work
          </Link>
          <Link className="btn" to="/contact">
            Get in touch
          </Link>
        </div>
      </section>
      <section className="section" aria-labelledby="featured">
        <h2 id="featured">Featured projects</h2>
        <div className="grid">
          {projects.map((p) => (
            <ProjectCard key={p.slug} project={p} />
          ))}
        </div>
      </section>
    </div>
  )
}
