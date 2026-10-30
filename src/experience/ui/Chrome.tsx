import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { identity } from '../content/adapters'
import type { EngineStats } from '../engine/createEngine'
import type { Progress } from '../engine/assets'
import type { Settings } from '../state/settings'
import { CORRIDORS, DESTINATIONS, ROOMS, ROOM_IDS, type RoomId } from '../world/layout'

/* ---------------- Boot / loading ---------------- */

export function BootScreen({
  progress,
  ready,
  warning,
  onExplore,
  onTour,
}: {
  progress: Progress | null
  ready: boolean
  warning: string | null
  onExplore: () => void
  onTour: () => void
}) {
  const pct = progress && progress.total ? Math.min(100, Math.round((progress.loaded / progress.total) * 100)) : null
  const label =
    progress?.unit === 'bytes' && progress.total
      ? `${(progress.loaded / 1e6).toFixed(2)} of ${(progress.total / 1e6).toFixed(2)} MB`
      : progress
        ? `${progress.loaded} of ${progress.total ?? '?'} steps`
        : 'Starting'
  const enterRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (ready) enterRef.current?.focus()
  }, [ready])
  return (
    <div className="lw-boot">
      {/* Decorative blueprint: animates independently of (and never pretends to be) progress. */}
      <svg className="lw-blueprint" viewBox="-28 -26 56 64" aria-hidden="true">
        {ROOM_IDS.map((id) => {
          const r = ROOMS[id].rect
          return <rect key={id} x={r.x0} y={r.z0} width={r.x1 - r.x0} height={r.z1 - r.z0} />
        })}
        {CORRIDORS.map((c, i) => (
          <rect key={i} x={c.rect.x0} y={c.rect.z0} width={c.rect.x1 - c.rect.x0} height={c.rect.z1 - c.rect.z0} />
        ))}
      </svg>
      <div className="lw-boot-card">
        <p className="lw-kicker">Lab World</p>
        <h1>{identity.name}</h1>
        <p className="lw-lead">{identity.role} — {identity.tagline}</p>
        <p className="lw-muted">{identity.summary}</p>
        <div className="lw-progress" role="status" aria-live="polite">
          <div
            className="lw-progress-bar"
            role="progressbar"
            aria-label="Loading the lab"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={pct ?? undefined}
            aria-valuetext={ready ? 'Ready' : `${progress?.label ?? 'Loading'}: ${label}`}
          >
            <span style={{ width: `${ready ? 100 : (pct ?? 8)}%` }} className={pct === null && !ready ? 'is-indeterminate' : ''} />
          </div>
          <p className="lw-muted lw-progress-text">{ready ? 'Ready.' : `${progress?.label ?? 'Loading'} · ${label}`}</p>
        </div>
        {warning && <p className="lw-note">{warning}</p>}
        <div className="lw-choices">
          <button ref={enterRef} type="button" className="lw-btn lw-btn--primary" disabled={!ready} onClick={onExplore}>
            Enter the lab
          </button>
          <button type="button" className="lw-btn" disabled={!ready} onClick={onTour}>
            Take the guided tour
          </button>
          <Link className="lw-btn lw-btn--ghost" to="/portfolio">
            View portfolio
          </Link>
        </div>
        <p className="lw-muted lw-small">Sound is off until you turn it on. WASD / arrows to move, drag to look, E to interact.</p>
      </div>
    </div>
  )
}

/* ---------------- Top bar ---------------- */

export function TopBar({
  soundOn,
  onSound,
  onMap,
  onMenu,
  room,
}: {
  soundOn: boolean
  onSound: () => void
  onMap: () => void
  onMenu: () => void
  room: RoomId | null
}) {
  return (
    <header className="lw-topbar">
      <div className="lw-identity">
        <strong>{identity.name}</strong>
        <span className="lw-muted">{identity.role}</span>
      </div>
      <p className="lw-room" aria-live="polite">
        {room ? ROOMS[room].name : ''}
      </p>
      <nav className="lw-topbar-actions" aria-label="Lab controls">
        <Link className="lw-btn lw-btn--small lw-btn--primary" to="/portfolio">
          View portfolio
        </Link>
        <button type="button" className="lw-btn lw-btn--small" onClick={onSound} aria-pressed={soundOn}>
          {soundOn ? 'Sound on' : 'Sound off'}
        </button>
        <button type="button" className="lw-btn lw-btn--small" onClick={onMap} aria-keyshortcuts="M">
          Map
        </button>
        <button type="button" className="lw-btn lw-btn--small" onClick={onMenu} aria-keyshortcuts="Escape">
          Menu
        </button>
      </nav>
    </header>
  )
}

/* ---------------- Prompt, captions, hints ---------------- */

export function Prompt({ label, verb, touch, onAct }: { label: string; verb: string; touch: boolean; onAct: () => void }) {
  return (
    <div className="lw-prompt">
      <button type="button" className="lw-prompt-btn" onClick={onAct}>
        {!touch && <kbd>E</kbd>}
        <span>
          {verb} · {label}
        </span>
      </button>
    </div>
  )
}

export function Captions({ title, text, controls }: { title: string; text: string; controls?: React.ReactNode }) {
  return (
    <div className="lw-captions" role="region" aria-label="Tour caption">
      <p className="lw-kicker">{title}</p>
      <p>{text}</p>
      {controls && <div className="lw-actions">{controls}</div>}
    </div>
  )
}

export function Hints({ onDismiss, touch }: { onDismiss: () => void; touch: boolean }) {
  return (
    <div className="lw-hints" role="note">
      <ul>
        <li>{touch ? 'Left stick: move' : <><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> move · <kbd>Shift</kbd> run</>}</li>
        <li>{touch ? 'Drag right side: look' : 'Drag with the mouse: look'}</li>
        <li>{touch ? 'Tap the prompt to interact' : <><kbd>E</kbd> interact · <kbd>M</kbd> map · <kbd>Esc</kbd> menu</>}</li>
      </ul>
      <button type="button" className="lw-btn lw-btn--small" onClick={onDismiss}>
        Got it
      </button>
    </div>
  )
}

/* ---------------- Map ---------------- */

export function WorldMap({ pos, onTeleport, onClose }: { pos: { x: number; z: number; heading: number } | null; onTeleport: (r: RoomId) => void; onClose: () => void }) {
  const headRef = useRef<HTMLHeadingElement>(null)
  useEffect(() => headRef.current?.focus(), [])
  return (
    <section className="lw-panel lw-map" role="dialog" aria-modal="false" aria-labelledby="lw-map-title">
      <header className="lw-panel-head">
        <p className="lw-kicker">Floor plan</p>
        <h2 id="lw-map-title" ref={headRef} tabIndex={-1}>
          Lab map
        </h2>
        <button type="button" className="lw-icon-btn" onClick={onClose} aria-label="Close map">
          ✕
        </button>
      </header>
      <svg className="lw-map-svg" viewBox="-27 -25 54 63" aria-hidden="true">
        {CORRIDORS.map((c, i) => (
          <rect key={i} className="lw-map-corridor" x={c.rect.x0} y={c.rect.z0} width={c.rect.x1 - c.rect.x0} height={c.rect.z1 - c.rect.z0} />
        ))}
        {ROOM_IDS.map((id) => {
          const r = ROOMS[id].rect
          return (
            <g key={id} className={`lw-map-room lw-accent-${ROOMS[id].accent}`}>
              <rect x={r.x0} y={r.z0} width={r.x1 - r.x0} height={r.z1 - r.z0} />
              <text x={(r.x0 + r.x1) / 2} y={(r.z0 + r.z1) / 2} textAnchor="middle">
                {ROOMS[id].name}
              </text>
            </g>
          )
        })}
        {pos && (
          <g transform={`translate(${pos.x} ${pos.z}) rotate(${(-pos.heading * 180) / Math.PI})`}>
            <circle r="1.1" className="lw-map-you" />
            <path d="M0 2.2 L0.9 0.4 L-0.9 0.4 Z" className="lw-map-you" />
          </g>
        )}
      </svg>
      <ul className="lw-room-list">
        {DESTINATIONS.map((r) => (
          <li key={r}>
            <button type="button" className="lw-btn lw-btn--ghost" onClick={() => onTeleport(r)}>
              Go to {ROOMS[r].name}
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}

/* ---------------- Pause menu ---------------- */

type Tab = 'resume' | 'rooms' | 'tour' | 'controls' | 'settings'

export function PauseMenu({
  settings,
  onSettings,
  onResume,
  onTeleport,
  onTour,
  touring,
  onStopTour,
  soundOn,
  onSound,
}: {
  settings: Settings
  onSettings: (s: Partial<Settings>) => void
  onResume: () => void
  onTeleport: (r: RoomId) => void
  onTour: () => void
  touring: boolean
  onStopTour: () => void
  soundOn: boolean
  onSound: () => void
}) {
  const [tab, setTab] = useState<Tab>('resume')
  const headRef = useRef<HTMLHeadingElement>(null)
  useEffect(() => headRef.current?.focus(), [])
  const tabs: [Tab, string][] = [
    ['resume', 'Paused'],
    ['rooms', 'Rooms'],
    ['tour', 'Guided tour'],
    ['controls', 'Controls'],
    ['settings', 'Settings'],
  ]
  return (
    <section className="lw-menu" role="dialog" aria-modal="true" aria-labelledby="lw-menu-title">
      <div className="lw-menu-card">
        <h2 id="lw-menu-title" ref={headRef} tabIndex={-1}>
          Lab menu
        </h2>
        <div className="lw-tabs" role="tablist" aria-label="Menu sections">
          {tabs.map(([id, label]) => (
            <button key={id} type="button" role="tab" aria-selected={tab === id} className="lw-tab" onClick={() => setTab(id)}>
              {label}
            </button>
          ))}
        </div>
        <div className="lw-tabpanel" role="tabpanel">
          {tab === 'resume' && (
            <div className="lw-actions lw-actions--stack">
              <button type="button" className="lw-btn lw-btn--primary" onClick={onResume}>
                Resume
              </button>
              <Link className="lw-btn" to="/portfolio">
                View portfolio (2D)
              </Link>
              <button type="button" className="lw-btn" onClick={onSound} aria-pressed={soundOn}>
                {soundOn ? 'Turn sound off' : 'Turn sound on'}
              </button>
            </div>
          )}
          {tab === 'rooms' && (
            <ul className="lw-room-list">
              {DESTINATIONS.map((r) => (
                <li key={r}>
                  <button type="button" className="lw-btn lw-btn--ghost" onClick={() => onTeleport(r)}>
                    {ROOMS[r].name}
                  </button>
                  <span className="lw-muted"> — {ROOMS[r].purpose}</span>
                </li>
              ))}
            </ul>
          )}
          {tab === 'tour' && (
            <div className="lw-actions lw-actions--stack">
              <p>A hands-free walk through every room, with captions. Pause, skip or leave it at any time.</p>
              {touring ? (
                <button type="button" className="lw-btn" onClick={onStopTour}>
                  End the tour
                </button>
              ) : (
                <button type="button" className="lw-btn lw-btn--primary" onClick={onTour}>
                  Start the guided tour
                </button>
              )}
            </div>
          )}
          {tab === 'controls' && (
            <dl className="lw-facts">
              <dt>Move</dt>
              <dd>W A S D or arrow keys · Shift to run · left stick on touch</dd>
              <dt>Look</dt>
              <dd>Drag with the mouse (or right side on touch) · scroll to zoom</dd>
              <dt>Interact</dt>
              <dd>E (or the on-screen prompt)</dd>
              <dt>Map</dt>
              <dd>M</dd>
              <dt>Menu</dt>
              <dd>Esc</dd>
              <dt>Without 3D</dt>
              <dd>Use Rooms in this menu, or View portfolio — everything is available as plain pages.</dd>
            </dl>
          )}
          {tab === 'settings' && (
            <form className="lw-settings" onSubmit={(e) => e.preventDefault()}>
              <label className="lw-field">
                Graphics quality
                <select value={settings.quality} onChange={(e) => onSettings({ quality: e.target.value as Settings['quality'] })}>
                  <option value="auto">Auto</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </label>
              <label className="lw-field">
                Reduced motion
                <select
                  value={settings.reducedMotion === null ? 'system' : settings.reducedMotion ? 'on' : 'off'}
                  onChange={(e) => onSettings({ reducedMotion: e.target.value === 'system' ? null : e.target.value === 'on' })}
                >
                  <option value="system">Follow system</option>
                  <option value="on">On</option>
                  <option value="off">Off</option>
                </select>
              </label>
              <label className="lw-field">
                Camera sensitivity
                <input type="range" min={0.3} max={2.5} step={0.1} value={settings.sensitivity} onChange={(e) => onSettings({ sensitivity: Number(e.target.value) })} />
              </label>
              <label className="lw-field lw-field--check">
                <input type="checkbox" checked={settings.invertY} onChange={(e) => onSettings({ invertY: e.target.checked })} /> Invert vertical look
              </label>
              <label className="lw-field lw-field--check">
                <input type="checkbox" checked={settings.captions} onChange={(e) => onSettings({ captions: e.target.checked })} /> Show captions
              </label>
              <label className="lw-field">
                Volume
                <input type="range" min={0} max={1} step={0.05} value={settings.volume} onChange={(e) => onSettings({ volume: Number(e.target.value) })} />
              </label>
            </form>
          )}
        </div>
      </div>
    </section>
  )
}

/* ---------------- Mobile controls ---------------- */

export function MobileControls({ onStick, onLook }: { onStick: (x: number, y: number, run: boolean) => void; onLook: (dx: number, dy: number) => void }) {
  const knob = useRef<HTMLDivElement>(null)
  const origin = useRef<{ id: number; x: number; y: number } | null>(null)
  const lookRef = useRef<{ id: number; x: number; y: number } | null>(null)
  const R = 52
  const move = (e: React.PointerEvent) => {
    const o = origin.current
    if (!o || o.id !== e.pointerId) return
    let dx = e.clientX - o.x
    let dy = e.clientY - o.y
    const len = Math.hypot(dx, dy)
    if (len > R) {
      dx = (dx / len) * R
      dy = (dy / len) * R
    }
    if (knob.current) knob.current.style.transform = `translate(${dx}px, ${dy}px)`
    onStick(dx / R, -dy / R, len > R * 0.95)
  }
  const end = () => {
    origin.current = null
    if (knob.current) knob.current.style.transform = ''
    onStick(0, 0, false)
  }
  return (
    <div className="lw-touch" aria-hidden="true">
      <div
        className="lw-stick"
        onPointerDown={(e) => {
          origin.current = { id: e.pointerId, x: e.clientX, y: e.clientY }
          e.currentTarget.setPointerCapture(e.pointerId)
        }}
        onPointerMove={move}
        onPointerUp={end}
        onPointerCancel={end}
      >
        <div className="lw-stick-knob" ref={knob} />
      </div>
      <div
        className="lw-look"
        onPointerDown={(e) => {
          lookRef.current = { id: e.pointerId, x: e.clientX, y: e.clientY }
          e.currentTarget.setPointerCapture(e.pointerId)
        }}
        onPointerMove={(e) => {
          const l = lookRef.current
          if (!l || l.id !== e.pointerId) return
          onLook(e.clientX - l.x, e.clientY - l.y)
          l.x = e.clientX
          l.y = e.clientY
        }}
        onPointerUp={() => (lookRef.current = null)}
        onPointerCancel={() => (lookRef.current = null)}
      />
    </div>
  )
}

/* ---------------- Diagnostics (?stats=1) ---------------- */

export function StatsPanel({ get }: { get: () => EngineStats | null }) {
  const [s, setS] = useState<EngineStats | null>(null)
  useEffect(() => {
    const id = window.setInterval(() => setS(get()), 500)
    return () => window.clearInterval(id)
  }, [get])
  if (!s) return null
  return (
    <output className="lw-stats">
      {s.fps} fps · {s.frameMs} ms · {s.calls} calls · {Math.round(s.triangles / 1000)}k tris · geo {s.geometries} · tex {s.textures} · {s.tier} · room {s.room ?? '–'} · built {s.roomsBuilt} · robot {s.robot}
    </output>
  )
}
