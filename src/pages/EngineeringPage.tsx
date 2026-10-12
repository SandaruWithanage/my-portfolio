import { Link } from 'react-router-dom'
import { projects } from '../data/projects'
import { useDocumentTitle } from '../app/useDocumentTitle'
import { LabSection } from '../features/engineering-lab/LabSection'

export function EngineeringPage() {
  useDocumentTitle('Engineering')
  const eduverse = projects[0]
  return (
    <div className="container page">
      <p className="eyebrow">Engineering Workshop</p>
      <h1>How I approach systems</h1>
      <p className="lead">
        Short notes on design decisions, drawn from real project work. Longer write-ups will be added as they are ready.
      </p>
      <LabSection />
      <h2 className="section">Design notes</h2>
      <div className="grid">
        {eduverse.highlights.map((h) => (
          <div className="card" key={h}>
            <p>{h}</p>
            <Link to={`/projects/${eduverse.slug}`}>See it in {eduverse.title}</Link>
          </div>
        ))}
      </div>
    </div>
  )
}
