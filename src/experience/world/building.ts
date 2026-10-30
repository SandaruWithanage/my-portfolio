import * as THREE from 'three'
import { identity } from '../content/adapters'
import type { Tier } from '../engine/quality'
import {
  CORRIDORS,
  ENTRANCE,
  FACADE_HEIGHT,
  ROOMS,
  ROOM_IDS,
  WALLS,
  WALL_HEIGHT,
  type Rect,
  type RoomId,
} from './layout'
import { ACCENT, PALETTE, signTexture, type Materials } from './materials'
import { markDynamic, mergeStatic } from './merge'

type Tracker = <T extends { dispose: () => void }>(o: T) => T

const m4 = new THREE.Matrix4()
const q = new THREE.Quaternion()
const v = new THREE.Vector3()
const s = new THREE.Vector3()

function floorPlane(r: Rect, mat: THREE.Material, track: Tracker, y = 0) {
  const w = r.x1 - r.x0
  const d = r.z1 - r.z0
  const geo = track(new THREE.PlaneGeometry(w, d))
  // Tile UVs to world size (one texture repeat = 4 m).
  const uv = geo.attributes.uv as THREE.BufferAttribute
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) * w) / 4, (uv.getY(i) * d) / 4)
  const mesh = new THREE.Mesh(geo, mat)
  mesh.rotation.x = -Math.PI / 2
  mesh.position.set((r.x0 + r.x1) / 2, y, (r.z0 + r.z1) / 2)
  mesh.receiveShadow = true
  return mesh
}

function signMesh(title: string, subtitle: string, accent: number, track: Tracker, w = 3.2, h = 0.8) {
  const mat = track(new THREE.MeshBasicMaterial({ map: track(signTexture(title, subtitle, accent)), toneMapped: false }))
  return new THREE.Mesh(track(new THREE.PlaneGeometry(w, h)), mat)
}

/**
 * The building shell, the entrance and the night plaza. Static except for the door
 * panels, the scan ring and a few slow ambient details animated in `update`.
 */
export function buildStructure(scene: THREE.Scene, mats: Materials, track: Tracker, tier: Tier) {
  const root = new THREE.Group()
  root.name = 'structure'

  // --- Floors -----------------------------------------------------------------
  for (const id of ROOM_IDS) if (ROOMS[id].inside) root.add(floorPlane(ROOMS[id].rect, mats.floor, track))
  for (const c of CORRIDORS) root.add(floorPlane(c.rect, mats.floor, track, 0.002))
  const plazaMat = track(new THREE.MeshStandardMaterial({ color: 0x2b333e, roughness: 0.55, metalness: 0.25 }))
  root.add(floorPlane(ROOMS.exterior.rect, plazaMat, track))
  root.add(floorPlane(ROOMS.airlock.rect, mats.floor, track, 0.003))
  const ground = new THREE.Mesh(track(new THREE.PlaneGeometry(260, 260)), track(new THREE.MeshStandardMaterial({ color: 0x0b0f15, roughness: 1 })))
  ground.rotation.x = -Math.PI / 2
  ground.position.y = -0.02
  root.add(ground)

  // --- Walls (instanced by material) ------------------------------------------
  const unit = track(new THREE.BoxGeometry(1, 1, 1))
  const interior = WALLS.filter((w) => w.kind === 'interior')
  const facade = WALLS.filter((w) => w.kind === 'facade')
  const boundary = WALLS.filter((w) => w.kind === 'boundary')
  const placeBoxes = (list: { x0: number; x1: number; z0: number; z1: number }[], h: number, mat: THREE.Material, y0 = 0) => {
    const mesh = track(new THREE.InstancedMesh(unit, mat, list.length))
    list.forEach((w, i) => {
      v.set((w.x0 + w.x1) / 2, y0 + h / 2, (w.z0 + w.z1) / 2)
      s.set(w.x1 - w.x0, h, w.z1 - w.z0)
      mesh.setMatrixAt(i, m4.compose(v, q, s))
    })
    mesh.instanceMatrix.needsUpdate = true
    mesh.castShadow = tier === 'high'
    mesh.receiveShadow = true
    root.add(mesh)
    return mesh
  }
  placeBoxes(interior, WALL_HEIGHT, mats.wall)
  placeBoxes(facade, FACADE_HEIGHT, mats.facade)
  // The plaza edge is a low parapet: it bounds movement without hiding the night.
  placeBoxes(boundary, 0.7, mats.metalDark)
  // Building massing behind the facade so the lab reads as one volume from outside.
  // It stops behind the airlock so it never covers the entrance; from inside, its
  // faces are back-facing and culled, so it only exists for exterior views.
  // Only rendered while the camera is outside: from the airlock its front face would
  // otherwise sit between the camera and the atrium.
  const mass = markDynamic(new THREE.Mesh(unit, mats.facade))
  mass.position.set(0, FACADE_HEIGHT / 2 - 0.01, (-26.8 + 11.6) / 2)
  mass.scale.set(51, FACADE_HEIGHT - 0.02, 11.6 + 26.8)
  root.add(mass)

  // Base trims: thin emissive strips along every interior wall (wayfinding glow).
  placeBoxes(
    interior.map((w) => {
      const thin = w.x1 - w.x0 < w.z1 - w.z0
      return thin ? { ...w, x0: w.x0 - 0.03, x1: w.x1 + 0.03 } : { ...w, z0: w.z0 - 0.03, z1: w.z1 + 0.03 }
    }),
    0.05,
    mats.trim.cyan,
    0.12,
  )

  // --- Ceilings with light strips ----------------------------------------------
  const strips: { x: number; z: number; w: number }[] = []
  for (const id of ROOM_IDS) {
    const r = ROOMS[id]
    if (!r.inside) continue
    const c = new THREE.Mesh(unit, mats.ceiling)
    c.position.set((r.rect.x0 + r.rect.x1) / 2, WALL_HEIGHT + 0.1, (r.rect.z0 + r.rect.z1) / 2)
    c.scale.set(r.rect.x1 - r.rect.x0, 0.2, r.rect.z1 - r.rect.z0)
    root.add(c)
    for (let z = r.rect.z0 + 2; z < r.rect.z1 - 1; z += 4) strips.push({ x: (r.rect.x0 + r.rect.x1) / 2, z, w: (r.rect.x1 - r.rect.x0) * 0.6 })
  }
  for (const cor of CORRIDORS) {
    const c = new THREE.Mesh(unit, mats.ceiling)
    c.position.set((cor.rect.x0 + cor.rect.x1) / 2, WALL_HEIGHT + 0.1, (cor.rect.z0 + cor.rect.z1) / 2)
    c.scale.set(cor.rect.x1 - cor.rect.x0, 0.2, cor.rect.z1 - cor.rect.z0)
    root.add(c)
  }
  const stripMat = mats.emissive(0xdff6ff, 0.9)
  const stripMesh = track(new THREE.InstancedMesh(unit, stripMat, strips.length))
  strips.forEach((st, i) => stripMesh.setMatrixAt(i, m4.compose(v.set(st.x, WALL_HEIGHT - 0.02, st.z), q, s.set(st.w, 0.04, 0.22))))
  stripMesh.instanceMatrix.needsUpdate = true
  root.add(stripMesh)

  // --- Doorway frames and signs ----------------------------------------------
  for (const cor of CORRIDORS) {
    for (const [here, there] of [cor.connects, [cor.connects[1], cor.connects[0]]] as [RoomId, RoomId][]) {
      const r = ROOMS[here].rect
      const c = cor.rect
      // Which edge of the corridor touches this room, and which way is "into the room".
      let px = 0
      let pz = 0
      let rotY = 0
      let span = 0
      if (c.x1 === r.x0 || c.x0 === r.x1) {
        px = c.x1 === r.x0 ? r.x0 : r.x1
        pz = (c.z0 + c.z1) / 2
        rotY = c.x1 === r.x0 ? Math.PI / 2 : -Math.PI / 2
        span = c.z1 - c.z0
      } else {
        pz = c.z1 === r.z0 ? r.z0 : r.z1
        px = (c.x0 + c.x1) / 2
        rotY = c.z1 === r.z0 ? 0 : Math.PI
        span = c.x1 - c.x0
      }
      const accent = ACCENT[ROOMS[there].accent]
      const frame = new THREE.Group()
      frame.position.set(px, 0, pz)
      frame.rotation.y = rotY
      for (const side of [-1, 1]) {
        const post = new THREE.Mesh(unit, mats.metal)
        post.position.set((side * span) / 2, 1.9, 0)
        post.scale.set(0.25, 3.8, 0.55)
        frame.add(post)
        const glow = new THREE.Mesh(unit, mats.emissive(accent, 1.8))
        glow.position.set((side * (span / 2 - 0.15)), 1.9, 0.29)
        glow.scale.set(0.05, 3.4, 0.02)
        frame.add(glow)
      }
      const lintel = new THREE.Mesh(unit, mats.metal)
      lintel.position.set(0, 3.9, 0)
      lintel.scale.set(span + 0.25, 0.3, 0.55)
      frame.add(lintel)
      const sign = signMesh(ROOMS[there].name, '▸ enter', accent, track, 3, 0.75)
      sign.position.set(0, 4.5, 0.3)
      frame.add(sign)
      root.add(frame)
    }
  }

  // --- Entrance portal, door and scanner --------------------------------------
  const portal = new THREE.Group()
  portal.position.set(0, 0, ENTRANCE.z + 0.2)
  for (const side of [-1, 1]) {
    const pylon = new THREE.Mesh(unit, mats.metal)
    pylon.position.set(side * 4.1, 2.6, 0.6)
    pylon.scale.set(1.2, 5.2, 1.6)
    portal.add(pylon)
    const edge = new THREE.Mesh(unit, mats.trim.cyan)
    edge.position.set(side * 3.45, 2.6, 1.42)
    edge.scale.set(0.06, 4.8, 0.04)
    portal.add(edge)
  }
  const canopy = new THREE.Mesh(unit, mats.metal)
  canopy.position.set(0, 5.3, 1.4)
  canopy.scale.set(9.5, 0.35, 3.4)
  portal.add(canopy)
  const canopyGlow = new THREE.Mesh(unit, mats.trim.cyan)
  canopyGlow.position.set(0, 5.1, 3.1)
  canopyGlow.scale.set(9.3, 0.05, 0.05)
  portal.add(canopyGlow)
  const nameSign = signMesh(`${identity.name} · Lab`, identity.tagline, PALETTE.cyan, track, 9, 2.25)
  nameSign.position.set(0, 7.4, 0.05)
  portal.add(nameSign)
  root.add(portal)

  const doorMat = track(new THREE.MeshStandardMaterial({ color: 0x2b3440, roughness: 0.35, metalness: 0.85 }))
  const doors: THREE.Mesh[] = []
  for (const side of [-1, 1]) {
    const d = new THREE.Mesh(unit, doorMat)
    d.scale.set(3, 4.4, 0.25)
    d.position.set(side * 1.5, 2.2, ENTRANCE.z)
    const seam = new THREE.Mesh(unit, mats.trim.amber)
    seam.scale.set(0.02, 0.9, 1.1)
    seam.position.set(-side * 0.49, 0, 0)
    d.add(seam)
    doors.push(markDynamic(d))
    root.add(d)
  }
  const scanRing = new THREE.Mesh(track(new THREE.TorusGeometry(1.25, 0.04, 8, 64)), mats.holo(PALETTE.cyan, 0.9))
  scanRing.rotation.x = Math.PI / 2
  scanRing.visible = false
  root.add(markDynamic(scanRing))
  const scanDisc = new THREE.Mesh(track(new THREE.CircleGeometry(1.25, 48)), mats.holo(PALETTE.cyan, 0.12))
  scanDisc.rotation.x = -Math.PI / 2
  scanDisc.visible = false
  root.add(markDynamic(scanDisc))

  // --- Plaza dressing: path, path lights, lamp posts, skyline, stars ------------
  const path = floorPlane({ x0: -2.6, x1: 2.6, z0: 16.2, z1: 35 }, track(new THREE.MeshStandardMaterial({ color: 0x252d38, roughness: 0.45, metalness: 0.3 })), track, 0.004)
  root.add(path)
  const lights: { x: number; z: number }[] = []
  for (let z = 18; z < 35; z += 2.6) lights.push({ x: -2.9, z }, { x: 2.9, z })
  const studs = track(new THREE.InstancedMesh(unit, mats.trim.cyan, lights.length))
  lights.forEach((p, i) => studs.setMatrixAt(i, m4.compose(v.set(p.x, 0.06, p.z), q, s.set(0.18, 0.12, 0.5))))
  studs.instanceMatrix.needsUpdate = true
  root.add(studs)
  const lampSpots = [
    [-9, 22],
    [9, 22],
    [-9, 31],
    [9, 31],
  ]
  for (const [x, z] of lampSpots) {
    const post = new THREE.Mesh(unit, mats.metalDark)
    post.position.set(x, 2, z)
    post.scale.set(0.18, 4, 0.18)
    const head = new THREE.Mesh(unit, mats.emissive(0xffe2b0, 1.6))
    head.position.set(x, 4.05, z)
    head.scale.set(0.9, 0.08, 0.3)
    const pool = new THREE.Mesh(track(new THREE.PlaneGeometry(7, 7)), mats.glow(0xffd9a0, 0.32))
    pool.rotation.x = -Math.PI / 2
    pool.position.set(x, 0.02, z)
    root.add(post, head, pool)
  }
  // Distant skyline silhouettes with sparse lit windows (decoration, beyond the plaza).
  const towers: Rect[] = []
  let seed = 5
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
  for (let i = 0; i < 26; i++) {
    const a = Math.PI * (0.12 + rnd() * 0.76)
    const d = 120 + rnd() * 50
    const x = Math.cos(a) * d * (i % 2 ? 1 : -1)
    const z = -Math.sin(a) * d * 0.6 + 10
    towers.push({ x0: x - 4, x1: x + 4, z0: z - 4, z1: z + 4 })
  }
  const towerMesh = track(new THREE.InstancedMesh(unit, track(new THREE.MeshStandardMaterial({ color: 0x0d121a, roughness: 1, emissive: 0x0a1626, emissiveIntensity: 0.6 })), towers.length))
  towers.forEach((t, i) => {
    const h = 10 + rnd() * 22
    towerMesh.setMatrixAt(i, m4.compose(v.set((t.x0 + t.x1) / 2, h / 2, (t.z0 + t.z1) / 2), q, s.set(t.x1 - t.x0, h, t.z1 - t.z0)))
  })
  towerMesh.instanceMatrix.needsUpdate = true
  root.add(towerMesh)
  if (tier !== 'low') {
    const n = tier === 'high' ? 900 : 400
    const pos = new Float32Array(n * 3)
    for (let i = 0; i < n; i++) {
      const th = rnd() * Math.PI * 2
      const ph = rnd() * Math.PI * 0.42
      pos.set([Math.cos(th) * Math.sin(ph) * 180, Math.cos(ph) * 120 + 15, Math.sin(th) * Math.sin(ph) * 180], i * 3)
    }
    const g = track(new THREE.BufferGeometry())
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    root.add(new THREE.Points(g, track(new THREE.PointsMaterial({ color: 0xbfd8ff, size: 0.5, sizeAttenuation: true, transparent: true, opacity: 0.7, depthWrite: false }))))
  }
  const moon = new THREE.Mesh(track(new THREE.SphereGeometry(4, 24, 16)), track(new THREE.MeshBasicMaterial({ color: 0xdfe8ff, toneMapped: false })))
  moon.position.set(-60, 70, -90)
  root.add(moon)

  // Sky dome: deep navy zenith fading to a teal city glow at the horizon.
  const skyGeo = track(new THREE.SphereGeometry(300, 32, 16))
  const colors: number[] = []
  const pos = skyGeo.attributes.position as THREE.BufferAttribute
  const top = new THREE.Color(0x05070f)
  const horizon = new THREE.Color(0x1b3a52)
  const c = new THREE.Color()
  for (let i = 0; i < pos.count; i++) {
    const h = THREE.MathUtils.clamp(pos.getY(i) / 300, 0, 1)
    c.copy(horizon).lerp(top, Math.pow(h, 0.45))
    colors.push(c.r, c.g, c.b)
  }
  skyGeo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  const sky = new THREE.Mesh(skyGeo, track(new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false })))
  sky.renderOrder = -1
  root.add(markDynamic(sky))
  // Facade window bands so the building reads as a lit lab at night.
  const bands: { x: number; y: number; w: number }[] = []
  for (const y of [2.2, 6.4]) for (const x of [-11.5, -6.2, 6.2, 11.5]) bands.push({ x, y, w: 3.6 })
  const bandMesh = track(new THREE.InstancedMesh(unit, mats.emissive(0x9fe8ff, 1.1), bands.length))
  bands.forEach((b, i) => bandMesh.setMatrixAt(i, m4.compose(v.set(b.x, b.y, ENTRANCE.z + 0.22), q, s.set(b.w, 0.55, 0.05))))
  bandMesh.instanceMatrix.needsUpdate = true
  root.add(bandMesh)
  const warm = track(new THREE.InstancedMesh(unit, mats.emissive(PALETTE.amber, 0.9), 4))
  ;[-14, -3.9, 3.9, 14].forEach((x, i) => warm.setMatrixAt(i, m4.compose(v.set(x, 0.5, ENTRANCE.z + 0.22), q, s.set(0.08, 1, 0.05))))
  warm.instanceMatrix.needsUpdate = true
  root.add(warm)

  // --- Lights -----------------------------------------------------------------
  const hemi = new THREE.HemisphereLight(0x9db6d8, 0x141a22, 1.0)
  const moonLight = new THREE.DirectionalLight(0xc2d0ff, 1.6)
  moonLight.position.set(-20, 40, 30)
  moonLight.target.position.set(0, 0, 10)
  if (tier === 'high') {
    moonLight.castShadow = true
    moonLight.shadow.mapSize.set(1024, 1024)
    const cam = moonLight.shadow.camera
    cam.left = -18
    cam.right = 18
    cam.top = 18
    cam.bottom = -18
    cam.near = 1
    cam.far = 90
  }
  const portalLight = new THREE.PointLight(PALETTE.cyan, 30, 18, 1.8)
  portalLight.position.set(0, 4.6, 19)
  root.add(hemi, moonLight, moonLight.target, portalLight)
  // Interior fill per room (cheap: few, wide, no shadows).
  const roomLights: THREE.PointLight[] = []
  for (const id of ROOM_IDS) {
    const r = ROOMS[id]
    if (!r.inside || id === 'airlock') continue
    const l = new THREE.PointLight(0xcfe3ff, tier === 'low' ? 0 : 14, 22, 1.6)
    l.position.set((r.rect.x0 + r.rect.x1) / 2, 4.2, (r.rect.z0 + r.rect.z1) / 2)
    roomLights.push(l)
    root.add(l)
  }
  const fill = new THREE.AmbientLight(0x7d93b4, tier === 'low' ? 1.1 : 0.55)
  root.add(fill)

  const merged = mergeStatic(root, track)
  scene.add(root)

  let doorOpen = 0
  let scan = -1
  return {
    root,
    /** 0 = closed, 1 = fully open (panels slide into the wall). */
    setDoorOpen(f: number) {
      doorOpen = Math.max(0, Math.min(1, f))
      doors[0].position.x = -1.5 - doorOpen * 2.9
      doors[1].position.x = 1.5 + doorOpen * 2.9
    },
    get doorOpen() {
      return doorOpen
    },
    /** Scan progress 0..1 (or -1 to hide): ring sweeps down over the robot. */
    setScan(p: number, x: number, z: number) {
      scan = p
      scanRing.visible = scanDisc.visible = p >= 0 && p <= 1
      if (!scanRing.visible) return
      scanRing.position.set(x, 2.6 - p * 2.45, z)
      scanDisc.position.set(x, 0.03, z)
      ;(scanDisc.material as THREE.MeshBasicMaterial).opacity = 0.18 * Math.sin(p * Math.PI)
    },
    update(t: number, cameraZ: number) {
      mass.visible = cameraZ > ENTRANCE.z + 0.3
      canopyGlow.scale.x = 9.3
      ;(mats.trim.cyan as THREE.MeshStandardMaterial).emissiveIntensity = 1.5 + Math.sin(t * 1.3) * 0.15
      if (scan >= 0) scanRing.rotation.z = t * 3
    },
    lights: { portalLight, roomLights, moonLight },
    merged,
  }
}

export type Structure = ReturnType<typeof buildStructure>
