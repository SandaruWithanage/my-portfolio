import * as THREE from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import type { Quality } from '../../engineering-lab/scene/quality'

const CYAN = 0x36bffa
const AMBER = 0xf0ad62

/** Kept low so reflections read as sheen on metal, not as a bright room. */
const ENV_INTENSITY = 0.35

/**
 * Hub-only workshop detail layered over the shared hangar (which the Engineering
 * Workshop also uses, so it is not modified). Adds reflections, a glossy floor,
 * amber accents near the console, instanced server racks along the back wall and
 * overhead structure. Everything is static: nothing here needs extra frames.
 */
export function buildWorkshop(scene: THREE.Scene, renderer: THREE.WebGLRenderer, quality: Quality) {
  const high = quality === 'high'
  const group = new THREE.Group()
  const lights: THREE.Light[] = []
  const disposables: { dispose: () => void }[] = []
  const track = <T extends { dispose: () => void }>(o: T): T => (disposables.push(o), o)

  // Reflections: prefilter a procedural room once, keep only the result.
  const pmrem = new THREE.PMREMGenerator(renderer)
  const room = new RoomEnvironment()
  const envTarget = track(pmrem.fromScene(room, 0.04))
  room.dispose()
  pmrem.dispose()
  scene.environment = envTarget.texture
  scene.environmentIntensity = ENV_INTENSITY

  // Glossy floor finish, just above the shared floor and below its grid lines.
  const floor = new THREE.Mesh(
    track(new THREE.PlaneGeometry(32, 40)),
    track(new THREE.MeshStandardMaterial({ color: 0x080b10, roughness: 0.26, metalness: 0.85 })),
  )
  floor.rotation.x = -Math.PI / 2
  floor.position.set(0, 0.005, -4)
  group.add(floor)

  const metal = track(new THREE.MeshStandardMaterial({ color: 0x1a232e, roughness: 0.38, metalness: 0.85 }))
  // Instanced meshes are tracked too: their dispose() frees the per-instance buffers.
  const placeAll = (mesh: THREE.InstancedMesh, items: THREE.Matrix4[]) => {
    track(mesh)
    items.forEach((m, i) => mesh.setMatrixAt(i, m))
    mesh.instanceMatrix.needsUpdate = true
    group.add(mesh)
  }

  // Rear server racks (instanced), leaving the centre clear behind the identity.
  const RACK_Z = -19.5
  const rackXs: number[] = []
  for (let x = -13.2; x <= 13.2; x += 1.6) if (Math.abs(x) > 4) rackXs.push(x)
  const rackGeo = track(new THREE.BoxGeometry(1.25, 4.4, 1))
  placeAll(
    new THREE.InstancedMesh(rackGeo, metal, rackXs.length),
    rackXs.map((x) => new THREE.Matrix4().makeTranslation(x, 2.2, RACK_Z)),
  )
  // Status lights: three per rack, mostly cyan with an occasional amber.
  const ledGeo = track(new THREE.BoxGeometry(0.5, 0.05, 0.02))
  const ledMat = track(new THREE.MeshBasicMaterial({ color: 0xffffff }))
  const leds = new THREE.InstancedMesh(ledGeo, ledMat, rackXs.length * 3)
  const cyan = new THREE.Color(CYAN)
  const amber = new THREE.Color(AMBER)
  const ledMatrices: THREE.Matrix4[] = []
  rackXs.forEach((x, r) =>
    [1.2, 2.4, 3.6].forEach((y, j) => {
      const i = r * 3 + j
      ledMatrices.push(new THREE.Matrix4().makeTranslation(x, y, RACK_Z + 0.51))
      leds.setColorAt(i, (r * 7 + j * 3) % 11 === 0 ? amber : cyan)
    }),
  )
  placeAll(leds, ledMatrices)

  // Overhead structure: a ring rig over the pedestal on hangers, and two beams.
  const rig = new THREE.Group()
  const ring = new THREE.Mesh(track(new THREE.TorusGeometry(3, 0.12, 12, 96)), metal)
  ring.rotation.x = Math.PI / 2
  const inner = new THREE.Mesh(
    track(new THREE.TorusGeometry(2.7, 0.02, 6, 96)),
    track(new THREE.MeshBasicMaterial({ color: CYAN, transparent: true, opacity: 0.7 })),
  )
  inner.rotation.x = Math.PI / 2
  inner.position.y = -0.08
  rig.add(ring, inner)
  const hangerGeo = track(new THREE.CylinderGeometry(0.04, 0.04, 1.6, 8))
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4
    const hanger = new THREE.Mesh(hangerGeo, metal)
    hanger.position.set(Math.cos(a) * 3, 0.8, Math.sin(a) * 3)
    rig.add(hanger)
  }
  rig.position.set(0, 6.9, 2.5)
  group.add(rig)
  const beamGeo = track(new THREE.BoxGeometry(32, 0.6, 0.5))
  placeAll(
    new THREE.InstancedMesh(beamGeo, metal, 2),
    [-4, -12].map((z) => new THREE.Matrix4().makeTranslation(0, 9.1, z)),
  )

  // Restrained amber accents by the console (high tier only, like the hangar's point lights).
  if (high) {
    for (const x of [-3.5, 3.5]) {
      const l = new THREE.PointLight(AMBER, 10, 9, 2)
      l.position.set(x, 3.2, 7)
      lights.push(l)
    }
  }

  scene.add(group, ...lights)

  return {
    dispose() {
      scene.remove(group, ...lights)
      if (scene.environment === envTarget.texture) scene.environment = null
      for (const d of disposables) d.dispose()
    },
  }
}
