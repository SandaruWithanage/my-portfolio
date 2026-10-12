import { animate } from 'animejs'
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import type { Destination } from './destinations'

type Props = {
  stack: string[]
  destinations: Destination[]
  reduced: boolean
  content: (id: string) => ReactNode
  /** The resting tile a screen expands out of (and collapses back into). */
  tileFor: (id: string) => HTMLElement | null
  onRaise: (id: string) => void
  onClose: (id: string) => void
}

type Anim = ReturnType<typeof animate>

const OPEN_MS = 700
const SHIFT_MS = 650
const CLOSE_MS = 360
const NARROW = 760

type Pose = { translateX: number; translateY: number; translateZ: number; rotateY: number; scale: number; opacity: number }

/** Front screen faces the visitor; earlier screens recede back and to the left, in order. */
function poseFor(depth: number): Pose {
  if (depth === 0) return { translateX: 0, translateY: 0, translateZ: 0, rotateY: 0, scale: 1, opacity: 1 }
  const vw = window.innerWidth
  if (vw < NARROW) return { translateX: 0, translateY: -24, translateZ: -300, rotateY: 0, scale: 0.92, opacity: 0 }
  const k = depth - 1
  return {
    translateX: -Math.min(vw * 0.2, 320) - k * 40,
    translateY: -30 - k * 20,
    translateZ: -520 - k * 200,
    rotateY: 16,
    scale: 0.9,
    opacity: Math.max(0.3, 0.7 - k * 0.15),
  }
}

/**
 * The open holographic screens. Three.js is not involved: these are ordinary DOM
 * sections in a CSS 3D layer above the hub, so their content stays readable and
 * accessible. Anime.js moves them between poses; only the front screen is
 * interactive (the others are inert, with a single "bring forward" control). The rail
 * stays above every screen so another can be opened while one is in front.
 *
 * State never waits on animation: a closed screen leaves the stack at once and an
 * inert copy plays its exit. Reopening it mid-exit cancels the exit. Each screen has
 * at most one running animation, and all of them stop on unmount.
 */
export function HoloScreens({ stack, destinations, reduced, content, tileFor, onRaise, onClose }: Props) {
  const els = useRef(new Map<string, HTMLElement>())
  const anims = useRef(new Map<string, Anim>())
  const shown = useRef(new Set<string>())
  const leaving = useRef(new Set<string>())
  const front = stack[stack.length - 1]

  // Screens that just left the stack keep rendering until their exit finishes.
  const [exiting, setExiting] = useState<string[]>([])
  const [prevStack, setPrevStack] = useState(stack)
  if (prevStack !== stack) {
    setPrevStack(stack)
    const removed = reduced ? [] : prevStack.filter((id) => !stack.includes(id))
    const next = [...exiting, ...removed.filter((id) => !exiting.includes(id))].filter((id) => !stack.includes(id))
    if (next.length !== exiting.length || next.some((id, i) => id !== exiting[i])) setExiting(next)
  }

  const run = useCallback((id: string, el: HTMLElement, params: Parameters<typeof animate>[1]) => {
    anims.current.get(id)?.pause()
    anims.current.set(id, animate(el, params))
  }, [])

  useLayoutEffect(() => {
    stack.forEach((id, i) => {
      const el = els.current.get(id)
      if (!el) return
      const target = poseFor(stack.length - 1 - i)
      const isNew = !shown.current.has(id)
      shown.current.add(id)
      leaving.current.delete(id)
      if (reduced) {
        anims.current.get(id)?.pause()
        el.style.transform = `translate3d(${target.translateX}px, ${target.translateY}px, ${target.translateZ}px) rotateY(${target.rotateY}deg) scale(${target.scale})`
        el.style.opacity = String(target.opacity)
        return
      }
      if (isNew) {
        // Expand out of the tile that was clicked.
        const tile = tileFor(id)?.getBoundingClientRect()
        const box = el.getBoundingClientRect()
        if (tile && box.width) {
          el.style.transformOrigin = `${tile.left + tile.width / 2 - box.left}px ${tile.top + tile.height / 2 - box.top}px`
        }
        run(id, el, { ...target, scale: [0.12, target.scale], opacity: [0, target.opacity], duration: OPEN_MS, ease: 'outExpo' })
      } else {
        // Includes a screen reopened mid-exit: it flies back from wherever it is.
        run(id, el, { ...target, duration: SHIFT_MS, ease: 'outQuart' })
      }
    })
    for (const id of exiting) {
      const el = els.current.get(id)
      if (!el || leaving.current.has(id)) continue
      leaving.current.add(id)
      run(id, el, {
        scale: 0.12,
        opacity: 0,
        duration: CLOSE_MS,
        ease: 'inQuad',
        onComplete: () => {
          leaving.current.delete(id)
          shown.current.delete(id)
          anims.current.delete(id)
          setExiting((e) => e.filter((x) => x !== id))
        },
      })
    }
    if (reduced) for (const id of shown.current) if (!stack.includes(id)) shown.current.delete(id)
  }, [stack, exiting, reduced, tileFor, run])

  // Stop every animation when the layer goes away (e.g. leaving the hub).
  useEffect(() => {
    const running = anims.current
    return () => {
      for (const a of running.values()) a.pause()
      running.clear()
    }
  }, [])

  // Focus follows the front screen.
  useEffect(() => {
    if (front) els.current.get(front)?.querySelector<HTMLElement>('.holo-window-body')?.focus({ preventScroll: true })
  }, [front])

  // Esc closes the front screen.
  useEffect(() => {
    if (!front) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !e.defaultPrevented) onClose(front)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [front, onClose])

  if (!stack.length && !exiting.length) return null
  // Exiting screens render last so they shrink away on top of whatever comes forward.
  const rendered = [...stack, ...exiting]
  return (
    <div className="holo-layer">
      {rendered.map((id, i) => {
        const d = destinations.find((x) => x.id === id)
        if (!d) return null
        const isExiting = i >= stack.length
        const depth = isExiting ? -1 : stack.length - 1 - i
        const titleId = `screen-${id}-title`
        return (
          <div
            key={id}
            className={`holo-window${isExiting ? ' holo-window--exiting' : ''}`}
            data-depth={depth}
            style={{ zIndex: 10 + i }}
            aria-hidden={isExiting || undefined}
            ref={(el) => {
              if (el) els.current.set(id, el)
              else els.current.delete(id)
            }}
          >
            <section
              className="holo-window-body"
              aria-labelledby={isExiting ? undefined : titleId}
              tabIndex={-1}
              inert={depth !== 0}
            >
              <header className="holo-window-bar">
                <span className="holo-code" aria-hidden="true">{d.code}</span>
                <p className="holo-window-title" id={isExiting ? undefined : titleId}>{d.title}</p>
                <Link to={d.to} className="holo-window-page">
                  Open as page<span className="visually-hidden">: {d.title}</span>
                </Link>
                <button type="button" className="holo-window-close" onClick={() => onClose(id)} aria-label={`Close ${d.title}`}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                    <path d="M6 6l12 12M18 6L6 18" />
                  </svg>
                </button>
              </header>
              <div className="holo-window-content">{content(id)}</div>
            </section>
            {depth > 0 && (
              <button type="button" className="holo-window-raise" onClick={() => onRaise(id)}>
                Bring {d.title} forward
              </button>
            )}
          </div>
        )
      })}
      {stack.length > 0 && (
        <nav className="holo-rail" aria-label="Switch screen">
          {destinations.map((d) => (
            <button
              key={d.id}
              type="button"
              className="holo-rail-item"
              aria-current={d.id === front ? 'true' : undefined}
              onClick={() => d.id !== front && onRaise(d.id)}
            >
              <span className="holo-code" aria-hidden="true">{d.code}</span> {d.title}
            </button>
          ))}
        </nav>
      )}
    </div>
  )
}
