import { createScope, createTimeline, stagger } from 'animejs'
import { useLayoutEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useDocumentTitle } from '../../app/useDocumentTitle'
import { usePrefersReducedMotion } from '../../components/motion/usePrefersReducedMotion'
import { profile } from '../../data/profile'
import { readBooted, writeBooted } from './bootState'
import { destinations } from './destinations'

type Phase = 'dormant' | 'booting' | 'online'

/**
 * Command-centre home. Starts dormant until the visitor initialises it; the boot
 * sequence is short, skippable, skipped under reduced motion, and not replayed within
 * a session. Destinations are ordinary links to existing routes.
 */
export function HubPage() {
  useDocumentTitle()
  const reduced = usePrefersReducedMotion()
  const [phase, setPhase] = useState<Phase>(() => (readBooted() ? 'online' : 'dormant'))
  const rootRef = useRef<HTMLDivElement>(null)
  const destRef = useRef<HTMLElement>(null)
  const focusDest = useRef(false)

  const goOnline = () => {
    writeBooted()
    focusDest.current = true
    setPhase('online')
  }
  const initialise = () => (reduced ? goOnline() : setPhase('booting'))

  // Boot timeline (Anime.js owns these DOM nodes only while booting).
  useLayoutEffect(() => {
    const root = rootRef.current
    if (phase !== 'booting' || !root) return
    const scope = createScope({ root }).add(() => {
      createTimeline({ onComplete: () => goOnline() })
        .add(root.querySelectorAll('.boot-line'), { opacity: [0, 1], translateX: [-8, 0], duration: 220, delay: stagger(160) })
        .add(root.querySelector('.boot-bar-fill')!, { scaleX: [0, 1], duration: 600, ease: 'inOutQuad' }, '-=300')
    })
    return () => scope.revert()
    // goOnline is stable in effect (only sets state / storage)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase])

  // Panels assemble when the hub comes online; focus moves to the destinations.
  useLayoutEffect(() => {
    const root = rootRef.current
    if (phase !== 'online' || !root) return
    if (focusDest.current) {
      focusDest.current = false
      destRef.current?.focus({ preventScroll: true })
    }
    if (reduced) return
    const scope = createScope({ root }).add(() => {
      createTimeline()
        .add(root.querySelectorAll('.holo-panel'), { opacity: [0, 1], translateY: [14, 0], duration: 420, delay: stagger(90), ease: 'outQuad' })
    })
    return () => scope.revert()
  }, [phase, reduced])

  return (
    <div className={`hub hub--${phase}`} ref={rootRef}>
      <a className="skip-link" href="#hub-main">
        Skip to content
      </a>
      <div className="hub-frame" aria-hidden="true">
        <span className="hub-corner hub-corner--tl" />
        <span className="hub-corner hub-corner--tr" />
        <span className="hub-corner hub-corner--bl" />
        <span className="hub-corner hub-corner--br" />
      </div>
      <header className="hub-top">
        <span className="hub-status" role="status">
          Engineering lab / {phase === 'online' ? 'System online' : phase === 'booting' ? 'Initializing' : 'Standby'}
        </span>
      </header>

      <main id="hub-main" className="hub-main" tabIndex={-1}>
        <section className="hub-identity" aria-labelledby="hub-name">
          <p className="eyebrow">Engineer identification</p>
          <h1 id="hub-name">{profile.name}</h1>
          <p className="hub-role">{profile.role}</p>
          <p className="hub-statement">{profile.summary}</p>
        </section>

        {phase === 'dormant' && (
          <div className="hub-controls">
            <button type="button" className="btn btn-primary hub-init" onClick={initialise}>
              Initialize lab
            </button>
            <button type="button" className="btn" onClick={goOnline}>
              Skip intro
            </button>
          </div>
        )}

        {phase === 'booting' && (
          <div className="hub-boot">
            <ol className="hub-boot-log" aria-hidden="true">
              <li className="boot-line">Powering workstations</li>
              <li className="boot-line">Linking project archive</li>
              <li className="boot-line">Calibrating holographic displays</li>
            </ol>
            <div className="boot-bar" aria-hidden="true">
              <span className="boot-bar-fill" />
            </div>
            <button type="button" className="btn" onClick={goOnline}>
              Skip
            </button>
          </div>
        )}

        {phase === 'online' && (
          <nav
            className="hub-destinations"
            aria-labelledby="hub-dest-title"
            ref={destRef}
            tabIndex={-1}
          >
            <h2 id="hub-dest-title" className="eyebrow">
              Navigate systems
            </h2>
            <ul>
              {destinations.map((d) => (
                <li key={d.id} className={`holo-panel holo-panel--${d.id}`}>
                  <Link to={d.to} className="holo-link">
                    <span className="holo-code" aria-hidden="true">{d.code}</span>
                    <span className="holo-title">{d.title}</span>
                    <span className="holo-summary">{d.summary}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        )}
      </main>
    </div>
  )
}
