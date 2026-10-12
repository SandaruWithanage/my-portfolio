import { Link } from 'react-router-dom'
import { useDocumentTitle } from '../app/useDocumentTitle'

export function NotFoundPage() {
  useDocumentTitle('Page not found')
  return (
    <div className="container page">
      <p className="eyebrow">404</p>
      <h1>Page not found</h1>
      <p className="lead">That page doesn’t exist.</p>
      <Link className="btn" to="/">
        Back home
      </Link>
    </div>
  )
}
