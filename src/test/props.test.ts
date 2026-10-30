import * as THREE from 'three'
import { describe, expect, it, vi } from 'vitest'
import { buildProps } from '../features/hub/backdrop/props'

function hangarLights(scene: THREE.Scene) {
  const hemi = new THREE.HemisphereLight(0x9fb4c8, 0x0a0d12, 0.55)
  const key = new THREE.DirectionalLight(0xffffff, 0.7)
  scene.add(hemi, key)
  return { hemi, key }
}

describe('hub props (grounding and depth)', () => {
  for (const quality of ['high', 'low'] as const) {
    it(`releases every geometry, material and texture it created (${quality} tier)`, () => {
      const scene = new THREE.Scene()
      hangarLights(scene)
      const before = new Set(scene.children)
      const props = buildProps(scene, quality)

      const owned = new Set<{ dispose: () => void }>()
      scene.traverse((o) => {
        const mesh = o as THREE.Mesh
        if (!mesh.geometry) return
        owned.add(mesh.geometry)
        for (const m of [mesh.material].flat() as THREE.Material[]) {
          owned.add(m)
          const map = (m as THREE.MeshBasicMaterial).alphaMap
          if (map) owned.add(map)
        }
        if ((o as THREE.InstancedMesh).isInstancedMesh) owned.add(o as THREE.InstancedMesh)
      })
      expect(owned.size).toBeGreaterThan(10)
      const spies = [...owned].map((r) => vi.spyOn(r, 'dispose'))

      props.dispose()
      for (const s of spies) expect(s).toHaveBeenCalled()
      expect(new Set(scene.children)).toEqual(before)
    })
  }

  it('retunes only this scene’s hangar lights and restores them on dispose', () => {
    const scene = new THREE.Scene()
    const { hemi, key } = hangarLights(scene)
    const other = new THREE.Scene()
    const otherLights = hangarLights(other)
    const props = buildProps(scene, 'high')
    expect(hemi.intensity).toBeLessThan(0.55)
    expect(key.intensity).toBeLessThan(0.7)
    expect(otherLights.hemi.intensity).toBe(0.55)
    props.dispose()
    expect(hemi.intensity).toBe(0.55)
    expect(hemi.color.getHex()).toBe(0x9fb4c8)
    expect(key.intensity).toBe(0.7)
  })

  it('adds real amber work lights only on the high tier (glow pools stand in on low)', () => {
    const count = (q: 'high' | 'low') => {
      const scene = new THREE.Scene()
      buildProps(scene, q)
      let n = 0
      scene.traverse((o) => {
        if ((o as THREE.PointLight).isPointLight) n++
      })
      return n
    }
    expect(count('high')).toBe(2)
    expect(count('low')).toBe(0)
  })
})
