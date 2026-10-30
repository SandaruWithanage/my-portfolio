import * as THREE from 'three'
import { describe, expect, it, vi } from 'vitest'
import { AVENUE_HALF_WIDTH, PLAZA, SIGHTLINE, buildCity, cityLayout } from '../features/hub/backdrop/city'

describe('city layout', () => {
  it('is deterministic, so the skyline is the same on every visit', () => {
    expect(cityLayout('high')).toEqual(cityLayout('high'))
  })

  it('keeps the plaza and the avenue toward the viewer open', () => {
    for (const q of ['high', 'low'] as const) {
      for (const b of cityLayout(q)) {
        expect(Math.hypot(b.x - PLAZA.x, b.z - PLAZA.z)).toBeGreaterThanOrEqual(PLAZA.r)
        if (b.z > PLAZA.z - 2) expect(Math.abs(b.x)).toBeGreaterThan(AVENUE_HALF_WIDTH)
        // The street toward the billboard stays clear, so the view has depth.
        if (b.z > SIGHTLINE.toZ) expect(Math.abs(b.x)).toBeGreaterThan(SIGHTLINE.halfWidth)
      }
    }
  })

  it('uses fewer towers on the low tier', () => {
    const high = cityLayout('high').length
    const low = cityLayout('low').length
    expect(low).toBeGreaterThan(20)
    expect(low).toBeLessThan(high)
  })

  it('makes distant towers taller so the skyline fills the frame above the HUD', () => {
    const blocks = cityLayout('high')
    const near = blocks.filter((b) => Math.hypot(b.x, b.z - PLAZA.z) < 25)
    const far = blocks.filter((b) => Math.hypot(b.x, b.z - PLAZA.z) > 45)
    const avg = (xs: typeof blocks) => xs.reduce((s, b) => s + b.h, 0) / xs.length
    expect(avg(far)).toBeGreaterThan(avg(near))
  })
})

describe('city scene', () => {
  for (const quality of ['high', 'low'] as const) {
    it(`releases everything it created and restores fog/background (${quality} tier)`, () => {
      const scene = new THREE.Scene()
      const fog = new THREE.Fog(0x000000, 1, 2)
      scene.fog = fog
      const before = new Set(scene.children)
      const city = buildCity(scene, quality)

      const owned = new Set<{ dispose: () => void }>()
      scene.traverse((o) => {
        const mesh = o as THREE.Mesh
        if (!mesh.geometry) return
        owned.add(mesh.geometry)
        for (const m of [mesh.material].flat() as THREE.MeshStandardMaterial[]) {
          owned.add(m)
          for (const t of [m.map, m.emissiveMap]) if (t) owned.add(t)
        }
        if ((o as THREE.InstancedMesh).isInstancedMesh) owned.add(o as THREE.InstancedMesh)
      })
      expect(owned.size).toBeGreaterThan(15)
      const spies = [...owned].map((r) => vi.spyOn(r, 'dispose'))

      city.dispose()
      for (const s of spies) expect(s).toHaveBeenCalled()
      expect(new Set(scene.children)).toEqual(before)
      expect(scene.fog).toBe(fog)
      expect(scene.background).toBeNull()
    })
  }
})
