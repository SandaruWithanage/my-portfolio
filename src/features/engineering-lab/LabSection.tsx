import { lazy, Suspense, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { DURATION } from '../../components/motion/motion'
import { usePrefersReducedMotion } from '../../components/motion/usePrefersReducedMotion'
import { useReveal } from '../../components/motion/useReveal'
import { projects } from '../../data/projects'
import { LabFallback } from './fallback/LabFallback'
import { isWebGLAvailable, useInViewOnce } from './support'

const LabCanvas = lazy(() => import('./LabCanvas'))

const labProjects = projects.map((p) => ({ id: p.slug, label: p.title }))

export function LabSection() {
  const [stage, setStage] = useState<HTMLDivElement | null>(null)
  const inView = useInViewOnce(stage)
  const reducedMotion = usePrefersReducedMotion()
  const [webgl] = useState(isWebGLAvailable)
  const [force2d, setForce2d] = useState(false)
  const [failure, setFailure] = useState<'context-lost' | 'load-failed' | null>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [focusedId, setFocusedId] = useState<string | null>(null)

  const selected = projects.find((p) => p.slug === selectedId)
  const show3d = webgl && !force2d && !failure
  const fallbackReason = !webgl
    ? 'WebGL is not available in this browser, so the 3D lab is replaced with this 2D view.'
    : failure === 'context-lost'
      ? 'The graphics context was lost, so the 3D lab was switched off.'
      : failure === 'load-failed'
        ? 'The 3D lab failed to load, so this 2D view is shown instead.'
        : 'You chose the 2D view.'

  // Panel content transitions in on every selection change; a new change reverts the
  // previous run first, so rapid toggling always settles on fully visible content.
  useReveal(panelRef, {
    selector: '[data-motion]',
    duration: DURATION.panel,
    step: 50,
    y: 8,
    deps: [selectedId],
  })

  return (
    <section className="section lab" aria-labelledby="lab-title">
      <div className="lab-head">
        <div>
          <p className="eyebrow">Engineering lab</p>
          <h2 id="lab-title">Explore the systems I build</h2>
        </div>
        {webgl && !failure && (
          <button type="button" className="btn" onClick={() => setForce2d((v) => !v)}>
            {force2d ? 'Switch to 3D view' : 'Switch to 2D view'}
          </button>
        )}
      </div>

      <div className="lab-stage" ref={setStage}>
        {show3d ? (
          inView && (
            <Suspense fallback={<p className="lab-loading" role="status">Loading 3D lab…</p>}>
              <LabCanvas
                projects={labProjects}
                selectedId={selectedId}
                highlightedId={focusedId ?? hoveredId}
                reducedMotion={reducedMotion}
                onSelect={setSelectedId}
                onHover={setHoveredId}
                onUnavailable={setFailure}
              />
            </Suspense>
          )
        ) : (
          <LabFallback reason={fallbackReason} />
        )}
        {show3d && hoveredId && (
          <span className="lab-tip" aria-hidden="true">
            {projects.find((p) => p.slug === hoveredId)?.title}
          </span>
        )}
      </div>

      <ul className="lab-select" aria-label="Project modules">
        {projects.map((p) => (
          <li key={p.slug}>
            <button
              type="button"
              aria-pressed={p.slug === selectedId}
              onClick={() => setSelectedId((cur) => (cur === p.slug ? null : p.slug))}
              onFocus={() => setFocusedId(p.slug)}
              onBlur={() => setFocusedId(null)}
              onMouseEnter={() => setHoveredId(p.slug)}
              onMouseLeave={() => setHoveredId(null)}
            >
              <span className="lab-select-title">{p.title}</span>
              <span className="muted">{p.summary}</span>
            </button>
          </li>
        ))}
      </ul>

      <div className="lab-panel" aria-live="polite" ref={panelRef}>
        {selected ? (
          <>
            <p className="badge" data-motion>Selected · {selected.status}</p>
            <h3 data-motion>{selected.title}</h3>
            <ul data-motion>
              {selected.highlights.map((h) => (
                <li key={h}>{h}</li>
              ))}
            </ul>
            <Link data-motion className="btn btn-primary" to={`/projects/${selected.slug}`}>
              Read the {selected.title} case study
            </Link>
          </>
        ) : (
          <p className="muted" data-motion>Select a module to see its engineering summary.</p>
        )}
      </div>
    </section>
  )
}
