import * as THREE from 'three'
import type { NodeKind } from '../../../data/eduverse-graph'

const CYAN = new THREE.Color(0x36bffa)
const GRAPHITE = 0x1d2733

export type BuiltModule = {
  group: THREE.Group
  material: THREE.MeshStandardMaterial
  line: THREE.LineBasicMaterial
  pickables: THREE.Object3D[]
}

type Track = <T extends { dispose: () => void }>(o: T) => T

/** Shared across modules so geometry and the pedestal material are built once. */
export function createModuleKit(track: Track) {
  const geoCache = new Map<string, THREE.BufferGeometry>()
  const edgeCache = new Map<THREE.BufferGeometry, THREE.EdgesGeometry>()
  const geo = (key: string, make: () => THREE.BufferGeometry) => {
    let g = geoCache.get(key)
    if (!g) {
      g = track(make())
      geoCache.set(key, g)
    }
    return g
  }
  const edges = (g: THREE.BufferGeometry) => {
    let e = edgeCache.get(g)
    if (!e) {
      e = track(new THREE.EdgesGeometry(g))
      edgeCache.set(g, e)
    }
    return e
  }
  const baseGeo = geo('base', () => new THREE.CylinderGeometry(1.5, 1.65, 0.16, 48))
  const baseMat = track(new THREE.MeshStandardMaterial({ color: 0x151c25, roughness: 0.7, metalness: 0.3 }))

  const build = (kind: NodeKind, id: string): BuiltModule => {
    const group = new THREE.Group()
    group.userData.moduleId = id
    const material = track(
      new THREE.MeshStandardMaterial({ color: GRAPHITE, roughness: 0.45, metalness: 0.6, emissive: CYAN, emissiveIntensity: 0.12 }),
    )
    const line = track(new THREE.LineBasicMaterial({ color: CYAN, transparent: true, opacity: 0.8 }))
    const pickables: THREE.Object3D[] = []

    const base = new THREE.Mesh(baseGeo, baseMat)
    base.position.y = 0.08
    base.userData.moduleId = id
    group.add(base)
    pickables.push(base)

    const part = (g: THREE.BufferGeometry, x: number, y: number, z: number, rot?: [number, number, number]) => {
      const mesh = new THREE.Mesh(g, material)
      mesh.position.set(x, y, z)
      if (rot) mesh.rotation.set(...rot)
      mesh.userData.moduleId = id
      const outline = new THREE.LineSegments(edges(g), line)
      outline.position.copy(mesh.position)
      outline.rotation.copy(mesh.rotation)
      group.add(mesh, outline)
      pickables.push(mesh)
    }
    const box = (w: number, h: number, d: number) => geo(`box${w},${h},${d}`, () => new THREE.BoxGeometry(w, h, d))
    const cyl = (r: number, h: number) => geo(`cyl${r},${h}`, () => new THREE.CylinderGeometry(r, r, h, 40))

    switch (kind) {
      case 'client':
        part(box(0.25, 0.7, 0.25), 0, 0.5, 0)
        part(box(2.2, 1.3, 0.1), 0, 1.5, 0)
        break
      case 'api':
        part(box(1.8, 0.6, 1.3), 0, 0.46, 0)
        for (const x of [-0.6, 0, 0.6]) part(box(0.18, 1.1, 0.18), x, 1.3, 0)
        part(box(1.8, 0.15, 0.4), 0, 1.92, 0)
        break
      case 'database':
        for (const y of [0.42, 0.97, 1.52]) part(cyl(0.85, 0.45), 0, y, 0)
        break
      case 'queue':
        part(box(0.3, 0.7, 0.3), 0, 0.5, 0)
        part(geo('torus', () => new THREE.TorusGeometry(0.85, 0.17, 12, 40)), 0, 1.55, 0)
        break
      case 'sync':
        part(box(1.5, 0.4, 1.1), 0, 0.36, 0)
        part(box(1.5, 0.4, 1.1), 0, 0.86, 0)
        part(geo('octa', () => new THREE.OctahedronGeometry(0.5)), 0, 1.7, 0)
        break
      case 'cms':
        for (let i = 0; i < 3; i++) part(box(1.6, 1.0, 0.1), 0, 0.75 + i * 0.2, -0.45 + i * 0.45)
        break
      case 'infra':
        for (const x of [-1.1, -0.37, 0.37, 1.1]) part(box(0.6, 1.3, 0.7), x, 0.8, 0)
        break
    }
    return { group, material, line, pickables }
  }

  return { build }
}
