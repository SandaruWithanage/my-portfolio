import { useEffect, useRef } from 'react'
import { NavLink, Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { destinationLabel } from '../features/hub/destinations'
import { DURATION } from './motion/motion'
import { useReveal } from './motion/useReveal'
import { profile } from '../data/profile'

const links = [
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
  const navigate = useNavigate()
  // Back within the app when there is history; otherwise return to the lab.
  const goBack = () => {
    const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0
    if (idx > 0) navigate(-1)
    else navigate('/')
  }

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
      <header className="site-header hud-bar">
        <div className="container">
          <div className="hud-left">
            <Link to="/" className="brand hud-home">
              <span aria-hidden="true">◂ </span>Return to lab
            </Link>
            <button type="button" className="hud-back" onClick={goBack}>
              Back
            </button>
            <p className="hud-location">
              <span className="visually-hidden">Current destination: </span>
              {destinationLabel(pathname)}
            </p>
          </div>
          <nav className="nav" aria-label="Primary">
            {links.map((l) => (
              <NavLink key={l.to} to={l.to}>
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
