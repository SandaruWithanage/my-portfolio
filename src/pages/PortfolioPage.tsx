import { Link } from 'react-router-dom'
import { useDocumentTitle } from '../app/useDocumentTitle'
import { education, profile, skills } from '../data/profile'
import { projects } from '../data/projects'

/**
 * The plain, accessible portfolio: everything the lab shows, as ordinary HTML. It is
 * the "View portfolio" destination and the automatic fallback when 3D is unavailable.
 */
export function PortfolioContent({ headingLevel = 1 }: { headingLevel?: 1 | 2 }) {
  const H = headingLevel === 1 ? 'h1' : 'h2'
  return (
    <>
      <p className="eyebrow">Portfolio</p>
      <H>{profile.name}</H>
      <p className="lead">
        {profile.role} · {profile.location}
      </p>
      <p>{profile.summary}</p>

      <section className="section" aria-labelledby="pf-projects">
        <h2 id="pf-projects">Projects</h2>
        <ul className="grid">
          {projects.map((p) => (
            <li className="card" key={p.slug}>
              <h3>
                <Link to={`/projects/${p.slug}`}>{p.title}</Link>
              </h3>
              <p className="muted">{p.status}</p>
              <p>{p.summary}</p>
              <p>
                <Link to={`/projects/${p.slug}`}>Read the case study</Link>
              </p>
            </li>
          ))}
          <li className="card">
            <h3>
              <Link to="/engineering">EduVerse architecture explorer</Link>
            </h3>
            <p>An interactive map of EduVerse’s modules, data flow and request traces.</p>
          </li>
        </ul>
      </section>

      <section className="section" aria-labelledby="pf-skills">
        <h2 id="pf-skills">Skills</h2>
        <ul className="grid">
          {skills.map((g) => (
            <li className="card" key={g.group}>
              <h3>{g.group}</h3>
              <p>{g.items.join(', ')}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="section" aria-labelledby="pf-edu">
        <h2 id="pf-edu">Education</h2>
        <ul>
          {education.map((e) => (
            <li key={e.title}>
              <strong>{e.title}</strong> — {e.place} ({e.period})
            </li>
          ))}
        </ul>
      </section>

      <section className="section" aria-labelledby="pf-contact">
        <h2 id="pf-contact">Contact</h2>
        <ul>
          <li>
            Email: <a href={`mailto:${profile.email}`}>{profile.email}</a>
          </li>
          <li>
            GitHub:{' '}
            <a href={profile.github} target="_blank" rel="noopener noreferrer">
              {profile.github.replace('https://', '')}
            </a>
          </li>
          <li>
            LinkedIn:{' '}
            <a href={profile.linkedin} target="_blank" rel="noopener noreferrer">
              {profile.linkedin.replace('https://www.', '')}
            </a>
          </li>
        </ul>
      </section>
    </>
  )
}

export function PortfolioPage() {
  useDocumentTitle('Portfolio')
  return (
    <div className="container page">
      <PortfolioContent />
      <p className="section">
        <Link to="/">Enter the interactive lab</Link>
      </p>
    </div>
  )
}
