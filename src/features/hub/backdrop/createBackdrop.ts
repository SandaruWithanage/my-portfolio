import * as THREE from 'three'
import { buildEnvironment } from '../../engineering-lab/scene/environment'
import { detectQuality, maxPixelRatio } from '../../engineering-lab/scene/quality'
import { FOCUS_YAW, lookAngles } from './look'
import { graphNodes } from '../../../data/eduverse-graph'
import { PEDESTAL_Z } from '../../engineering-lab/scene/environment'
import { buildCore } from './core'
import { monitorOn, monitorsSettleMs, shouldDraw } from './sequence'
import { buildWorkshop } from './workshop'

export type BackdropOptions = {
  reducedMotion: boolean
  /** Optional GLTF/GLB lab model (must be licensed for the site). Loaded lazily on the high tier. */
  modelUrl?: string | null
  onContextLost?: () => void
}

export type Backdrop = {
  /** Pointer position in [-0.5, 0.5]; the camera eases toward it. */
  look: (x: number, y: number) => void
  /** Turn toward a destination's side of the room (-1 left, 1 right, 0 centre). */
  focus: (side: number) => void
  /** Dormant (dim) or online (lit); the change fades in unless motion is reduced. */
  setOnline: (online: boolean) => void
  /** Stop rendering while hidden behind an open screen. */
  setPaused: (paused: boolean) => void
  dispose: () => void
  stats: () => { frames: number; quality: string }
}

const OBSIDIAN = 0x0a0d12
const CYAN = 0x36bffa
const EYE = new THREE.Vector3(0, 3.4, 11)
const TARGET = new THREE.Vector3(0, 3.0, -8)
const DORMANT_EXPOSURE = 0.22
const ONLINE_EXPOSURE = 1

/**
 * The hub's room: the same procedural hangar as the Engineering Workshop, framed
 * from operator height behind a curved workbench. Purely decorative (the canvas is
 * aria-hidden) and rendered on demand: frames are drawn only while the camera eases
 * or the lights fade, never while paused or the tab is hidden.
 */
export function createBackdrop(canvas: HTMLCanvasElement, opts: BackdropOptions): Backdrop {
  const quality = detectQuality()
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: quality === 'high', powerPreference: 'high-performance' })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, maxPixelRatio(quality)))
  renderer.setClearColor(OBSIDIAN)
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = DORMANT_EXPOSURE

  const scene = new THREE.Scene()
  const environment = buildEnvironment(scene, quality, { emblem: false })
  const workshop = buildWorkshop(scene, renderer, quality)
  // Centerpiece: EduVerse's architecture on the pedestal (pedestal top is at y 0.3).
  const core = buildCore(scene, graphNodes, new THREE.Vector3(0, 0.3, PEDESTAL_Z))
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 80)

  const disposables: { dispose: () => void }[] = []
  const track = <T extends { dispose: () => void }>(o: T): T => (disposables.push(o), o)

  // Curved operator workbench in the foreground, with dim monitors on it.
  const bench = new THREE.Group()
  const benchMat = track(new THREE.MeshStandardMaterial({ color: 0x18222d, roughness: 0.35, metalness: 0.7 }))
  const top = new THREE.Mesh(track(new THREE.CylinderGeometry(3.2, 3.2, 0.1, 64, 1, true, -1, 2)), benchMat)
  top.rotation.y = Math.PI
  const edge = new THREE.Mesh(
    track(new THREE.TorusGeometry(3.2, 0.02, 6, 64, 2)),
    track(new THREE.MeshBasicMaterial({ color: CYAN })),
  )
  edge.rotation.set(Math.PI / 2, 0, Math.PI / 2 - 1)
  edge.position.y = 0.07
  bench.add(top, edge)
  // Each monitor has its own materials so they can power on one at a time.
  const screenGeo = track(new THREE.PlaneGeometry(1.1, 0.62))
  const frameGeo = track(new THREE.EdgesGeometry(screenGeo))
  const monitors: { screen: THREE.MeshBasicMaterial; frame: THREE.LineBasicMaterial; level: number }[] = []
  for (const a of [-0.75, -0.28, 0.28, 0.75]) {
    const screen = track(new THREE.MeshBasicMaterial({ color: CYAN, transparent: true, opacity: 0, side: THREE.DoubleSide }))
    const frame = track(new THREE.LineBasicMaterial({ color: CYAN, transparent: true, opacity: 0 }))
    monitors.push({ screen, frame, level: 0 })
    const s = new THREE.Mesh(screenGeo, screen)
    s.add(new THREE.LineSegments(frameGeo, frame))
    s.position.set(Math.sin(a) * 2.9, 0.42, -Math.cos(a) * 2.9)
    s.lookAt(0, 0.42, 0)
    bench.add(s)
  }
  bench.position.set(0, 2.2, 9.8)
  scene.add(bench)

  // Optional authored model, never on the low tier.
  let disposed = false
  if (opts.modelUrl && quality === 'high') {
    import('three/examples/jsm/loaders/GLTFLoader.js')
      .then(({ GLTFLoader }) => new GLTFLoader().loadAsync(opts.modelUrl!))
      .then((gltf) => {
        if (disposed) return
        scene.add(gltf.scene)
        gltf.scene.traverse((o) => {
          const mesh = o as THREE.Mesh
          if (mesh.isMesh) {
            track(mesh.geometry)
            const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
            mats.forEach((m) => track(m))
          }
        })
        requestFrame()
      })
      .catch(() => {
        // The procedural room stays; a missing model is not an error for visitors.
      })
  }

  // State the loop eases toward.
  const yaw = { now: 0, goal: 0 }
  // The camera's yaw goal is the pointer's look plus any destination focus.
  let lookYaw = 0
  let focusYaw = 0
  const pitch = { now: 0, goal: 0 }
  const exposure = { now: DORMANT_EXPOSURE, goal: DORMANT_EXPOSURE }
  let online = false
  let onlineAt = 0
  let paused = false
  let raf = 0
  let last = 0
  let frames = 0
  let lastDraw = 0
  let coreTime = 0
  const instant = opts.reducedMotion
  // The core turns only on the high tier with motion allowed; otherwise it holds a still pose.
  const spin = quality === 'high' && !instant
  core.update(0)

  const place = () => {
    // Orbit the eye slightly around the target: a head turn, not a fly-through.
    const offset = EYE.clone().sub(TARGET)
    offset.applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw.now)
    offset.applyAxisAngle(new THREE.Vector3(1, 0, 0), pitch.now)
    camera.position.copy(TARGET).add(offset)
    camera.lookAt(TARGET)
  }

  const step = (t: number) => {
    raf = 0
    if (disposed || paused || document.hidden) return
    const dt = last ? Math.min((t - last) / 1000, 0.1) : 1 / 60
    last = t
    const k = instant ? 1 : 1 - Math.exp(-dt * 3.5)
    const kLight = instant ? 1 : 1 - Math.exp(-dt * 2.5)
    yaw.now += (yaw.goal - yaw.now) * k
    pitch.now += (pitch.goal - pitch.now) * k
    exposure.now += (exposure.goal - exposure.now) * kLight
    renderer.toneMappingExposure = exposure.now
    const elapsed = t - onlineAt
    let monitorsMoving = false
    monitors.forEach((m, i) => {
      const goal = online && (instant || monitorOn(i, elapsed)) ? 1 : 0
      m.level += (goal - m.level) * (instant ? 1 : 1 - Math.exp(-dt * 9))
      if (Math.abs(goal - m.level) > 1e-3) monitorsMoving = true
      // Dormant monitors keep a faint outline so the desk still reads.
      m.screen.opacity = 0.02 + m.level * 0.16
      m.frame.opacity = 0.12 + m.level * 0.5
    })
    const transitioning =
      Math.abs(yaw.goal - yaw.now) > 1e-4 ||
      Math.abs(pitch.goal - pitch.now) > 1e-4 ||
      Math.abs(exposure.goal - exposure.now) > 1e-3 ||
      monitorsMoving ||
      (online && elapsed < monitorsSettleMs(monitors.length))
    const ambient = spin && online
    if (ambient) coreTime += dt
    if (shouldDraw(transitioning, t - lastDraw)) {
      lastDraw = t
      core.update(coreTime)
      place()
      renderer.render(scene, camera)
      frames++
    }
    if (transitioning || ambient) raf = requestAnimationFrame(step)
    else last = 0
  }
  function requestFrame() {
    if (!raf && !disposed && !paused) raf = requestAnimationFrame(step)
  }

  const resize = () => {
    const w = canvas.clientWidth
    const h = canvas.clientHeight
    if (!w || !h) return
    renderer.setSize(w, h, false)
    camera.aspect = w / h
    // Narrow screens: widen the view so the bench and room stay readable.
    camera.fov = w / h < 1 ? 58 : 42
    camera.updateProjectionMatrix()
    requestFrame()
  }
  const ro = new ResizeObserver(resize)
  ro.observe(canvas)
  const onContextLost = (e: Event) => {
    e.preventDefault()
    opts.onContextLost?.()
  }
  const onVisibility = () => {
    if (!document.hidden) requestFrame()
  }
  canvas.addEventListener('webglcontextlost', onContextLost)
  document.addEventListener('visibilitychange', onVisibility)
  resize()
  requestFrame()

  return {
    look(x, y) {
      if (instant) return
      const a = lookAngles(x, y)
      lookYaw = a.yaw
      yaw.goal = lookYaw + focusYaw
      pitch.goal = a.pitch
      requestFrame()
    },
    focus(side) {
      if (instant) return
      focusYaw = -Math.sign(side) * FOCUS_YAW
      yaw.goal = lookYaw + focusYaw
      requestFrame()
    },
    setOnline(next) {
      if (next && !online) onlineAt = performance.now()
      online = next
      exposure.goal = online ? ONLINE_EXPOSURE : DORMANT_EXPOSURE
      requestFrame()
    },
    setPaused(p) {
      paused = p
      if (p && raf) {
        cancelAnimationFrame(raf)
        raf = 0
      }
      last = 0
      requestFrame()
    },
    stats: () => ({ frames, quality }),
    dispose() {
      if (disposed) return
      disposed = true
      if (raf) cancelAnimationFrame(raf)
      ro.disconnect()
      canvas.removeEventListener('webglcontextlost', onContextLost)
      document.removeEventListener('visibilitychange', onVisibility)
      core.dispose()
      workshop.dispose()
      environment.dispose()
      for (const d of disposables) d.dispose()
      renderer.dispose()
      renderer.forceContextLoss()
    },
  }
}
