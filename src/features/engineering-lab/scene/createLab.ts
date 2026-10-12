import * as THREE from 'three'
import { homeDistance, moduleX } from './layout'

export type LabProject = { id: string; label: string }

export type LabOptions = {
  projects: LabProject[]
  reducedMotion: boolean
  maxPixelRatio?: number
  onSelect: (id: string) => void
  onHover: (id: string | null) => void
  onContextLost?: () => void
}

export type Lab = {
  setSelected: (id: string | null) => void
  setHighlighted: (id: string | null) => void
  dispose: () => void
  stats: () => { geometries: number; textures: number; frames: number }
}

const CYAN = new THREE.Color(0x36bffa)
const AMBER = new THREE.Color(0xf0ad62)
const OBSIDIAN = 0x0a0d12
const GRAPHITE = 0x1d2733

type LabModule = {
  id: string
  group: THREE.Group
  material: THREE.MeshStandardMaterial
  line: THREE.LineBasicMaterial
  glow: number
  lift: number
  baseY: number
}

/**
 * Three.js owns this scene: renderer, camera, lights, picking and the render loop.
 * The loop only runs while something is moving, so an idle scene costs nothing.
 */
export function createLab(canvas: HTMLCanvasElement, opts: LabOptions): Lab {
  const { projects, reducedMotion } = opts
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    powerPreference: 'high-performance',
  })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, opts.maxPixelRatio ?? 2))
  renderer.setClearColor(OBSIDIAN)

  const scene = new THREE.Scene()
  scene.fog = new THREE.Fog(OBSIDIAN, 9, 24)

  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 60)
  const camPos = new THREE.Vector3()
  const camTarget = new THREE.Vector3()
  const camPosGoal = new THREE.Vector3()
  const camTargetGoal = new THREE.Vector3()

  // Lighting
  scene.add(new THREE.HemisphereLight(0x9fb4c8, OBSIDIAN, 0.7))
  const key = new THREE.DirectionalLight(0xffffff, 1.1)
  key.position.set(4, 8, 6)
  scene.add(key)
  const rim = new THREE.PointLight(0x36bffa, 30, 16, 2)
  rim.position.set(0, 3.5, -3)
  scene.add(rim)

  // Floor
  const grid = new THREE.GridHelper(40, 40, 0x36bffa, GRAPHITE)
  const gridMaterials = Array.isArray(grid.material) ? grid.material : [grid.material]
  for (const m of gridMaterials) {
    m.transparent = true
    m.opacity = 0.28
  }
  scene.add(grid)

  const disposables: { dispose: () => void }[] = []
  const track = <T extends { dispose: () => void }>(o: T): T => {
    disposables.push(o)
    return o
  }

  // Project modules: a stack of "server" slabs on a pedestal.
  const slabGeo = track(new THREE.BoxGeometry(1.7, 0.5, 1.3))
  const edgeGeo = track(new THREE.EdgesGeometry(slabGeo))
  const baseGeo = track(new THREE.CylinderGeometry(1.7, 1.9, 0.16, 48))
  const baseMat = track(new THREE.MeshStandardMaterial({ color: 0x151c25, roughness: 0.7, metalness: 0.3 }))

  const modules: LabModule[] = projects.map((p, i) => {
    const group = new THREE.Group()
    group.position.x = moduleX(i, projects.length)
    group.userData.moduleId = p.id

    const base = new THREE.Mesh(baseGeo, baseMat)
    base.position.y = 0.08
    base.userData.moduleId = p.id
    group.add(base)

    const material = track(
      new THREE.MeshStandardMaterial({
        color: GRAPHITE,
        roughness: 0.45,
        metalness: 0.6,
        emissive: CYAN,
        emissiveIntensity: 0.12,
      }),
    )
    const line = track(new THREE.LineBasicMaterial({ color: CYAN, transparent: true, opacity: 0.8 }))
    const stack = new THREE.Group()
    for (let s = 0; s < 3; s++) {
      const slab = new THREE.Mesh(slabGeo, material)
      slab.position.y = 0.55 + s * 0.58
      slab.userData.moduleId = p.id
      const edges = new THREE.LineSegments(edgeGeo, line)
      edges.position.copy(slab.position)
      stack.add(slab, edges)
    }
    group.add(stack)
    scene.add(group)
    return { id: p.id, group, material, line, glow: 0.12, lift: 0, baseY: 0 }
  })

  // Pick against meshes only: line segments have a wide default raycast threshold.
  const pickables: THREE.Object3D[] = []
  for (const m of modules) m.group.traverse((o) => { if (o instanceof THREE.Mesh) pickables.push(o) })
  const raycaster = new THREE.Raycaster()
  const pointer = new THREE.Vector2()

  let selected: string | null = null
  let highlighted: string | null = null
  let hovered: string | null = null
  let raf = 0
  let disposed = false
  let frames = 0
  let last = 0

  const setCameraGoals = () => {
    const sel = modules.find((m) => m.id === selected)
    if (sel) {
      camPosGoal.set(sel.group.position.x, 2.6, 6)
      camTargetGoal.set(sel.group.position.x, 1.3, 0)
    } else {
      camPosGoal.set(0, 3.6, homeDistance(modules.length))
      camTargetGoal.set(0, 1.2, 0)
    }
  }
  setCameraGoals()
  camPos.copy(camPosGoal)
  camTarget.copy(camTargetGoal)

  const update = (dt: number): boolean => {
    const k = reducedMotion ? 1 : 1 - Math.exp(-dt * 10)
    const kc = reducedMotion ? 1 : 1 - Math.exp(-dt * 4)
    let moving = false
    for (const m of modules) {
      const isSel = m.id === selected
      const isHi = m.id === highlighted || m.id === hovered
      const glowGoal = isSel ? 0.9 : isHi ? 0.55 : 0.12
      const liftGoal = isSel ? 0.22 : isHi ? 0.12 : 0
      m.glow += (glowGoal - m.glow) * k
      m.lift += (liftGoal - m.lift) * k
      m.material.emissiveIntensity = m.glow
      m.material.emissive.copy(isSel ? AMBER : CYAN)
      m.line.color.copy(isSel ? AMBER : CYAN)
      m.group.position.y = m.baseY + m.lift
      if (Math.abs(glowGoal - m.glow) > 0.003 || Math.abs(liftGoal - m.lift) > 0.002) moving = true
    }
    camPos.lerp(camPosGoal, kc)
    camTarget.lerp(camTargetGoal, kc)
    if (camPos.distanceTo(camPosGoal) > 0.01 || camTarget.distanceTo(camTargetGoal) > 0.01) moving = true
    camera.position.copy(camPos)
    camera.lookAt(camTarget)
    return moving
  }

  const frame = (t: number) => {
    raf = 0
    if (disposed) return
    const dt = Math.min((t - last) / 1000, 0.1)
    last = t
    const moving = update(dt)
    renderer.render(scene, camera)
    frames++
    if (moving) requestFrame()
  }
  function requestFrame() {
    if (disposed || raf || document.hidden) return
    raf = requestAnimationFrame(frame)
  }

  const pick = (e: PointerEvent): string | null => {
    const r = canvas.getBoundingClientRect()
    pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1)
    raycaster.setFromCamera(pointer, camera)
    const hit = raycaster.intersectObjects(pickables, false)[0]
    return (hit?.object.userData.moduleId as string | undefined) ?? null
  }
  const onMove = (e: PointerEvent) => {
    const id = pick(e)
    if (id === hovered) return
    hovered = id
    canvas.style.cursor = id ? 'pointer' : 'default'
    opts.onHover(id)
    requestFrame()
  }
  const onLeave = () => {
    if (hovered === null) return
    hovered = null
    canvas.style.cursor = 'default'
    opts.onHover(null)
    requestFrame()
  }
  const onClick = (e: PointerEvent) => {
    const id = pick(e)
    if (id) opts.onSelect(id)
  }
  const onContextLost = (e: Event) => {
    e.preventDefault()
    opts.onContextLost?.()
  }
  const onVisibility = () => {
    if (!document.hidden) requestFrame()
  }

  const resize = () => {
    const w = canvas.clientWidth
    const h = canvas.clientHeight
    if (!w || !h) return
    renderer.setSize(w, h, false)
    camera.aspect = w / h
    camera.updateProjectionMatrix()
    requestFrame()
  }
  const ro = new ResizeObserver(resize)
  ro.observe(canvas)

  canvas.addEventListener('pointermove', onMove)
  canvas.addEventListener('pointerleave', onLeave)
  canvas.addEventListener('click', onClick as EventListener)
  canvas.addEventListener('webglcontextlost', onContextLost)
  document.addEventListener('visibilitychange', onVisibility)

  resize()
  requestFrame()

  return {
    setSelected(id) {
      selected = id
      setCameraGoals()
      requestFrame()
    },
    setHighlighted(id) {
      highlighted = id
      requestFrame()
    },
    stats: () => ({
      geometries: renderer.info.memory.geometries,
      textures: renderer.info.memory.textures,
      frames,
    }),
    dispose() {
      if (disposed) return
      disposed = true
      if (raf) cancelAnimationFrame(raf)
      ro.disconnect()
      canvas.removeEventListener('pointermove', onMove)
      canvas.removeEventListener('pointerleave', onLeave)
      canvas.removeEventListener('click', onClick as EventListener)
      canvas.removeEventListener('webglcontextlost', onContextLost)
      document.removeEventListener('visibilitychange', onVisibility)
      grid.geometry.dispose()
      for (const m of gridMaterials) m.dispose()
      for (const d of disposables) d.dispose()
      renderer.dispose()
      renderer.forceContextLoss()
    },
  }
}
