import { education, skills } from '../data/profile'
import { useDocumentTitle } from '../app/useDocumentTitle'

export function BackgroundPage() {
  useDocumentTitle('Background')
  return (
    <div className="container page">
      <p className="eyebrow">Background</p>
      <h1>Skills and education</h1>
      <section className="section" aria-labelledby="skills">
        <h2 id="skills">Technical skills</h2>
        <div className="grid">
          {skills.map((g) => (
            <div className="card" key={g.group}>
              <h3>{g.group}</h3>
              <ul className="tags">
                {g.items.map((i) => (
                  <li key={i}>{i}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>
      <section className="section" aria-labelledby="edu">
        <h2 id="edu">Education</h2>
        {education.map((e) => (
          <div className="card" key={e.title} style={{ marginBottom: '1rem' }}>
            <h3>{e.title}</h3>
            <p className="muted">
              {e.place} · {e.period}
            </p>
          </div>
        ))}
      </section>
    </div>
  )
}
