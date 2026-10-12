import { useEffect, useRef } from 'react'
import { DURATION } from '../../components/motion/motion'
import { useReveal } from '../../components/motion/useReveal'
import type { Lab, LabNode } from './scene/createLab'

type Props = {
  nodes: LabNode[]
  selectedId: string | null
  highlightedId: string | null
  activeNodeIds: string[]
  reducedMotion: boolean
  onSelect: (id: string) => void
  onHover: (id: string | null) => void
  onUnavailable: (reason: 'context-lost' | 'load-failed') => void
}

/** Thin React wrapper: mounts the Three.js scene once and syncs state into it. */
export default function LabCanvas(props: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const labRef = useRef<Lab | null>(null)
  const latest = useRef(props)
  latest.current = props
  useReveal(canvasRef, { duration: DURATION.canvas, y: 0 })

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    let cancelled = false
    let lab: Lab | null = null
    import('./scene/createLab')
      .then(({ createLab }) => {
        if (cancelled) return
        lab = createLab(canvas, {
          nodes: latest.current.nodes,
          reducedMotion: latest.current.reducedMotion,
          maxPixelRatio: window.innerWidth < 640 ? 1.5 : 2,
          onSelect: (id) => latest.current.onSelect(id),
          onHover: (id) => latest.current.onHover(id),
          onContextLost: () => latest.current.onUnavailable('context-lost'),
        })
        lab.setSelected(latest.current.selectedId)
        lab.setHighlighted(latest.current.highlightedId)
        lab.setActiveNodes(latest.current.activeNodeIds)
        labRef.current = lab
      })
      .catch(() => {
        if (!cancelled) latest.current.onUnavailable('load-failed')
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
  useEffect(() => {
    labRef.current?.setActiveNodes(props.activeNodeIds)
  }, [props.activeNodeIds])

  return <canvas ref={canvasRef} className="lab-canvas" aria-hidden="true" />
}
