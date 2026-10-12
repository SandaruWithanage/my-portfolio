import { NavLink, Link, Outlet } from 'react-router-dom'
import { profile } from '../data/profile'

const links = [
  { to: '/', label: 'Home', end: true },
  { to: '/projects', label: 'Projects' },
  { to: '/engineering', label: 'Engineering' },
  { to: '/background', label: 'Background' },
  { to: '/contact', label: 'Contact' },
]

const year = new Date().getFullYear()

export function Layout() {
  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className="site-header">
        <div className="container">
          <Link to="/" className="brand">
            SANDARU.DEV
          </Link>
          <nav className="nav" aria-label="Primary">
            {links.map((l) => (
              <NavLink key={l.to} to={l.to} end={l.end}>
                {l.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>
      <main id="main" tabIndex={-1}>
        <Outlet />
      </main>
      <footer className="site-footer">
        <div className="container">
          <span>
            © {year} {profile.name}
          </span>
          <span>
            <a href={profile.github}>GitHub</a> ·{' '}
            <a href={profile.linkedin}>LinkedIn</a> ·{' '}
            <a href={`mailto:${profile.email}`}>Email</a>
          </span>
        </div>
      </footer>
    </>
  )
}
