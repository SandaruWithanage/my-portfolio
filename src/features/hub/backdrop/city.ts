import * as THREE from 'three'
import type { Quality } from '../../engineering-lab/scene/quality'

const CYAN = 0x36bffa
const MAGENTA = 0xff3d9a
const AMBER = 0xf0ad62
const NIGHT = 0x05060d

export type Building = { x: number; z: number; w: number; d: number; h: number }

/** Plaza around the centerpiece and the avenue toward the viewer stay open. */
export const PLAZA = { x: 0, z: 2.5, r: 13 }
export const AVENUE_HALF_WIDTH = 6
/** A street receding from the plaza toward the billboard stays open, giving the view depth. */
export const SIGHTLINE = { halfWidth: 9, toZ: -48 }
/** The central billboard stands at the far end of the sightline. */
export const BILLBOARD = { y: 20, z: -50, w: 26, h: 13 }
const CAMERA_Z = 11

/** Small deterministic PRNG so the skyline is identical on every visit. */
function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * Lay out the city blocks on a grid (pure, deterministic). Blocks never stand in the
 * plaza or in the avenue between the viewer and the plaza; they get taller with
 * distance so the skyline fills the upper part of the frame above the HUD.
 */
export function cityLayout(quality: Quality, seed = 7): Building[] {
  const rnd = mulberry32(seed)
  const step = quality === 'high' ? 7 : 9
  const out: Building[] = []
  for (let gx = -56; gx <= 56; gx += step) {
    for (let gz = -70; gz <= 14; gz += step) {
      const x = gx + (rnd() - 0.5) * 2
      const z = gz + (rnd() - 0.5) * 2
      const w = 3 + rnd() * 3
      const d = 3 + rnd() * 3
      const nearPlaza = Math.hypot(x - PLAZA.x, z - PLAZA.z) < PLAZA.r + Math.max(w, d) / 2
      const inAvenue = Math.abs(x) < AVENUE_HALF_WIDTH + w / 2 && z > PLAZA.z - 2
      const inSightline = Math.abs(x) < SIGHTLINE.halfWidth + w / 2 && z > SIGHTLINE.toZ
      const behindCamera = z > CAMERA_Z - 1
      if (nearPlaza || inAvenue || inSightline || behindCamera) continue
      // Low near the plaza, rising with distance: the skyline climbs away from the viewer.
      const distance = Math.hypot(x, z - PLAZA.z)
      const h = 5 + rnd() * 8 + Math.min(distance, 60) ** 1.35 * 0.12
      out.push({ x, z, w, d, h })
    }
  }
  return out
}

/** Window grid used as an emissive map: sparse lit windows on a dark facade. */
function windowTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = 64
  c.height = 128
  const g = c.getContext('2d')
  if (g) {
    g.fillStyle = '#000'
    g.fillRect(0, 0, 64, 128)
    const rnd = mulberry32(3)
    for (let y = 4; y < 124; y += 8)
      for (let x = 4; x < 60; x += 8) {
        if (rnd() > 0.32) continue
        g.fillStyle = rnd() > 0.85 ? '#f0ad62' : rnd() > 0.5 ? '#36bffa' : '#9fd8ff'
        g.fillRect(x, y, 4, 4)
      }
  }
  const t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(2, 8)
  return t
}

/**
 * The central billboard: an original abstract emblem (hexagon, rings, scan lines), so
 * it still reads when the HUD covers part of it. Decorative; all real text is DOM.
 */
function billboardTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = 1024
  c.height = 512
  const g = c.getContext('2d')
  if (g) {
    const grad = g.createLinearGradient(0, 0, 0, 512)
    grad.addColorStop(0, '#12051f')
    grad.addColorStop(1, '#03141f')
    g.fillStyle = grad
    g.fillRect(0, 0, 1024, 512)
    g.fillStyle = 'rgba(54,191,250,0.08)'
    for (let y = 0; y < 512; y += 6) g.fillRect(0, y, 1024, 2)
    g.lineWidth = 6
    for (const [r, color] of [[200, '#ff3d9a'], [150, '#36bffa'], [100, '#36bffa']] as const) {
      g.strokeStyle = color
      g.beginPath()
      for (let k = 0; k <= 6; k++) {
        const a = Math.PI / 6 + (k * Math.PI) / 3
        const px = 512 + Math.cos(a) * r
        const py = 256 + Math.sin(a) * r * 0.9
        if (k) g.lineTo(px, py)
        else g.moveTo(px, py)
      }
      g.stroke()
    }
    g.fillStyle = '#f0ad62'
    g.fillRect(492, 236, 40, 40)
    g.strokeStyle = '#36bffa'
    g.lineWidth = 8
    g.strokeRect(14, 14, 996, 484)
  }
  return new THREE.CanvasTexture(c)
}

/**
 * Cyberpunk city for the hub (`?world=city`): night sky and dense fog, a wet street,
 * instanced towers with lit windows, neon edge strips and rooftop beacons, and one
 * central billboard behind the plaza. Fully static: nothing here asks for frames.
 */
export function buildCity(scene: THREE.Scene, quality: Quality) {
  const high = quality === 'high'
  const group = new THREE.Group()
  const lights: THREE.Light[] = []
  const disposables: { dispose: () => void }[] = []
  const track = <T extends { dispose: () => void }>(o: T): T => (disposables.push(o), o)
  const previous = { fog: scene.fog, background: scene.background }

  scene.background = new THREE.Color(NIGHT)
  // Violet haze: far towers fade, so the street reads as receding into the city.
  scene.fog = new THREE.FogExp2(0x140a26, high ? 0.03 : 0.034)

  // Street: dark and glossy, so neon reads as reflected sheen.
  const street = new THREE.Mesh(
    track(new THREE.PlaneGeometry(240, 240)),
    track(new THREE.MeshStandardMaterial({ color: 0x07080f, roughness: 0.22, metalness: 0.75 })),
  )
  street.rotation.x = -Math.PI / 2
  group.add(street)

  // Towers.
  const blocks = cityLayout(quality)
  const facade = track(
    new THREE.MeshStandardMaterial({
      color: 0x0b0e18,
      roughness: 0.6,
      metalness: 0.4,
      emissive: 0xffffff,
      emissiveIntensity: high ? 0.9 : 0.75,
      emissiveMap: track(windowTexture()),
    }),
  )
  const towers = track(new THREE.InstancedMesh(track(new THREE.BoxGeometry(1, 1, 1)), facade, blocks.length))
  const m = new THREE.Matrix4()
  const q = new THREE.Quaternion()
  blocks.forEach((b, i) => {
    towers.setMatrixAt(i, m.compose(new THREE.Vector3(b.x, b.h / 2, b.z), q, new THREE.Vector3(b.w, b.h, b.d)))
  })
  towers.instanceMatrix.needsUpdate = true
  group.add(towers)

  // Neon edge strips on the front corners of about a third of the towers (cyan / magenta).
  const lit = blocks.filter((_, i) => i % 3 === 0)
  const strips = track(new THREE.InstancedMesh(track(new THREE.BoxGeometry(0.12, 1, 0.12)), track(new THREE.MeshBasicMaterial({ color: 0xffffff })), lit.length * 2))
  const cyan = new THREE.Color(CYAN)
  const magenta = new THREE.Color(MAGENTA)
  lit.forEach((b, i) => {
    for (const side of [-1, 1]) {
      const k = i * 2 + (side > 0 ? 1 : 0)
      strips.setMatrixAt(k, m.compose(new THREE.Vector3(b.x + (side * b.w) / 2, b.h / 2, b.z + b.d / 2), q, new THREE.Vector3(1, b.h, 1)))
      strips.setColorAt(k, i % 2 ? magenta : cyan)
    }
  })
  strips.instanceMatrix.needsUpdate = true
  group.add(strips)

  // Rooftop beacons on the tallest towers.
  const tall = [...blocks].sort((a, b) => b.h - a.h).slice(0, high ? 14 : 8)
  const beacons = track(new THREE.InstancedMesh(track(new THREE.SphereGeometry(0.25, 8, 6)), track(new THREE.MeshBasicMaterial({ color: 0xff4b4b })), tall.length))
  tall.forEach((b, i) => beacons.setMatrixAt(i, m.makeTranslation(b.x, b.h + 0.4, b.z)))
  beacons.instanceMatrix.needsUpdate = true
  group.add(beacons)

  // Central billboard behind the plaza, framed by a thin cyan edge.
  const board = new THREE.Mesh(
    track(new THREE.PlaneGeometry(BILLBOARD.w, BILLBOARD.h)),
    // Illuminated signage shines through the haze, so it is exempt from fog.
    track(new THREE.MeshBasicMaterial({ map: track(billboardTexture()), toneMapped: false, fog: false })),
  )
  board.position.set(0, BILLBOARD.y, BILLBOARD.z)
  const frame = new THREE.LineSegments(
    track(new THREE.EdgesGeometry(track(new THREE.PlaneGeometry(BILLBOARD.w + 0.6, BILLBOARD.h + 0.6)))),
    track(new THREE.LineBasicMaterial({ color: CYAN, fog: false })),
  )
  frame.position.copy(board.position)
  const mastHeight = BILLBOARD.y - BILLBOARD.h / 2
  const mast = new THREE.Mesh(track(new THREE.BoxGeometry(1.2, mastHeight, 1.2)), facade)
  mast.position.set(0, mastHeight / 2, BILLBOARD.z - 0.6)
  group.add(board, frame, mast)

  // Lighting: dim cool fill; neon colour comes from emissive surfaces, not lights.
  const hemi = new THREE.HemisphereLight(0x6a7cff, NIGHT, high ? 0.35 : 0.8)
  const moon = new THREE.DirectionalLight(0x9fb4ff, high ? 0.35 : 0.7)
  moon.position.set(-10, 30, 10)
  lights.push(hemi, moon)
  if (high) {
    // Billboard and plaza spill on the street (two lights, high tier only).
    const spill = new THREE.PointLight(MAGENTA, 60, 40, 2)
    spill.position.set(0, 10, BILLBOARD.z + 8)
    const plaza = new THREE.PointLight(AMBER, 12, 14, 2)
    plaza.position.set(0, 3, 5)
    lights.push(spill, plaza)
  }

  scene.add(group, ...lights)

  return {
    dispose() {
      scene.remove(group, ...lights)
      scene.fog = previous.fog
      scene.background = previous.background
      for (const d of disposables) d.dispose()
    },
  }
}
