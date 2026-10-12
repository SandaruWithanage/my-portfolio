import { useRef } from 'react'
import { Link } from 'react-router-dom'
import { useReveal } from '../components/motion/useReveal'
import { ProjectCard } from '../components/ProjectCard'
import { projects } from '../data/projects'
import { profile } from '../data/profile'
import { useDocumentTitle } from '../app/useDocumentTitle'
import { LabSection } from '../features/engineering-lab/LabSection'

export function HomePage() {
  useDocumentTitle()
  const heroRef = useRef<HTMLElement>(null)
  const gridRef = useRef<HTMLDivElement>(null)
  // The <h1> is deliberately not animated, so the headline paints immediately (LCP).
  useReveal(heroRef, { selector: '[data-motion]' })
  useReveal(gridRef, { selector: '[data-motion]', duration: 350 })
  return (
    <div className="container">
      <section className="hero" aria-labelledby="intro" ref={heroRef}>
        <p className="eyebrow" data-motion>{profile.role}</p>
        <h1 id="intro">{profile.name}</h1>
        <p className="lead" data-motion>{profile.summary}</p>
        <div className="actions" data-motion>
          <Link className="btn btn-primary" to="/projects">
            Explore my work
          </Link>
          <Link className="btn" to="/contact">
            Get in touch
          </Link>
        </div>
      </section>
      <LabSection />
      <section className="section" aria-labelledby="featured">
        <h2 id="featured">Featured projects</h2>
        <div className="grid" ref={gridRef}>
          {projects.map((p) => (
            <ProjectCard key={p.slug} project={p} />
          ))}
        </div>
      </section>
    </div>
  )
}
