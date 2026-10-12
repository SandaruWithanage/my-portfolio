import { useRef } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useReveal } from '../components/motion/useReveal'
import { getProject } from '../data/projects'
import { useDocumentTitle } from '../app/useDocumentTitle'
import { NotFoundPage } from './NotFoundPage'

const slugify = (h: string) =>
  h.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

export function ProjectDetailPage() {
  const { slug } = useParams()
  const project = getProject(slug)
  const articleRef = useRef<HTMLElement>(null)
  useReveal(articleRef, { selector: '[data-motion]', duration: 350, step: 60, deps: [slug] })
  useDocumentTitle(project?.title ?? 'Not found')
  if (!project) return <NotFoundPage />

  return (
    <article className="container page" ref={articleRef}>
      <Link className="back" to="/projects">
        ← All projects
      </Link>
      <h1>{project.title}</h1>
      <p className="lead">{project.summary}</p>
      <dl className="meta" data-motion>
        <div>
          <dt>Status</dt>
          <dd>{project.status}</dd>
        </div>
        <div>
          <dt>My role</dt>
          <dd>{project.role}</dd>
        </div>
        <div>
          <dt>Period</dt>
          <dd>{project.period}</dd>
        </div>
        {project.url && (
          <div>
            <dt>Live site</dt>
            <dd>
              <a href={project.url} target="_blank" rel="noopener noreferrer">
                {project.url.replace('https://', '')}
              </a>
            </dd>
          </div>
        )}
      </dl>
      <ul className="tags" aria-label="Technologies" data-motion>
        {project.stack.map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ul>
      {project.sections.map((s, i) => (
        <section key={s.heading} id={slugify(s.heading)} className="case-section" data-motion aria-labelledby={`s${i}`}>
          <span className="num">{String(i + 1).padStart(2, '0')}</span>
          <h2 id={`s${i}`}>{s.heading}</h2>
          {s.body.map((para) => (
            <p key={para}>{para}</p>
          ))}
        </section>
      ))}
    </article>
  )
}
