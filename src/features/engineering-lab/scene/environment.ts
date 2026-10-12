import * as THREE from 'three'
import type { Quality } from './quality'

const OBSIDIAN = 0x0a0d12
const CYAN = 0x36bffa
const AMBER = 0xf0ad62

export const PEDESTAL_Z = 2.5

function radialTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = c.height = 64
  const g = c.getContext('2d')
  if (g) {
    const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32)
    grad.addColorStop(0, 'rgba(255,255,255,1)')
    grad.addColorStop(1, 'rgba(255,255,255,0)')
    g.fillStyle = grad
    g.fillRect(0, 0, 64, 64)
  }
  return new THREE.CanvasTexture(c)
}

/**
 * Procedural hangar: floor, pedestal, walls, light strips, fog and lights.
 * Repeated strips and panels are instanced. No post-processing; glow is faked with
 * additive planes (high quality only).
 */
export function buildEnvironment(scene: THREE.Scene, quality: Quality, { emblem: withEmblem = true } = {}) {
  const group = new THREE.Group()
  const lights: THREE.Light[] = []
  const disposables: { dispose: () => void }[] = []
  const track = <T extends { dispose: () => void }>(o: T): T => (disposables.push(o), o)
  const high = quality === 'high'

  scene.fog = high ? new THREE.Fog(OBSIDIAN, 14, 42) : new THREE.Fog(OBSIDIAN, 26, 60)

  const dark = track(new THREE.MeshStandardMaterial({ color: 0x0f141b, roughness: 0.6, metalness: 0.5 }))
  const wallMat = track(new THREE.MeshStandardMaterial({ color: 0x0c1218, roughness: 0.9, metalness: 0.2 }))

  // Floor + grid + centre lane
  const planeGeo = track(new THREE.PlaneGeometry(70, 70))
  const floor = new THREE.Mesh(planeGeo, dark)
  floor.rotation.x = -Math.PI / 2
  group.add(floor)
  const grid = new THREE.GridHelper(70, 70, CYAN, 0x1d2733)
  const gm = (Array.isArray(grid.material) ? grid.material : [grid.material]) as THREE.Material[]
  for (const m of gm) {
    m.transparent = true
    m.opacity = 0.16
    track(m)
  }
  track(grid.geometry)
  grid.position.y = 0.01
  group.add(grid)
  const laneGeo = track(new THREE.BoxGeometry(0.1, 0.02, 40))
  const laneMat = track(new THREE.MeshBasicMaterial({ color: CYAN }))
  const lane = new THREE.Mesh(laneGeo, laneMat)
  lane.position.set(0, 0.02, -10)
  group.add(lane)

  // Pedestal
  const pedGeo = track(new THREE.CylinderGeometry(2.2, 2.5, 0.3, 64))
  const ped = new THREE.Mesh(pedGeo, dark)
  ped.position.set(0, 0.15, PEDESTAL_Z)
  group.add(ped)
  const ringGeo = track(new THREE.TorusGeometry(2.05, 0.03, 8, 96))
  const ring = new THREE.Mesh(ringGeo, laneMat)
  ring.rotation.x = Math.PI / 2
  ring.position.set(0, 0.32, PEDESTAL_Z)
  group.add(ring)
  const emblemGeo = track(new THREE.IcosahedronGeometry(0.7, 1))
  const emblemEdges = track(new THREE.EdgesGeometry(emblemGeo))
  const emblem = new THREE.LineSegments(emblemEdges, track(new THREE.LineBasicMaterial({ color: CYAN })))
  emblem.position.set(0, 1.3, PEDESTAL_Z)
  // The hub replaces the emblem with its own centerpiece; the Workshop keeps it.
  if (withEmblem) group.add(emblem)

  // Walls and ceiling
  const wallGeo = track(new THREE.PlaneGeometry(70, 10))
  const left = new THREE.Mesh(wallGeo, wallMat)
  left.position.set(-16, 5, -10)
  left.rotation.y = Math.PI / 2
  const right = left.clone()
  right.position.x = 16
  right.rotation.y = -Math.PI / 2
  const back = new THREE.Mesh(wallGeo, wallMat)
  back.position.set(0, 5, -22)
  const ceiling = new THREE.Mesh(planeGeo, wallMat)
  ceiling.position.set(0, 9.5, -10)
  ceiling.rotation.x = Math.PI / 2
  group.add(left, right, back, ceiling)

  // Instanced light strips: cyan on side walls, amber on the ceiling
  const place = (mesh: THREE.InstancedMesh, items: [number, number, number][]) => {
    const m = new THREE.Matrix4()
    items.forEach(([x, y, z], i) => mesh.setMatrixAt(i, m.makeTranslation(x, y, z)))
    mesh.instanceMatrix.needsUpdate = true
    group.add(mesh)
  }
  const wallStrips: [number, number, number][] = []
  for (const side of [-15.9, 15.9])
    for (const y of [2.2, 4.4, 6.6])
      for (let z = 4; z > -22; z -= 5) wallStrips.push([side, y, z])
  const stripGeo = track(new THREE.BoxGeometry(0.12, 0.14, 3))
  place(new THREE.InstancedMesh(stripGeo, laneMat, wallStrips.length), wallStrips)

  const ceilStrips: [number, number, number][] = []
  for (const x of [-2.6, 2.6]) for (let z = 6; z > -20; z -= 4) ceilStrips.push([x, 9.3, z])
  const amberMat = track(new THREE.MeshBasicMaterial({ color: AMBER }))
  place(new THREE.InstancedMesh(stripGeo, amberMat, ceilStrips.length), ceilStrips)

  // Pillars and wall panels (instanced)
  const pillarGeo = track(new THREE.BoxGeometry(0.6, 9.5, 0.6))
  const pillars: [number, number, number][] = []
  for (const x of [-12, 12]) for (let z = 4; z > -22; z -= 8) pillars.push([x, 4.75, z])
  place(new THREE.InstancedMesh(pillarGeo, dark, pillars.length), pillars)

  if (high) {
    // Cheap volumetric feel: additive glow pools and a light cone over the pedestal
    const tex = track(radialTexture())
    const glowGeo = track(new THREE.PlaneGeometry(1, 1))
    const glow = (color: number, opacity: number) =>
      track(new THREE.MeshBasicMaterial({ map: tex, color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false }))
    const pool = new THREE.Mesh(glowGeo, glow(CYAN, 0.35))
    pool.scale.set(9, 9, 1)
    pool.rotation.x = -Math.PI / 2
    pool.position.set(0, 0.04, PEDESTAL_Z)
    const backGlow = new THREE.Mesh(glowGeo, glow(CYAN, 0.18))
    backGlow.scale.set(34, 12, 1)
    backGlow.position.set(0, 4, -21.5)
    const coneGeo = track(new THREE.ConeGeometry(2.4, 8, 32, 1, true))
    const cone = new THREE.Mesh(coneGeo, track(new THREE.MeshBasicMaterial({ color: 0xbfe8ff, transparent: true, opacity: 0.05, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })))
    cone.position.set(0, 4.3, PEDESTAL_Z)
    group.add(pool, backGlow, cone)

    const cyanLight = new THREE.PointLight(CYAN, 40, 16, 2)
    cyanLight.position.set(0, 4, PEDESTAL_Z)
    const amberLight = new THREE.PointLight(AMBER, 30, 18, 2)
    amberLight.position.set(0, 8, -6)
    lights.push(cyanLight, amberLight)
  }

  const hemi = new THREE.HemisphereLight(0x9fb4c8, OBSIDIAN, high ? 0.55 : 1.2)
  const key = new THREE.DirectionalLight(0xffffff, high ? 0.7 : 1.5)
  key.position.set(4, 8, 8)
  lights.push(hemi, key)

  scene.add(group, ...lights)

  return {
    dispose() {
      scene.remove(group, ...lights)
      for (const d of disposables) d.dispose()
    },
  }
}
