import { graphEdges, graphNodes, nodeById, type GraphNode } from '../../data/eduverse-graph'

const CYAN = '#36bffa'
const AMBER = '#f0ad62'
// [edge state, arrow colour, arrow opacity]: arrowheads must match their edge.
const ARROWS = [
  ['idle', CYAN, 0.5],
  ['visited', CYAN, 0.9],
  ['current', AMBER, 1],
  ['dim', CYAN, 0.2],
] as const

const W = 128
const H = 48

type Props = {
  selectedId: string | null
  /** Ordered edge ids of the active trace, and the current step. */
  trace: { edgeIds: string[]; step: number } | null
  onSelect?: (id: string) => void
}

/** Distance from a rectangle's centre to its edge along direction (dx, dy). */
function inset(dx: number, dy: number): number {
  const sx = dx === 0 ? Infinity : W / 2 / Math.abs(dx)
  const sy = dy === 0 ? Infinity : H / 2 / Math.abs(dy)
  return Math.min(sx, sy)
}

function endpoints(a: GraphNode, b: GraphNode) {
  const dx = b.diagram[0] - a.diagram[0]
  const dy = b.diagram[1] - a.diagram[1]
  const len = Math.hypot(dx, dy)
  const ux = dx / len
  const uy = dy / len
  const ta = inset(ux, uy) + 4
  const tb = inset(ux, uy) + 8
  return {
    x1: a.diagram[0] + ux * ta,
    y1: a.diagram[1] + uy * ta,
    x2: b.diagram[0] - ux * tb,
    y2: b.diagram[1] - uy * tb,
  }
}

/**
 * 2D architecture diagram generated from the same graph data as the 3D lab. It is the
 * no-WebGL fallback and is reused in the case study.
 */
export function ArchitectureDiagram({ selectedId, trace, onSelect }: Props) {
  const stateOf = (edgeId: string) => {
    const idx = trace ? trace.edgeIds.indexOf(edgeId) : -1
    if (!trace || idx < 0) return trace ? 'dim' : 'idle'
    return idx === trace.step ? 'current' : idx < trace.step ? 'visited' : 'dim'
  }
  return (
    <svg
      className="arch-diagram"
      viewBox="0 0 800 440"
      role="img"
      aria-labelledby="arch-title arch-desc"
    >
      <title id="arch-title">EduVerse system architecture</title>
      <desc id="arch-desc">
        {graphEdges
          .map((e) => `${nodeById(e.from)?.label} to ${nodeById(e.to)?.label}: ${e.label}`)
          .join('. ')}
        .
      </desc>
      <defs>
        {ARROWS.map(([state, color, opacity]) => (
          <marker key={state} id={`arrow-${state}`} viewBox="0 0 10 10" refX="9" refY="5" markerUnits="userSpaceOnUse" markerWidth="12" markerHeight="12" orient="auto">
            <path d="M0 0 L10 5 L0 10 z" fill={color} fillOpacity={opacity} />
          </marker>
        ))}
      </defs>
      {graphEdges.map((e) => {
        const a = nodeById(e.from)
        const b = nodeById(e.to)
        if (!a || !b) return null
        const p = endpoints(a, b)
        return (
          <line
            key={e.id}
            className={`arch-edge arch-edge--${stateOf(e.id)}`}
            x1={p.x1}
            y1={p.y1}
            x2={p.x2}
            y2={p.y2}
            markerEnd={`url(#arrow-${stateOf(e.id)})`}
          />
        )
      })}
      {graphNodes.map((n) => (
        <g
          key={n.id}
          className={`arch-node${n.id === selectedId ? ' is-selected' : ''}`}
          transform={`translate(${n.diagram[0] - W / 2} ${n.diagram[1] - H / 2})`}
          aria-hidden="true"
          onClick={onSelect ? () => onSelect(n.id) : undefined}
        >
          <rect width={W} height={H} rx="8" />
          <text x={W / 2} y={H / 2} textAnchor="middle" dominantBaseline="central">
            {n.label}
          </text>
        </g>
      ))}
    </svg>
  )
}
