import { useEffect, useRef, useState } from 'react'
import { isWebGLAvailable } from '../../engineering-lab/support'
import type { LookSource } from '../lookSource'
import type { Backdrop } from './createBackdrop'
import { FOCUS_SETTLE_MS } from './look'

type Props = {
  online: boolean
  /** True while a screen covers the room. */
  paused: boolean
  /** Side of the room the front screen came from (-1 left, 1 right). */
  focus: number
  /** Shared pointer reading (the same one that tilts the tiles). */
  look: LookSource
  reducedMotion: boolean
}

/**
 * Optional authored lab model. Leave null until a model whose licence allows use on
 * this site is in /public/models; the procedural room is the default.
 */
const LAB_MODEL_URL: string | null = null

/**
 * The 3D room behind the hub. Decorative and optional: without WebGL, or if the
 * context is lost, nothing renders and the hub's CSS background shows instead.
 * Three.js is loaded lazily so the hub's first paint never waits for it.
 */
export function HubBackdrop({ online, paused, focus, look, reducedMotion }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const backdrop = useRef<Backdrop | null>(null)
  const [available, setAvailable] = useState(() => isWebGLAvailable())
  const latest = useRef({ online, paused, focus })
  useEffect(() => {
    latest.current = { online, paused, focus }
  })

  useEffect(() => {
    const canvas = canvasRef.current
    if (!available || !canvas) return
    let cancelled = false
    let instance: Backdrop | null = null
    import('./createBackdrop')
      .then(({ createBackdrop }) => {
        if (cancelled) return
        instance = createBackdrop(canvas, {
          reducedMotion,
          modelUrl: LAB_MODEL_URL,
          onContextLost: () => setAvailable(false),
        })
        instance.setOnline(latest.current.online)
        instance.setPaused(latest.current.paused)
        backdrop.current = instance
      })
      .catch(() => {
        if (!cancelled) setAvailable(false)
      })
    return () => {
      cancelled = true
      instance?.dispose()
      backdrop.current = null
    }
  }, [available, reducedMotion])

  useEffect(() => backdrop.current?.setOnline(online), [online])

  // Opening a screen: turn toward its side of the room, then stop rendering once the
  // turn has settled (the screen covers the room). Closing: resume and turn back.
  useEffect(() => {
    const b = backdrop.current
    if (!b) return
    if (!paused) {
      b.setPaused(false)
      b.focus(0)
      return
    }
    if (reducedMotion) {
      b.setPaused(true)
      return
    }
    b.focus(latest.current.focus)
    const t = window.setTimeout(() => b.setPaused(true), FOCUS_SETTLE_MS)
    return () => window.clearTimeout(t)
  }, [paused, reducedMotion])

  useEffect(() => look.subscribe(({ x, y }) => backdrop.current?.look(x, y)), [look])

  if (!available) return null
  return <canvas ref={canvasRef} className="hub-backdrop" aria-hidden="true" />
}
