import * as THREE from 'three'
import type { NodeKind } from '../../../data/eduverse-graph'
import { buildCables, type CableEdge, type TraceState } from './cables'
import { createCameraRig } from './camera'
import { buildEnvironment } from './environment'
import { createModuleKit } from './modules'
import { detectQuality, maxPixelRatio } from './quality'

export type LabNode = { id: string; label: string; kind: NodeKind; pos: [number, number] }

export type LabOptions = {
  nodes: LabNode[]
  edges: CableEdge[]
  reducedMotion: boolean
  maxPixelRatio?: number
  onSelect: (id: string) => void
  onHover: (id: string | null) => void
  onContextLost?: () => void
}

export type Lab = {
  setSelected: (id: string | null) => void
  setHighlighted: (id: string | null) => void
  /** Node ids that should glow as part of an active trace. */
  setActiveNodes: (ids: string[]) => void
  /** Show a trace: the ordered edge ids and the current step (pulse plays on that edge). */
  setTrace: (trace: TraceState | null) => void
  dispose: () => void
  stats: () => { geometries: number; textures: number; frames: number; quality: string }
}

const CYAN = new THREE.Color(0x36bffa)
const AMBER = new THREE.Color(0xf0ad62)
const OBSIDIAN = 0x0a0d12

type LabModule = {
  id: string
  group: THREE.Group
  material: THREE.MeshStandardMaterial
  line: THREE.LineBasicMaterial
  label: HTMLElement
  glow: number
  lift: number
}

/**
 * Three.js owns this scene: renderer, camera, lights, picking, labels and the render
 * loop. The loop only runs while something is moving, so an idle scene costs nothing.
 */
export function createLab(canvas: HTMLCanvasElement, opts: LabOptions): Lab {
  const { nodes, edges, reducedMotion } = opts
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' })
  const quality = detectQuality()
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, opts.maxPixelRatio ?? 2, maxPixelRatio(quality)))
  renderer.setClearColor(OBSIDIAN)

  const scene = new THREE.Scene()
  const environment = buildEnvironment(scene, quality)
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 80)
  const rig = createCameraRig(camera, reducedMotion)

  const disposables: { dispose: () => void }[] = []
  const track = <T extends { dispose: () => void }>(o: T): T => (disposables.push(o), o)
  const kit = createModuleKit(track)
  const cables = buildCables(scene, nodes.map((n) => ({ id: n.id, pos: n.pos })), edges, reducedMotion)

  // Labels: a DOM overlay positioned from projected world coordinates (aria-hidden;
  // the accessible equivalent is the module list rendered by React).
  const stage = canvas.parentElement!
  const labelLayer = document.createElement('div')
  labelLayer.className = 'lab-labels'
  labelLayer.setAttribute('aria-hidden', 'true')
  stage.append(labelLayer)

  const modules: LabModule[] = nodes.map((n) => {
    const built = kit.build(n.kind, n.id)
    built.group.position.set(n.pos[0], 0, n.pos[1])
    scene.add(built.group)
    const label = document.createElement('span')
    label.className = 'lab-label'
    label.textContent = n.label
    labelLayer.append(label)
    return { id: n.id, group: built.group, material: built.material, line: built.line, label, glow: 0.12, lift: 0 }
  })
  const pickables: THREE.Object3D[] = []
  for (const m of modules) m.group.traverse((o) => { if (o instanceof THREE.Mesh) pickables.push(o) })
  const raycaster = new THREE.Raycaster()
  const pointer = new THREE.Vector2()

  let selected: string | null = null
  let highlighted: string | null = null
  let hovered: string | null = null
  let active = new Set<string>()
  let raf = 0
  let disposed = false
  let frames = 0
  let last = 0

  const setCameraGoals = () => {
    const sel = modules.find((m) => m.id === selected)
    if (sel) rig.focus(sel.group.position.x, sel.group.position.z)
    else rig.goHome()
  }

  const v = new THREE.Vector3()
  const updateLabels = () => {
    const w = canvas.clientWidth
    const h = canvas.clientHeight
    for (const m of modules) {
      v.set(m.group.position.x, 2.5 + m.lift, m.group.position.z).project(camera)
      const visible = v.z < 1 && Math.abs(v.x) < 1.1 && Math.abs(v.y) < 1.1
      m.label.style.opacity = visible ? '' : '0'
      m.label.style.transform = `translate(-50%, -100%) translate(${((v.x * 0.5 + 0.5) * w).toFixed(1)}px, ${((-v.y * 0.5 + 0.5) * h).toFixed(1)}px)`
      const on = m.id === selected || m.id === highlighted || m.id === hovered
      m.label.classList.toggle('is-on', on)
      m.label.classList.toggle('is-selected', m.id === selected)
    }
  }

  const update = (dt: number): boolean => {
    const k = reducedMotion ? 1 : 1 - Math.exp(-dt * 10)
    let moving = false
    for (const m of modules) {
      const isSel = m.id === selected
      const isHi = m.id === highlighted || m.id === hovered
      const isActive = active.has(m.id)
      const glowGoal = isSel ? 0.9 : isActive ? 0.75 : isHi ? 0.55 : 0.12
      const liftGoal = isSel ? 0.22 : isHi ? 0.12 : 0
      m.glow += (glowGoal - m.glow) * k
      m.lift += (liftGoal - m.lift) * k
      m.material.emissiveIntensity = m.glow
      m.material.emissive.copy(isSel ? AMBER : CYAN)
      m.line.color.copy(isSel ? AMBER : CYAN)
      m.group.position.y = m.lift
      if (Math.abs(glowGoal - m.glow) > 0.003 || Math.abs(liftGoal - m.lift) > 0.002) moving = true
    }
    if (rig.update(dt)) moving = true
    if (cables.update(dt)) moving = true
    return moving
  }

  const frame = (t: number) => {
    raf = 0
    if (disposed) return
    const dt = Math.min((t - last) / 1000, 0.1)
    last = t
    const moving = update(dt)
    renderer.render(scene, camera)
    updateLabels()
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
    setActiveNodes(ids) {
      active = new Set(ids)
      requestFrame()
    },
    setTrace(trace) {
      cables.setTrace(trace)
      requestFrame()
    },
    stats: () => ({
      geometries: renderer.info.memory.geometries,
      textures: renderer.info.memory.textures,
      frames,
      quality,
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
      labelLayer.remove()
      cables.dispose()
      environment.dispose()
      for (const d of disposables) d.dispose()
      renderer.dispose()
      renderer.forceContextLoss()
    },
  }
}
