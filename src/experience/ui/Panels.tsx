import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { Link } from 'react-router-dom'
import { traceNodeIds, type GraphNode } from '../../data/eduverse-graph'
import type { SoundManager } from '../audio/SoundManager'
import { STEPS, TRACKS, toggleStep, starterPattern, emptyPattern } from '../audio/music'
import {
  companionExhibits,
  contactLinks,
  coreLayers,
  coreTraces,
  identity,
  projectExhibits,
  skillExhibits,
} from '../content/adapters'
import type { Interactable } from '../content/interactables'
import { DESTINATIONS, ROOMS, type RoomId } from '../world/layout'

/** Height of each EduVerse node kind on the core (matches the core tiers). */
const KIND_HEIGHT: Record<GraphNode['kind'], number> = { client: 1.85, api: 1.35, sync: 1.35, cms: 1.35, database: 0.85, queue: 0.85, infra: 0.45 }

export type PanelActions = {
  close: () => void
  teleport: (room: RoomId) => void
  startTour: () => void
  enableSound: () => void
  pluck: (i: number) => void
  pad: (i: number) => void
  setTrace: (height: number | null) => void
  setLayerFocus: (i: number | null) => void
}

function useSound(sound: SoundManager) {
  return useSyncExternalStore(
    (cb) => sound.subscribe(cb),
    () => `${sound.enabled}|${sound.playing}|${sound.playhead}|${sound.bpm}|${JSON.stringify(sound.pattern)}`,
  )
}

function SoundGate({ sound, actions }: { sound: SoundManager; actions: PanelActions }) {
  useSound(sound)
  if (sound.enabled) return <p className="lw-note">Sound is on. Mute any time from the top bar.</p>
  return (
    <p className="lw-note">
      Sound is off. <button type="button" className="lw-btn lw-btn--small" onClick={actions.enableSound}>Enable sound</button>{' '}
      <span className="lw-muted">(You can still play — the lights respond either way.)</span>
    </p>
  )
}

export function InspectPanel({ item, sound, actions }: { item: Interactable; sound: SoundManager; actions: PanelActions }) {
  const headingRef = useRef<HTMLHeadingElement>(null)
  useEffect(() => headingRef.current?.focus(), [item.id])
  const titleId = `lw-panel-${item.id}`

  return (
    <section className="lw-panel" role="dialog" aria-modal="false" aria-labelledby={titleId}>
      <header className="lw-panel-head">
        <p className="lw-kicker">{ROOMS[item.room].name}</p>
        <h2 id={titleId} ref={headingRef} tabIndex={-1}>
          {item.label}
        </h2>
        <button type="button" className="lw-icon-btn" onClick={actions.close} aria-label="Close panel">
          ✕
        </button>
      </header>
      <div className="lw-panel-body">
        <PanelBody item={item} sound={sound} actions={actions} />
      </div>
    </section>
  )
}

function PanelBody({ item, sound, actions }: { item: Interactable; sound: SoundManager; actions: PanelActions }) {
  switch (item.kind) {
    case 'directory':
      return (
        <>
          <p className="lw-lead">
            {identity.name} · {identity.role}
          </p>
          <p>{identity.summary}</p>
          <h3>Rooms</h3>
          <ul className="lw-room-list">
            {DESTINATIONS.filter((r) => r !== 'atrium').map((r) => (
              <li key={r}>
                <button type="button" className="lw-btn lw-btn--ghost" onClick={() => actions.teleport(r)}>
                  {ROOMS[r].name}
                </button>
                <span className="lw-muted"> — {ROOMS[r].purpose}</span>
              </li>
            ))}
          </ul>
          <p className="lw-actions">
            <button type="button" className="lw-btn" onClick={actions.startTour}>
              Take the guided tour
            </button>
            <Link className="lw-btn lw-btn--ghost" to="/portfolio">
              View portfolio (2D)
            </Link>
          </p>
        </>
      )
    case 'featured':
    case 'project': {
      const p = projectExhibits().find((x) => x.slug === item.ref)
      if (!p) return <p>Project details unavailable.</p>
      return (
        <>
          <p className="lw-lead">{p.summary}</p>
          <dl className="lw-facts">
            <dt>Status</dt>
            <dd>{p.status}</dd>
            <dt>Period</dt>
            <dd>{p.period}</dd>
            <dt>Role</dt>
            <dd>{p.role}</dd>
          </dl>
          <h3>Highlights</h3>
          <ul>
            {p.highlights.map((h) => (
              <li key={h}>{h}</li>
            ))}
          </ul>
          <h3>Stack</h3>
          <ul className="lw-tags">
            {p.technologies.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
          <p className="lw-actions">
            <Link className="lw-btn" to={p.caseStudyUrl}>
              Read the full case study
            </Link>
            <button type="button" className="lw-btn lw-btn--ghost" onClick={() => actions.teleport('core')}>
              See its architecture
            </button>
            {p.externalUrl && (
              <a className="lw-btn lw-btn--ghost" href={p.externalUrl} target="_blank" rel="noopener noreferrer">
                Visit live site ↗
              </a>
            )}
          </p>
        </>
      )
    }
    case 'companion': {
      const c = companionExhibits.find((x) => x.id === item.ref)
      if (!c) return null
      return (
        <>
          <p className="lw-lead">{c.summary}</p>
          <p className="lw-actions">
            <Link className="lw-btn" to={c.href}>
              {c.linkLabel}
            </Link>
          </p>
        </>
      )
    }
    case 'skill': {
      const s = skillExhibits().find((x) => x.category === item.ref)
      if (!s) return null
      const projects = projectExhibits().filter((p) => s.projectSlugs.includes(p.slug))
      return (
        <>
          <p className="lw-muted">{s.metaphor}</p>
          <ul className="lw-tags">
            {s.items.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
          <h3>Used in</h3>
          {projects.length ? (
            <ul>
              {projects.map((p) => (
                <li key={p.slug}>
                  <Link to={p.caseStudyUrl}>{p.title}</Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="lw-muted">No published case study lists these in its stack yet.</p>
          )}
        </>
      )
    }
    case 'core-layer':
      return <LayerBody item={item} actions={actions} />
    case 'core-trace':
      return <TraceBody actions={actions} />
    case 'harp':
      return (
        <>
          <p>Walk through the beams to play, or use these keys (1–7).</p>
          <SoundGate sound={sound} actions={actions} />
          <div className="lw-keys" role="group" aria-label="Laser harp strings">
            {Array.from({ length: 7 }, (_, i) => (
              <button key={i} type="button" className="lw-key" onClick={() => actions.pluck(i)} aria-label={`String ${i + 1}`}>
                {i + 1}
              </button>
            ))}
          </div>
        </>
      )
    case 'pads':
      return (
        <>
          <p>Step on a pad to strike it, or tap them here.</p>
          <SoundGate sound={sound} actions={actions} />
          <div className="lw-pads" role="group" aria-label="Drum pads">
            {['Kick', 'Snare', 'Hat', 'Kick 2'].map((n, i) => (
              <button key={n} type="button" className={`lw-pad lw-pad--${i}`} onClick={() => actions.pad(i)}>
                {n}
              </button>
            ))}
          </div>
        </>
      )
    case 'sequencer':
      return <SequencerBody sound={sound} actions={actions} />
    case 'comms':
      return (
        <>
          <p className="lw-lead">Thanks for visiting the lab. The fastest way to reach me is email.</p>
          <ul className="lw-links">
            {contactLinks().map((l) => (
              <li key={l.id}>
                <a href={l.href} {...(l.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
                  {l.label}: {l.display}
                </a>
              </li>
            ))}
          </ul>
          <p className="lw-actions">
            <button type="button" className="lw-btn lw-btn--ghost" onClick={() => actions.teleport('atrium')}>
              Back to the atrium
            </button>
            <Link className="lw-btn lw-btn--ghost" to="/portfolio">
              View portfolio (2D)
            </Link>
          </p>
        </>
      )
  }
}

function LayerBody({ item, actions }: { item: Interactable; actions: PanelActions }) {
  const layers = coreLayers()
  const index = layers.findIndex((l) => l.id === item.ref)
  const layer = layers[index]
  useEffect(() => {
    actions.setLayerFocus(index)
    return () => actions.setLayerFocus(null)
  }, [index, actions])
  if (!layer) return null
  return (
    <>
      <p className="lw-muted">The highlighted ring on the core is this layer.</p>
      <ul className="lw-nodes">
        {layer.nodes.map((n) => (
          <li key={n.id}>
            <strong>{n.label}</strong> — {n.summary}{' '}
            <Link to={`/projects/eduverse#${n.anchor}`}>case study section</Link>
          </li>
        ))}
      </ul>
    </>
  )
}

function TraceBody({ actions }: { actions: PanelActions }) {
  const traces = coreTraces()
  const [traceId, setTraceId] = useState(traces[0]?.id ?? '')
  const [stepIdx, setStepIdx] = useState(0)
  const [playing, setPlaying] = useState(false)
  const trace = traces.find((t) => t.id === traceId)
  const steps = trace?.steps ?? []
  useEffect(() => {
    if (!trace) return
    const ids = traceNodeIds(trace, stepIdx)
    const nodes = coreLayers().flatMap((l) => l.nodes)
    const last = nodes.find((n) => n.id === ids[ids.length - 1])
    actions.setTrace(last ? KIND_HEIGHT[last.kind] : null)
  }, [trace, stepIdx, actions])
  useEffect(() => () => actions.setTrace(null), [actions])
  useEffect(() => {
    if (!playing) return
    const id = window.setInterval(() => setStepIdx((i) => (i + 1 < steps.length ? i + 1 : (setPlaying(false), i))), 1800)
    return () => window.clearInterval(id)
  }, [playing, steps.length])
  return (
    <>
      <label className="lw-field">
        Trace{' '}
        <select
          value={traceId}
          onChange={(e) => {
            setTraceId(e.target.value)
            setStepIdx(0)
          }}
        >
          {traces.map((t) => (
            <option key={t.id} value={t.id}>
              {t.title}
            </option>
          ))}
        </select>
      </label>
      <ol className="lw-steps">
        {steps.map((s, i) => (
          <li key={s.edge} aria-current={i === stepIdx ? 'step' : undefined} className={i === stepIdx ? 'is-current' : ''}>
            {s.caption}
          </li>
        ))}
      </ol>
      <p className="lw-actions" aria-live="polite">
        <button type="button" className="lw-btn" onClick={() => setPlaying((p) => !p)}>
          {playing ? 'Pause' : 'Play trace'}
        </button>
        <button type="button" className="lw-btn lw-btn--ghost" onClick={() => setStepIdx((i) => Math.max(0, i - 1))}>
          ◂ Step
        </button>
        <button type="button" className="lw-btn lw-btn--ghost" onClick={() => setStepIdx((i) => Math.min(steps.length - 1, i + 1))}>
          Step ▸
        </button>
        <span className="lw-muted">
          Step {stepIdx + 1} of {steps.length} — an animation of the documented flow, not a live request.
        </span>
      </p>
    </>
  )
}

function SequencerBody({ sound, actions }: { sound: SoundManager; actions: PanelActions }) {
  useSound(sound)
  return (
    <>
      <p>Toggle steps to build a loop; the wall in the room lights up with your pattern.</p>
      <SoundGate sound={sound} actions={actions} />
      <div className="lw-seq" role="grid" aria-label="Step sequencer">
        {TRACKS.map((tr) => (
          <div className="lw-seq-row" role="row" key={tr}>
            <span className="lw-seq-label" role="rowheader">
              {tr}
            </span>
            {Array.from({ length: STEPS }, (_, c) => (
              <button
                key={c}
                type="button"
                role="gridcell"
                aria-label={`${tr} step ${c + 1}`}
                aria-pressed={sound.pattern[tr][c]}
                className={`lw-cell${sound.pattern[tr][c] ? ' is-on' : ''}${sound.playing && sound.playhead === c ? ' is-head' : ''}`}
                onClick={() => sound.setPattern(toggleStep(sound.pattern, tr, c))}
              />
            ))}
          </div>
        ))}
      </div>
      <p className="lw-actions">
        <button type="button" className="lw-btn" disabled={!sound.enabled} onClick={() => (sound.playing ? sound.stopSequencer() : sound.startSequencer())}>
          {sound.playing ? 'Stop' : 'Play'}
        </button>
        <label className="lw-field">
          Tempo {sound.bpm} BPM{' '}
          <input type="range" min={60} max={160} value={sound.bpm} onChange={(e) => sound.setBpm(Number(e.target.value))} />
        </label>
        <button type="button" className="lw-btn lw-btn--ghost" onClick={() => sound.setPattern(emptyPattern())}>
          Clear
        </button>
        <button type="button" className="lw-btn lw-btn--ghost" onClick={() => sound.setPattern(starterPattern())}>
          Starter groove
        </button>
      </p>
    </>
  )
}
