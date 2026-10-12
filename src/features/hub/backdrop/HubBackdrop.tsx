import { useEffect, useRef, useState } from 'react'
import { isWebGLAvailable } from '../../engineering-lab/support'
import type { Backdrop } from './createBackdrop'

type Props = {
  online: boolean
  /** True while a screen covers the room. */
  paused: boolean
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
export function HubBackdrop({ online, paused, reducedMotion }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const backdrop = useRef<Backdrop | null>(null)
  const [available, setAvailable] = useState(() => isWebGLAvailable())
  const latest = useRef({ online, paused })
  useEffect(() => {
    latest.current = { online, paused }
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
  useEffect(() => backdrop.current?.setPaused(paused), [paused])

  // Mouse look (mouse only; touch and keyboard users get the still room).
  useEffect(() => {
    if (!available || reducedMotion) return
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return
      backdrop.current?.look(e.clientX / window.innerWidth - 0.5, e.clientY / window.innerHeight - 0.5)
    }
    window.addEventListener('pointermove', onMove, { passive: true })
    return () => window.removeEventListener('pointermove', onMove)
  }, [available, reducedMotion])

  if (!available) return null
  return <canvas ref={canvasRef} className="hub-backdrop" aria-hidden="true" />
}
