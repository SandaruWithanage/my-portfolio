import { createScope, createTimeline, stagger } from 'animejs'
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type PointerEvent } from 'react'
import { useDocumentTitle } from '../../app/useDocumentTitle'
import { usePrefersReducedMotion } from '../../components/motion/usePrefersReducedMotion'
import { profile } from '../../data/profile'
import { projects } from '../../data/projects'
import { readBooted, writeBooted } from './bootState'
import { BackgroundPage } from '../../pages/BackgroundPage'
import { ContactPage } from '../../pages/ContactPage'
import { EngineeringPage } from '../../pages/EngineeringPage'
import { ProjectsPage } from '../../pages/ProjectsPage'
import { destinations } from './destinations'
import { HubBackdrop } from './backdrop/HubBackdrop'
import { HoloDiagram } from './HoloDiagram'
import { HoloScreens } from './HoloScreens'
import { createLookSource } from './lookSource'
import { useScreenStack } from './useScreenStack'

type Phase = 'dormant' | 'booting' | 'online'

const DEST_IDS = destinations.map((d) => d.id)

// Each screen shows the same content as its standalone route.
function screenContent(id: string) {
  switch (id) {
    case 'workshop':
      return <EngineeringPage />
    case 'projects':
      return <ProjectsPage />
    case 'background':
      return <BackgroundPage />
    case 'contact':
      return <ContactPage />
    default:
      return null
  }
}

/**
 * Command-centre home. Starts dormant until the visitor initialises it; the boot
 * sequence is short, skippable, skipped under reduced motion, and not replayed within
 * a session. Once online, destinations are floating screens that open in place over
 * the lab (see HoloScreens); each still has its own route for direct links.
 */
export function HubPage() {
  useDocumentTitle()
  const reduced = usePrefersReducedMotion()
  const screens = useScreenStack(DEST_IDS)
  // A link straight to a screen skips the boot.
  const [phase, setPhase] = useState<Phase>(() => (readBooted() || screens.stack.length ? 'online' : 'dormant'))
  const tiles = useRef(new Map<string, HTMLElement>())
  const tileFor = useCallback((id: string) => tiles.current.get(id) ?? null, [])
  const closeScreen = (id: string) => {
    const wasLast = screens.stack.length === 1
    screens.close(id)
    if (wasLast) tiles.current.get(id)?.focus({ preventScroll: true })
  }

  const rootRef = useRef<HTMLDivElement>(null)
  const destRef = useRef<HTMLElement>(null)
  const focusDest = useRef(false)

  // Mouse look: one pointer reading drives both the tile tilt (CSS variables, no
  // re-render) and the 3D camera, so they move together.
  const [lookSource] = useState(createLookSource)
  useEffect(
    () =>
      lookSource.subscribe(({ x, y }) => {
        rootRef.current?.style.setProperty('--look-x', x.toFixed(3))
        rootRef.current?.style.setProperty('--look-y', y.toFixed(3))
      }),
    [lookSource],
  )
  const look = (e: PointerEvent<HTMLDivElement>) => {
    if (reduced || e.pointerType !== 'mouse') return
    lookSource.set({ x: e.clientX / window.innerWidth - 0.5, y: e.clientY / window.innerHeight - 0.5 })
  }
  // Left-column destinations turn the camera left, right-column ones right.
  const frontIndex = destinations.findIndex((d) => d.id === screens.front)
  const focusSide = frontIndex < 0 ? 0 : frontIndex % 2 === 0 ? -1 : 1

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
      // Identity settles first, then the destinations assemble around it. The identity's
      // inline styles are cleared afterwards so CSS (e.g. fading it behind an open
      // screen) stays in control.
      const identity = root.querySelector<HTMLElement>('.hub-identity')!
      createTimeline({
        onComplete: () => {
          identity.style.removeProperty('opacity')
          identity.style.removeProperty('transform')
        },
      })
        .add(identity, { opacity: [0.55, 1], scale: [0.97, 1], duration: 380, ease: 'outQuad' })
        .add(root.querySelectorAll('.holo-panel'), { opacity: [0, 1], translateY: [14, 0], duration: 420, delay: stagger(90), ease: 'outQuad' }, '-=200')
    })
    return () => scope.revert()
  }, [phase, reduced])

  return (
    <div
      className={`hub hub--${phase}${screens.stack.length ? ' hub--screen-open' : ''}`}
      ref={rootRef}
      onPointerMove={look}
    >
      <HubBackdrop
        online={phase !== 'dormant'}
        paused={screens.stack.length > 0}
        focus={focusSide}
        look={lookSource}
        reducedMotion={reduced}
      />
      <div className="hub-vignette" aria-hidden="true" />
      <a className="skip-link" href="#hub-main">
        Skip to content
      </a>
      <div className="hub-frame" aria-hidden="true">
        <span className="hub-corner hub-corner--tl" />
        <span className="hub-corner hub-corner--tr" />
        <span className="hub-corner hub-corner--bl" />
        <span className="hub-corner hub-corner--br" />
      </div>
      <header className="hub-top hud-bar">
        <span className="hud-bar-group">
          <span className={`hud-dot${phase === 'online' ? ' hud-dot--live' : ''}`} aria-hidden="true" />
          <span className="hub-status" role="status">
            Engineering lab / {phase === 'online' ? 'System online' : phase === 'booting' ? 'Initializing' : 'Standby'}
          </span>
        </span>
        <span className="hud-bar-group hud-bar-meta">
          EduVerse <span aria-hidden="true">·</span> {projects[0].status}
        </span>
      </header>

      <main id="hub-main" className="hub-main" tabIndex={-1}>
        <section className="hub-identity hud-panel" aria-labelledby="hub-name">
          <span className="hud-scanline" aria-hidden="true" />
          <p className="hud-badge">
            <span className="hud-dot" aria-hidden="true" />
            {phase === 'online' ? 'System online' : 'Engineer identification'}
          </p>
          <svg className="hud-emblem" viewBox="0 0 48 48" fill="none" stroke="var(--holo)" strokeWidth="1.8" aria-hidden="true">
            <polygon points="24,3 43,14 43,34 24,45 5,34 5,14" strokeWidth="2" />
            <polygon points="24,14 34,20 24,26 14,20" fill="rgba(56,225,255,0.2)" />
            <polygon points="14,20 24,26 24,36 14,30" fill="rgba(56,225,255,0.1)" />
            <polygon points="34,20 24,26 24,36 34,30" fill="rgba(56,225,255,0.15)" />
          </svg>
          <h1 id="hub-name">{profile.name}</h1>
          <p className="hub-role">{profile.role}</p>
          <p className="hub-statement">{profile.summary}</p>
          <p className="hud-ticks" aria-hidden="true">
            <span>Base: {profile.location}</span>
            <span>Node: {phase === 'online' ? 'active' : 'standby'}</span>
          </p>
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
            <ul className="holo-field">
              {destinations.map((d) => (
                <li key={d.id} className={`holo-panel holo-panel--${d.id}`}>
                  <button
                    type="button"
                    className="holo-link hud-panel"
                    aria-expanded={screens.stack.includes(d.id)}
                    onClick={() => screens.open(d.id)}
                    ref={(el) => {
                      if (el) tiles.current.set(d.id, el)
                      else tiles.current.delete(d.id)
                    }}
                  >
                    <span className="holo-head">
                      <span className="holo-code" aria-hidden="true">{d.code.slice(-2)}</span>
                      <span className="holo-title">{d.title}</span>
                    </span>
                    <span className="holo-summary">{d.summary}</span>
                    <span className="holo-foot">
                      <HoloDiagram id={d.id} />
                      <span className="holo-go" aria-hidden="true">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M9 5l7 7-7 7" />
                        </svg>
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </nav>
        )}
      </main>

      <footer className="hud-footer">
        <span>
          Interface <span aria-hidden="true">/</span> {phase === 'online' ? 'synchronised' : phase === 'booting' ? 'initialising' : 'standby'}
        </span>
        <span>
          © {new Date().getFullYear()} {profile.name}
        </span>
      </footer>

      {phase === 'online' && (
        <HoloScreens
          stack={screens.stack}
          destinations={destinations}
          reduced={reduced}
          content={screenContent}
          tileFor={tileFor}
          onRaise={screens.open}
          onClose={closeScreen}
        />
      )}
    </div>
  )
}
