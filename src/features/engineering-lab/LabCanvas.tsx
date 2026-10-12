import { useEffect, useRef } from 'react'
import type { Lab, LabProject } from './scene/createLab'

type Props = {
  projects: LabProject[]
  selectedId: string | null
  highlightedId: string | null
  reducedMotion: boolean
  onSelect: (id: string) => void
  onHover: (id: string | null) => void
  onUnavailable: () => void
}

/** Thin React wrapper: mounts the Three.js scene once and syncs state into it. */
export default function LabCanvas(props: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const labRef = useRef<Lab | null>(null)
  const latest = useRef(props)
  latest.current = props

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    let cancelled = false
    let lab: Lab | null = null
    import('./scene/createLab')
      .then(({ createLab }) => {
        if (cancelled) return
        lab = createLab(canvas, {
          projects: latest.current.projects,
          reducedMotion: latest.current.reducedMotion,
          maxPixelRatio: window.innerWidth < 640 ? 1.5 : 2,
          onSelect: (id) => latest.current.onSelect(id),
          onHover: (id) => latest.current.onHover(id),
          onContextLost: () => latest.current.onUnavailable(),
        })
        lab.setSelected(latest.current.selectedId)
        lab.setHighlighted(latest.current.highlightedId)
        labRef.current = lab
      })
      .catch(() => {
        if (!cancelled) latest.current.onUnavailable()
      })
    return () => {
      cancelled = true
      lab?.dispose()
      labRef.current = null
    }
    // The scene is created once per mount; later prop changes are synced below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    labRef.current?.setSelected(props.selectedId)
  }, [props.selectedId])
  useEffect(() => {
    labRef.current?.setHighlighted(props.highlightedId)
  }, [props.highlightedId])

  return <canvas ref={canvasRef} className="lab-canvas" aria-hidden="true" />
}
