import * as THREE from 'three'
import type { GraphNode, NodeKind } from '../../../data/eduverse-graph'

const CYAN = 0x36bffa
const AMBER = 0xf0ad62

/** Architecture tiers, bottom to top. Infrastructure is the base ring the stack stands on. */
const TIER_OF: Record<NodeKind, number> = { infra: 0, database: 1, queue: 1, api: 2, sync: 2, cms: 2, client: 3 }
const TIER_Y = [0.45, 0.85, 1.35, 1.85]
const TIER_R = [1.55, 1.2, 0.95, 0.6]
/** Radians per second; alternate tiers turn the other way. Slow enough to read as machinery, not spin. */
export const CORE_SPEED = 0.18

export type CoreTier = { level: number; ids: string[] }

/** Group EduVerse's nodes into the core's tiers (pure; every node lands on exactly one tier). */
export function coreTiers(nodes: Pick<GraphNode, 'id' | 'kind'>[]): CoreTier[] {
  return TIER_Y.map((_, level) => ({ level, ids: nodes.filter((n) => TIER_OF[n.kind] === level).map((n) => n.id) }))
}

/**
 * The hub's centerpiece: EduVerse's architecture as a stacked mechanism on the
 * pedestal. Each tier is a ring with one block per system component, joined by a
 * spine. `update(t)` turns the tiers; the caller decides whether it runs.
 */
export function buildCore(scene: THREE.Scene, nodes: Pick<GraphNode, 'id' | 'kind'>[], center: THREE.Vector3) {
  const disposables: { dispose: () => void }[] = []
  const track = <T extends { dispose: () => void }>(o: T): T => (disposables.push(o), o)
  const root = new THREE.Group()
  root.position.copy(center)

  const ringMat = track(new THREE.MeshBasicMaterial({ color: CYAN, transparent: true, opacity: 0.75 }))
  const faintMat = track(new THREE.MeshBasicMaterial({ color: CYAN, transparent: true, opacity: 0.25 }))
  const blockMat = track(new THREE.MeshStandardMaterial({ color: 0x1a2a38, emissive: CYAN, emissiveIntensity: 0.35, roughness: 0.4, metalness: 0.7 }))
  const dataMat = track(new THREE.MeshStandardMaterial({ color: 0x2a2014, emissive: AMBER, emissiveIntensity: 0.4, roughness: 0.4, metalness: 0.7 }))
  const blockGeo = track(new THREE.BoxGeometry(0.26, 0.16, 0.26))

  const tiers: THREE.Group[] = []
  for (const { level, ids } of coreTiers(nodes)) {
    const tier = new THREE.Group()
    tier.position.y = TIER_Y[level]
    const r = TIER_R[level]
    const ring = new THREE.Mesh(track(new THREE.TorusGeometry(r, level === 0 ? 0.035 : 0.018, 6, 96)), level === 0 ? faintMat : ringMat)
    ring.rotation.x = Math.PI / 2
    tier.add(ring)
    // Tick marks make rotation legible even on a ring with one component.
    const ticks = new THREE.Mesh(track(new THREE.TorusGeometry(r + 0.08, 0.008, 4, 24)), faintMat)
    ticks.rotation.x = Math.PI / 2
    tier.add(ticks)
    ids.forEach((_, i) => {
      const a = (i / ids.length) * Math.PI * 2
      const block = new THREE.Mesh(blockGeo, level === 1 ? dataMat : blockMat)
      block.position.set(Math.cos(a) * r, 0, Math.sin(a) * r)
      block.rotation.y = -a
      tier.add(block)
    })
    root.add(tier)
    tiers.push(tier)
  }

  // Spine joining the tiers.
  const spine = new THREE.Mesh(track(new THREE.CylinderGeometry(0.03, 0.03, TIER_Y[3] - TIER_Y[0], 8)), ringMat)
  spine.position.y = (TIER_Y[0] + TIER_Y[3]) / 2
  root.add(spine)

  scene.add(root)

  return {
    /** Pose the tiers for time `t` in seconds. */
    update(t: number) {
      tiers.forEach((tier, i) => {
        tier.rotation.y = t * CORE_SPEED * (i % 2 ? -1 : 1)
      })
    },
    dispose() {
      scene.remove(root)
      for (const d of disposables) d.dispose()
    },
  }
}
