import * as THREE from 'three'

export type CableNode = { id: string; pos: [number, number] }
export type CableEdge = { id: string; from: string; to: string }
export type TraceState = { edgeIds: string[]; step: number }

const CYAN = new THREE.Color(0x36bffa)
const AMBER = new THREE.Color(0xf0ad62)
const PULSE_SECONDS = 0.9
const CABLE_Y = 0.22
const MODULE_RADIUS = 1.6

type Cable = {
  id: string
  curve: THREE.LineCurve3
  material: THREE.MeshBasicMaterial
}

/**
 * Floor cables between modules plus a pulse that travels the current trace step.
 * Three.js owns this motion; React/Anime only describe which step is active.
 */
export function buildCables(
  scene: THREE.Scene,
  nodes: CableNode[],
  edges: CableEdge[],
  reducedMotion: boolean,
) {
  const group = new THREE.Group()
  const disposables: { dispose: () => void }[] = []
  const track = <T extends { dispose: () => void }>(o: T): T => (disposables.push(o), o)

  const cables = new Map<string, Cable>()
  for (const e of edges) {
    const a = nodes.find((n) => n.id === e.from)
    const b = nodes.find((n) => n.id === e.to)
    if (!a || !b) continue
    const from = new THREE.Vector3(a.pos[0], CABLE_Y, a.pos[1])
    const to = new THREE.Vector3(b.pos[0], CABLE_Y, b.pos[1])
    const dir = to.clone().sub(from).normalize()
    const curve = new THREE.LineCurve3(
      from.clone().addScaledVector(dir, MODULE_RADIUS),
      to.clone().addScaledVector(dir, -MODULE_RADIUS),
    )
    const material = track(new THREE.MeshBasicMaterial({ color: CYAN, transparent: true, opacity: 0.5 }))
    const geometry = track(new THREE.TubeGeometry(curve, 1, 0.09, 8, false))
    group.add(new THREE.Mesh(geometry, material))
    cables.set(e.id, { id: e.id, curve, material })
  }

  const pulseGeo = track(new THREE.SphereGeometry(0.28, 16, 12))
  const pulseMat = track(new THREE.MeshBasicMaterial({ color: AMBER }))
  const pulse = new THREE.Mesh(pulseGeo, pulseMat)
  pulse.visible = false
  group.add(pulse)
  scene.add(group)

  let trace: TraceState | null = null
  let t = 1

  const paint = () => {
    for (const c of cables.values()) {
      const idx = trace ? trace.edgeIds.indexOf(c.id) : -1
      const state = !trace || idx < 0 ? 'idle' : idx === trace.step ? 'current' : idx < trace.step ? 'visited' : 'idle'
      c.material.color.copy(state === 'current' ? AMBER : CYAN)
      c.material.opacity = state === 'current' ? 1 : state === 'visited' ? 0.8 : trace ? 0.2 : 0.5
    }
  }

  const place = () => {
    const edgeId = trace && trace.step >= 0 ? trace.edgeIds[trace.step] : undefined
    const cable = edgeId ? cables.get(edgeId) : undefined
    pulse.visible = !!cable
    if (cable) pulse.position.copy(cable.curve.getPoint(t))
  }

  return {
    setTrace(next: TraceState | null) {
      const changedStep = !trace || !next || trace.step !== next.step || trace.edgeIds !== next.edgeIds
      trace = next
      if (changedStep) t = reducedMotion ? 1 : 0
      paint()
      place()
    },
    /** Advances the pulse; returns true while it is still travelling. */
    update(dt: number): boolean {
      if (t >= 1) return false
      t = Math.min(1, t + dt / PULSE_SECONDS)
      place()
      return t < 1
    },
    dispose() {
      scene.remove(group)
      for (const d of disposables) d.dispose()
    },
  }
}
