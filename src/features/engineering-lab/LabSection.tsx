import { lazy, Suspense, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { DURATION } from '../../components/motion/motion'
import { usePrefersReducedMotion } from '../../components/motion/usePrefersReducedMotion'
import { useReveal } from '../../components/motion/useReveal'
import { graphNodes, nodeById } from '../../data/eduverse-graph'
import { LabFallback } from './fallback/LabFallback'
import { isWebGLAvailable, useInViewOnce } from './support'

const LabCanvas = lazy(() => import('./LabCanvas'))

const labNodes = graphNodes.map((n) => ({ id: n.id, label: n.label, kind: n.kind, pos: n.pos }))
const NO_NODES: string[] = []

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

  const selected = selectedId ? nodeById(selectedId) : undefined
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
          <h2 id="lab-title">Explore EduVerse’s architecture</h2>
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
                nodes={labNodes}
                selectedId={selectedId}
                highlightedId={focusedId ?? hoveredId}
                activeNodeIds={NO_NODES}
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
            {nodeById(hoveredId)?.label}
          </span>
        )}
      </div>

      <ul className="lab-select" aria-label="EduVerse system modules">
        {graphNodes.map((n) => (
          <li key={n.id}>
            <button
              type="button"
              aria-pressed={n.id === selectedId}
              onClick={() => setSelectedId((cur) => (cur === n.id ? null : n.id))}
              onFocus={() => setFocusedId(n.id)}
              onBlur={() => setFocusedId(null)}
              onMouseEnter={() => setHoveredId(n.id)}
              onMouseLeave={() => setHoveredId(null)}
            >
              <span className="lab-select-title">{n.label}</span>
            </button>
          </li>
        ))}
      </ul>

      <div className="lab-panel" aria-live="polite" ref={panelRef}>
        {selected ? (
          <>
            <p className="badge" data-motion>Selected module</p>
            <h3 data-motion>{selected.label}</h3>
            <p data-motion>{selected.summary}</p>
            <Link
              data-motion
              className="btn btn-primary"
              to={`/projects/eduverse#${selected.anchor}`}
            >
              See this in the EduVerse case study
            </Link>
          </>
        ) : (
          <p className="muted" data-motion>Select a module to see how it fits into EduVerse.</p>
        )}
      </div>
    </section>
  )
}
