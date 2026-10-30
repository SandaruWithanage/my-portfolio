import * as THREE from 'three'
import type { Quality } from '../../engineering-lab/scene/quality'

const CYAN = 0x36bffa
const AMBER = 0xf0ad62

/** Where the hub's main objects stand on the floor. */
const PEDESTAL = { x: 0, z: 2.5, r: 3.6 }
const RACKS = { z: -19.5, w: 28, d: 2.6 }
/** The two workstations either side of the console (monitor clusters and their work lights). */
const STATION = { x: 5.4, z: 1.2 }
/**
 * Amber work lights, placed on the floor the visitor actually sees at the default
 * camera: the strips below the lower navigation panels (verified by projecting
 * through the hub camera; the workstations themselves sit behind those panels).
 */
const WORK_LIGHT = { x: 3.6, z: 0.8 }

/** Soft radial falloff, white at the centre; used as an alpha map so one texture serves every shadow and glow. */
function softTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const g = c.getContext('2d')
  if (g) {
    const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64)
    grad.addColorStop(0, 'rgba(255,255,255,1)')
    grad.addColorStop(0.55, 'rgba(255,255,255,0.45)')
    grad.addColorStop(1, 'rgba(255,255,255,0)')
    g.fillStyle = grad
    g.fillRect(0, 0, 128, 128)
  }
  return new THREE.CanvasTexture(c)
}

/**
 * Hub-only grounding and depth, layered over the shared hangar without changing it:
 * contact shadows under the main objects, a hub lighting retune (applied to this
 * scene's own light instances and restored on dispose), amber work lights over the
 * bench on both tiers, and a small set of foreground, middle-ground and background
 * details. Everything is static, so none of it asks the render loop for frames.
 */
export function buildProps(scene: THREE.Scene, quality: Quality) {
  const high = quality === 'high'
  const group = new THREE.Group()
  const lights: THREE.Light[] = []
  const disposables: { dispose: () => void }[] = []
  const track = <T extends { dispose: () => void }>(o: T): T => (disposables.push(o), o)
  const soft = track(softTexture())

  // Materials: painted panelling, structural metal, rubber, glass and dim displays.
  const painted = track(new THREE.MeshStandardMaterial({ color: 0x151d27, roughness: 0.72, metalness: 0.25 }))
  const structural = track(new THREE.MeshStandardMaterial({ color: 0x0d1218, roughness: 0.55, metalness: 0.6 }))
  const rubber = track(new THREE.MeshStandardMaterial({ color: 0x07090c, roughness: 0.95, metalness: 0 }))
  const glass = track(new THREE.MeshStandardMaterial({ color: 0x0a1a24, roughness: 0.08, metalness: 0.1, transparent: true, opacity: 0.35 }))
  const display = track(new THREE.MeshBasicMaterial({ color: CYAN, transparent: true, opacity: 0.12 }))

  // --- Grounding: contact shadows (multiply-darkening via a black, alpha-mapped plane).
  const shadowMat = track(new THREE.MeshBasicMaterial({ color: 0x000000, alphaMap: soft, transparent: true, opacity: 0.75, depthWrite: false }))
  const shadowGeo = track(new THREE.PlaneGeometry(1, 1))
  const shadow = (x: number, z: number, sx: number, sz: number, opacity = 1) => {
    const m = opacity === 1 ? shadowMat : track(shadowMat.clone())
    if (opacity !== 1) m.opacity = shadowMat.opacity * opacity
    const s = new THREE.Mesh(shadowGeo, m)
    s.rotation.x = -Math.PI / 2
    s.position.set(x, 0.012, z)
    s.scale.set(sx, sz, 1)
    s.renderOrder = 1
    group.add(s)
  }
  shadow(PEDESTAL.x, PEDESTAL.z, PEDESTAL.r * 2.4, PEDESTAL.r * 2.4)
  shadow(0, RACKS.z + 0.6, RACKS.w, RACKS.d, 0.9)

  // --- Lighting retune for this scene only: cooler, dimmer fill so the room is not one tone.
  const retuned: { light: THREE.Light; intensity: number; color?: THREE.Color }[] = []
  scene.traverse((o) => {
    const l = o as THREE.Light
    if (!l.isLight) return
    if ((l as THREE.HemisphereLight).isHemisphereLight) {
      retuned.push({ light: l, intensity: l.intensity, color: l.color.clone() })
      l.intensity *= 0.6
      l.color.set(0x7f95ab)
    } else if ((l as THREE.DirectionalLight).isDirectionalLight) {
      retuned.push({ light: l, intensity: l.intensity })
      l.intensity *= 0.75
    }
  })

  // --- Amber work lights on the exposed floor beside the console. High tier: two real lights. Low
  // tier: no per-pixel lights (as in the hangar); glow pools on the floor stand in.
  const glowMat = track(new THREE.MeshBasicMaterial({ color: AMBER, alphaMap: soft, transparent: true, opacity: high ? 0.26 : 0.3, blending: THREE.AdditiveBlending, depthWrite: false }))
  for (const side of [-1, 1]) {
    if (high) {
      const l = new THREE.PointLight(AMBER, 12, 7, 2)
      l.position.set(side * WORK_LIGHT.x, 3.2, WORK_LIGHT.z)
      lights.push(l)
    }
    const pool = new THREE.Mesh(shadowGeo, glowMat)
    pool.rotation.x = -Math.PI / 2
    pool.position.set(side * WORK_LIGHT.x, 0.02, WORK_LIGHT.z)
    pool.scale.set(3.2, 2.6, 1)
    group.add(pool)
  }

  // --- Foreground: equipment silhouettes at the lower corners of the frame, plus
  // cable runs on the floor leading from the racks to the console.
  for (const side of [-1, 1]) {
    // Placed so they cut into the lower corners of the frame at the default viewpoint.
    const cabinet = new THREE.Mesh(track(new THREE.BoxGeometry(1.2, 2.4, 1)), structural)
    cabinet.position.set(side * 3.3, 1.2, 6.2)
    cabinet.rotation.y = side * -0.25
    const cap = new THREE.Mesh(track(new THREE.CylinderGeometry(0.3, 0.3, 0.5, 16)), painted)
    cap.position.set(side * 3.2, 2.65, 6.15)
    group.add(cabinet, cap)
    shadow(side * 3.3, 6.2, 2.2, 2, 0.7)
  }
  const cableRuns: [number, number][][] = [
    [[-6, -18.5], [-5.2, -10], [-3.8, -3], [-2.2, 1.2]],
    [[5.5, -18.5], [4.6, -9], [3.2, -2.5], [2.1, 1.4]],
    [[-1, -18.5], [-0.6, -9], [0.4, -3], [0.9, 0.6]],
  ]
  for (const run of cableRuns) {
    const curve = new THREE.CatmullRomCurve3(run.map(([x, z]) => new THREE.Vector3(x, 0.05, z)))
    group.add(new THREE.Mesh(track(new THREE.TubeGeometry(curve, high ? 48 : 24, 0.05, 6)), rubber))
  }

  // --- Middle ground: a monitor cluster on a stand either side of the console.
  const postGeo = track(new THREE.CylinderGeometry(0.05, 0.07, 1.6, 8))
  const frameGeo = track(new THREE.BoxGeometry(1.15, 0.7, 0.06))
  const paneGeo = track(new THREE.PlaneGeometry(1.05, 0.6))
  for (const side of [-1, 1]) {
    const cluster = new THREE.Group()
    const post = new THREE.Mesh(postGeo, structural)
    post.position.y = 0.8
    cluster.add(post)
    ;[
      [0, 1.65, 0],
      [-0.62 * side, 1.65, 0.2],
    ].forEach(([x, y, r]) => {
      const frame = new THREE.Mesh(frameGeo, structural)
      frame.position.set(x, y, 0)
      frame.rotation.y = r * side
      const pane = new THREE.Mesh(paneGeo, glass)
      pane.position.set(0, 0, 0.035)
      const screen = new THREE.Mesh(paneGeo, display)
      screen.position.set(0, 0, 0.031)
      frame.add(screen, pane)
      cluster.add(frame)
    })
    cluster.position.set(side * STATION.x, 0, STATION.z)
    cluster.rotation.y = side * -0.55
    group.add(cluster)
    shadow(side * STATION.x, STATION.z, 1.6, 1.6, 0.6)
  }

  // --- Background: painted wall panels with seams behind the racks.
  const panelGeo = track(new THREE.BoxGeometry(3.85, 4.3, 0.08))
  const panelXs: number[] = []
  for (let x = -14; x <= 14; x += 4) panelXs.push(x)
  const panels = track(new THREE.InstancedMesh(panelGeo, painted, panelXs.length * 2))
  const m = new THREE.Matrix4()
  let i = 0
  for (const y of [2.25, 6.65]) for (const x of panelXs) panels.setMatrixAt(i++, m.makeTranslation(x, y, -21.9))
  panels.instanceMatrix.needsUpdate = true
  group.add(panels)

  scene.add(group, ...lights)

  return {
    dispose() {
      scene.remove(group, ...lights)
      for (const r of retuned) {
        r.light.intensity = r.intensity
        if (r.color) r.light.color.copy(r.color)
      }
      for (const d of disposables) d.dispose()
    },
  }
}
