import { useEffect, useRef } from 'react'
import { NavLink, Link, Outlet, useLocation } from 'react-router-dom'
import { DURATION } from './motion/motion'
import { useReveal } from './motion/useReveal'
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
  const { pathname, hash } = useLocation()
  const mainRef = useRef<HTMLElement>(null)
  const firstRender = useRef(true)

  // Subtle, non-blocking fade on route change (content is already rendered and usable).
  useReveal(mainRef, { duration: DURATION.route, from: 0.4, y: 0, deps: [pathname] })

  // Move focus and scroll on navigation. A #hash scrolls to its section (also on a
  // direct load); otherwise skip the initial load and reset to the top.
  useEffect(() => {
    const initial = firstRender.current
    firstRender.current = false
    const target = hash ? document.getElementById(decodeURIComponent(hash.slice(1))) : null
    if (target) {
      target.scrollIntoView()
      return
    }
    if (initial) return
    mainRef.current?.focus({ preventScroll: true })
    window.scrollTo(0, 0)
  }, [pathname, hash])

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
      <main id="main" tabIndex={-1} ref={mainRef}>
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
