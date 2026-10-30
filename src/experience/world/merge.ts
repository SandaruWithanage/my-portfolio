import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

type Tracker = <T extends { dispose: () => void }>(o: T) => T

/** Mark an object (and everything under it) as animated, so it is never merged. */
export const markDynamic = <T extends THREE.Object3D>(o: T): T => {
  o.userData.dynamic = true
  return o
}

function isDynamic(o: THREE.Object3D, stop: THREE.Object3D) {
  for (let n: THREE.Object3D | null = o; n && n !== stop; n = n.parent) if (n.userData.dynamic) return true
  return false
}

const KEEP = ['position', 'normal', 'uv']

/**
 * Draw-call reduction: every static, non-instanced mesh under `root` that shares a
 * material with others is baked into one merged mesh per material. Animated objects
 * (marked dynamic) and one-off materials are left untouched.
 */
export function mergeStatic(root: THREE.Object3D, track: Tracker): { before: number; after: number } {
  root.updateMatrixWorld(true)
  const toRoot = new THREE.Matrix4().copy(root.matrixWorld).invert()
  const byMat = new Map<THREE.Material, THREE.Mesh[]>()
  let before = 0
  root.traverse((o) => {
    const m = o as THREE.Mesh
    if (!m.isMesh || (m as THREE.InstancedMesh).isInstancedMesh || Array.isArray(m.material)) return
    before++
    if (isDynamic(m, root)) return
    const list = byMat.get(m.material as THREE.Material) ?? []
    list.push(m)
    byMat.set(m.material as THREE.Material, list)
  })
  let removed = 0
  for (const [mat, meshes] of byMat) {
    if (meshes.length < 2) continue
    const geos = meshes.map((m) => {
      const g = (m.geometry.index ? m.geometry.clone() : m.geometry.clone()).applyMatrix4(new THREE.Matrix4().multiplyMatrices(toRoot, m.matrixWorld))
      for (const name of Object.keys(g.attributes)) if (!KEEP.includes(name)) g.deleteAttribute(name)
      return g.index ? g : g.setIndex([...Array(g.attributes.position.count).keys()])
    })
    const merged = mergeGeometries(geos, false)
    geos.forEach((g) => g.dispose())
    if (!merged) continue
    track(merged)
    const mesh = new THREE.Mesh(merged, mat)
    mesh.castShadow = meshes.some((m) => m.castShadow)
    mesh.receiveShadow = meshes.some((m) => m.receiveShadow)
    root.add(mesh)
    for (const m of meshes) m.parent?.remove(m)
    removed += meshes.length - 1
  }
  return { before, after: before - removed }
}
