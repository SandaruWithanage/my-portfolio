import { profile } from '../data/profile'
import { useDocumentTitle } from '../app/useDocumentTitle'

export function ContactPage() {
  useDocumentTitle('Contact')
  return (
    <div className="container page">
      <p className="eyebrow">Contact</p>
      <h1>Let’s work together</h1>
      <p className="lead">Email is the fastest way to reach me.</p>
      <ul className="section">
        <li>
          Email: <a href={`mailto:${profile.email}`}>{profile.email}</a>
        </li>
        <li>
          GitHub: <a href={profile.github}>github.com/SandaruWithanage</a>
        </li>
        <li>
          LinkedIn: <a href={profile.linkedin}>linkedin.com/in/sandarux</a>
        </li>
        <li>
          EduVerse: <a href={profile.site}>eduverse.site</a>
        </li>
      </ul>
    </div>
  )
}
