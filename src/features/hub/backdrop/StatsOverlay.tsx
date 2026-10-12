import { useEffect, useState } from 'react'
import type { Backdrop } from './createBackdrop'

type Sample = { fps: number; drawMs: number; quality: string; paused: boolean; frames: number }

/**
 * Developer overlay, shown only with `?stats` in the URL: frames actually drawn per
 * second (0 when the room is idle or paused, by design) and mean CPU time per draw.
 * GPU time is not visible from here; use the browser's performance panel for that.
 */
export function StatsOverlay({ get }: { get: () => Backdrop | null }) {
  const [sample, setSample] = useState<Sample | null>(null)
  useEffect(() => {
    let prev = get()?.stats().frames ?? 0
    const id = window.setInterval(() => {
      const s = get()?.stats()
      if (!s) return
      setSample({ fps: (s.frames - prev) * 2, drawMs: s.drawMs, quality: s.quality, paused: s.paused, frames: s.frames })
      prev = s.frames
    }, 500)
    return () => window.clearInterval(id)
  }, [get])
  if (!sample) return null
  return (
    <output className="hub-stats" aria-live="off">
      {sample.fps} fps drawn · {sample.drawMs.toFixed(2)} ms/draw · {sample.quality}
      {sample.paused ? ' · paused' : ''} · {sample.frames} total
    </output>
  )
}
