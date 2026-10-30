import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { MOVE, cameraRelative, seek, step, type Body, type MoveIntent } from '../actors/controller'
import { ARRIVAL_RAIL, createFollowCamera, easeInOut } from '../actors/followCamera'
import { proceduralRobot, robotFromGltf, type Emote, type Robot } from '../actors/robot'
import type { SoundManager } from '../audio/SoundManager'
import { arrived as tourArrived, next as tourNext, previous as tourPrev, setPaused as tourSetPaused, startTour, tick as tourTick, tourStops, type TourState } from '../cinematics/tour'
import { EXHIBIT_BLOCKS, INTERACTABLES, SOUND_SPOTS } from '../content/interactables'
import { makeCooldowns, resolveTarget } from '../interactions/resolver'
import { buildStructure } from '../world/building'
import { DOOR_BOX, DOOR_TRIGGER, ROOMS, WALLS, contains, neighbors, roomAt, type Rect, type RoomId, type Vec2 } from '../world/layout'
import { PALETTE, createMaterials } from '../world/materials'
import { planRoute } from '../world/navigation'
import { buildRoom, type RoomVisual } from '../world/rooms'
import { MANIFEST, fetchWithProgress, type Progress } from './assets'
import { TIER_SETTINGS, createAutoTier, type Tier } from './quality'

export type EngineEvent =
  | ({ type: 'progress' } & Progress)
  | { type: 'ready'; robot: 'model' | 'procedural'; warning?: string }
  | { type: 'error'; message: string }
  | { type: 'arrival-done' }
  | { type: 'door-trigger' }
  | { type: 'door-opened' }
  | { type: 'entered'; room: RoomId }
  | { type: 'target'; id: string | null }
  | { type: 'interact'; id: string }
  | { type: 'tour'; index: number; stage: 'travel' | 'hold' | 'done' }
  | { type: 'position'; x: number; z: number; heading: number; room: RoomId | null }
  | { type: 'tier'; tier: Tier }
  | { type: 'context-lost' }

export type EngineOptions = {
  tier: Tier
  autoQuality: boolean
  reducedMotion: boolean
  sensitivity: number
  invertY: boolean
  sound: SoundManager
  onEvent: (e: EngineEvent) => void
}

export type EngineStats = {
  fps: number
  frameMs: number
  calls: number
  triangles: number
  geometries: number
  textures: number
  room: RoomId | null
  tier: Tier
  roomsBuilt: number
  robot: 'model' | 'procedural' | 'none'
}

type Mode = 'idle' | 'arrival' | 'play' | 'tour' | 'door'

const isTextField = (el: EventTarget | null) =>
  el instanceof HTMLElement && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName))

export function createEngine(canvas: HTMLCanvasElement, opts: EngineOptions) {
  const disposables: { dispose: () => void }[] = []
  const track = <T extends { dispose: () => void }>(o: T): T => (disposables.push(o), o)
  const emit = opts.onEvent

  let tier = opts.tier
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: tier !== 'low', powerPreference: 'high-performance' })
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.25
  renderer.shadowMap.enabled = TIER_SETTINGS[tier].shadows
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
  const applyPixelRatio = () => renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, TIER_SETTINGS[tier].pixelRatio))
  applyPixelRatio()

  const scene = new THREE.Scene()
  scene.background = new THREE.Color(PALETTE.night)
  scene.fog = new THREE.FogExp2(PALETTE.night, 0.006)
  const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 400)

  const mats = createMaterials(track)
  const structure = buildStructure(scene, mats, track, tier)
  const follow = createFollowCamera(camera, WALLS)
  const rooms = new Map<RoomId, RoomVisual>()
  const ensureRoom = (id: RoomId) => {
    if (rooms.has(id) || !ROOMS[id].inside || id === 'airlock') return
    const visual = buildRoom(id, mats, track, tier)
    if (visual) {
      rooms.set(id, visual)
      scene.add(visual.group)
    }
  }

  let robot: Robot | null = null
  let body: Body = { x: ROOMS.exterior.spawn.x, z: ROOMS.exterior.spawn.z, vx: 0, vz: 0, heading: ROOMS.exterior.facing }
  let mode: Mode = 'idle'
  let doorOpen = false
  let doorAnim = -1 // ms since the door sequence started, or -1
  let currentRoom: RoomId | null = 'exterior'
  let target: string | null = null
  let active = false
  let raf = 0
  let last = 0
  let elapsed = 0
  let arrivalT = -1
  let inputEnabled = true
  let traceY: number | null = null
  let layerFocus: number | null = null
  const harpFlash = Array<number>(7).fill(0)
  const padFlash = Array<number>(4).fill(0)
  let lastHarp = -1
  const padCooldown = makeCooldowns(380)
  const interactCooldown = makeCooldowns(450)
  const stops = tourStops()
  let tour: TourState | null = null
  let tourPath: Vec2[] = []
  const auto = opts.autoQuality ? createAutoTier(tier) : null
  let reducedMotion = opts.reducedMotion
  let sensitivity = opts.sensitivity
  let invertY = opts.invertY

  // --- Input ------------------------------------------------------------------
  const keys = new Set<string>()
  const stick = { x: 0, y: 0, run: false }
  const onKeyDown = (e: KeyboardEvent) => {
    if (isTextField(e.target) || e.metaKey || e.ctrlKey || e.altKey) return
    const k = e.key.toLowerCase()
    if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'shift'].includes(k)) {
      keys.add(k)
      if (k.startsWith('arrow')) e.preventDefault()
    }
    if (k === 'e' || (k === 'enter' && (e.target === document.body || e.target === canvas))) api.interact()
  }
  const onKeyUp = (e: KeyboardEvent) => keys.delete(e.key.toLowerCase())
  const onBlur = () => keys.clear()
  let dragging: { id: number; x: number; y: number } | null = null
  const onPointerDown = (e: PointerEvent) => {
    if (e.pointerType === 'touch') return // touch look is handled by the mobile controls
    dragging = { id: e.pointerId, x: e.clientX, y: e.clientY }
    canvas.setPointerCapture(e.pointerId)
  }
  const onPointerMove = (e: PointerEvent) => {
    if (!dragging || dragging.id !== e.pointerId) return
    api.look(e.clientX - dragging.x, e.clientY - dragging.y)
    dragging.x = e.clientX
    dragging.y = e.clientY
  }
  const onPointerUp = (e: PointerEvent) => {
    if (dragging?.id === e.pointerId) dragging = null
  }
  const onWheel = (e: WheelEvent) => {
    e.preventDefault()
    follow.zoom(Math.sign(e.deltaY) * 0.6)
  }
  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('keyup', onKeyUp)
  window.addEventListener('blur', onBlur)
  canvas.addEventListener('pointerdown', onPointerDown)
  canvas.addEventListener('pointermove', onPointerMove)
  canvas.addEventListener('pointerup', onPointerUp)
  canvas.addEventListener('pointercancel', onPointerUp)
  canvas.addEventListener('wheel', onWheel, { passive: false })

  /** True while the player is mainly moving forward: only then may the camera swing in behind. */
  let forwardish = false
  const readIntent = (): MoveIntent => {
    let x = stick.x
    let y = stick.y
    if (keys.has('w') || keys.has('arrowup')) y += 1
    if (keys.has('s') || keys.has('arrowdown')) y -= 1
    if (keys.has('d') || keys.has('arrowright')) x += 1
    if (keys.has('a') || keys.has('arrowleft')) x -= 1
    x = Math.max(-1, Math.min(1, x))
    y = Math.max(-1, Math.min(1, y))
    // Strafing or backing up keeps the camera steady (otherwise "left" would keep rotating).
    forwardish = y > 0.5 && Math.abs(x) < 0.5
    const dir = cameraRelative({ x, y }, follow.yaw)
    return { ...dir, run: keys.has('shift') || stick.run }
  }

  const boxes = (): Rect[] => (doorOpen ? [...WALLS, ...EXHIBIT_BLOCKS] : [...WALLS, ...EXHIBIT_BLOCKS, DOOR_BOX])

  // --- Resize / context loss ---------------------------------------------------
  const resize = () => {
    const w = canvas.clientWidth
    const h = canvas.clientHeight
    if (!w || !h) return
    renderer.setSize(w, h, false)
    camera.aspect = w / h
    camera.fov = w / h < 0.8 ? 68 : 55
    camera.updateProjectionMatrix()
  }
  const ro = new ResizeObserver(resize)
  ro.observe(canvas)
  resize()
  const onContextLost = (e: Event) => {
    e.preventDefault()
    stopLoop()
    emit({ type: 'context-lost' })
  }
  canvas.addEventListener('webglcontextlost', onContextLost)
  const onVisibility = () => {
    if (document.hidden) stopLoop()
    else if (active) startLoop()
    opts.sound.setSuspended(document.hidden || !active)
  }
  document.addEventListener('visibilitychange', onVisibility)

  // --- Helpers -----------------------------------------------------------------
  const placeAt = (room: RoomId) => {
    const r = ROOMS[room]
    body = { x: r.spawn.x, z: r.spawn.z, vx: 0, vz: 0, heading: r.facing }
    if (r.inside) {
      doorOpen = true
      structure.setDoorOpen(1)
    }
    currentRoom = room
    ensureRoom(room)
    for (const n of neighbors(room)) ensureRoom(n)
    follow.snapBehind(r.facing)
    robot?.root.position.set(body.x, 0, body.z)
    if (robot) robot.root.rotation.y = body.heading
  }

  const startDoorSequence = () => {
    if (doorOpen || mode === 'door') return
    mode = 'door'
    doorAnim = 0
    emit({ type: 'door-trigger' })
    if (reducedMotion) doorAnim = 99999
  }

  // --- Frame -------------------------------------------------------------------
  let fpsFrames = 0
  let fpsTime = 0
  let fps = 0
  let frameMs = 0
  let posEmit = 0

  const frame = (now: number) => {
    raf = active && !document.hidden ? requestAnimationFrame(frame) : 0
    const rawDt = last ? (now - last) / 1000 : 1 / 60
    last = now
    const dt = Math.min(rawDt, 0.1)
    elapsed += dt
    const t = elapsed

    // 1. Input / director → movement
    let intent: MoveIntent = { x: 0, z: 0, run: false }
    if (mode === 'play' && inputEnabled) intent = readIntent()
    if (mode === 'tour' && tour && !tour.paused) {
      if (tour.stage === 'travel') {
        const goal = tourPath[0]
        if (!goal) {
          tour = tourArrived(tour, stops)
          emit({ type: 'tour', index: tour.index, stage: tour.stage })
        } else if (reducedMotion) {
          placeAt(stops[tour.index].room)
          tourPath = []
        } else {
          const s = seek(body, goal)
          intent = s.intent
          if (s.arrived) tourPath.shift()
        }
      } else if (tour.stage === 'hold') {
        const before = tour.index
        tour = tourTick(tour, stops, dt * 1000)
        if (tour.index !== before || tour.stage === 'done') {
          emit({ type: 'tour', index: tour.index, stage: tour.stage })
          if (tour.stage === 'travel') tourPath = planRoute(body, roomAt(body) ?? 'atrium', stops[tour.index].room)
        }
      }
    }
    if (mode === 'play' || mode === 'tour') body = step(body, intent, dt, boxes())
    else body = { ...body, vx: 0, vz: 0 }

    // 2. Door sequence: scan (1.4 s) → panels open (1.0 s) → collision removed.
    if (mode === 'door') {
      doorAnim += dt * 1000
      const scanP = Math.min(1, doorAnim / 1400)
      structure.setScan(doorAnim < 1400 ? scanP : -1, body.x, body.z)
      const openP = THREE.MathUtils.clamp((doorAnim - 1400) / 1000, 0, 1)
      structure.setDoorOpen(easeInOut(openP))
      if (openP >= 1) {
        doorOpen = true
        structure.setScan(-1, 0, 0)
        mode = 'play'
        emit({ type: 'door-opened' })
      }
    } else if (mode === 'play' && !doorOpen && contains(DOOR_TRIGGER, body)) {
      startDoorSequence()
    }

    // 3. Rooms: entering, lazy building of neighbours
    const room = roomAt(body)
    if (room && room !== currentRoom) {
      currentRoom = room
      ensureRoom(room)
      for (const n of neighbors(room)) ensureRoom(n)
      emit({ type: 'entered', room })
    }

    // 4. Sound Lab: harp strings crossed and pads stepped on (only while moving freely)
    if (room === 'sound' && (mode === 'play' || mode === 'tour')) {
      const h = SOUND_SPOTS.harp
      if (Math.abs(body.z - h.z) < 0.5 && Math.abs(body.x - h.x) <= h.width / 2 + 0.2) {
        const i = Math.round(((body.x - (h.x - h.width / 2)) / h.width) * 6)
        if (i !== lastHarp) api.pluck(i)
        lastHarp = i
      } else lastHarp = -1
      for (let i = 0; i < 4; i++) {
        const px = SOUND_SPOTS.pads.x + (i % 2 ? 0.8 : -0.8)
        const pz = SOUND_SPOTS.pads.z + (i < 2 ? -0.8 : 0.8)
        if (Math.hypot(body.x - px, body.z - pz) < 0.55 && padCooldown.ready(`pad${i}`, now)) api.pad(i)
      }
    }
    for (let i = 0; i < harpFlash.length; i++) harpFlash[i] = Math.max(0, harpFlash[i] - dt * 2.5)
    for (let i = 0; i < padFlash.length; i++) padFlash[i] = Math.max(0, padFlash[i] - dt * 3)

    // 5. Interaction focus
    if (mode === 'play' || mode === 'tour') {
      const next = resolveTarget(body, body.heading, INTERACTABLES, target)
      if (next !== target) {
        target = next
        emit({ type: 'target', id: target })
      }
    } else if (target !== null) {
      target = null
      emit({ type: 'target', id: null })
    }

    // 6. Robot transform + animation
    const speed = Math.hypot(body.vx, body.vz)
    if (robot) {
      robot.root.position.set(body.x, 0, body.z)
      robot.root.rotation.y = body.heading
      robot.update(dt, speed, t)
    }

    // 7. Camera: arrival rail, or follow
    const inside = ROOMS[room ?? 'exterior']?.inside ?? false
    if (mode === 'arrival') {
      arrivalT += dt * 1000
      const p = reducedMotion ? 1 : Math.min(1, arrivalT / ARRIVAL_RAIL.durationMs)
      follow.update({ ...body, moving: false }, false, dt, now, false)
      const endPos = camera.position.clone()
      const endLook = new THREE.Vector3(body.x, 1.7, body.z)
      const e = easeInOut(p)
      const a = e < 0.5 ? ARRIVAL_RAIL.from : ARRIVAL_RAIL.via
      const b = e < 0.5 ? ARRIVAL_RAIL.via : { pos: endPos, look: endLook }
      const k = e < 0.5 ? e * 2 : (e - 0.5) * 2
      camera.position.lerpVectors(a.pos, b.pos, k)
      camera.lookAt(new THREE.Vector3().lerpVectors(a.look, b.look, k))
      if (p > 0.55) robot?.setDormant(false)
      if (p >= 1) {
        mode = 'play'
        emit({ type: 'arrival-done' })
      }
    } else {
      const realign = speed > 0.4 && (mode === 'tour' || forwardish)
      follow.update({ x: body.x, z: body.z, heading: body.heading, moving: realign }, inside, dt, now, !reducedMotion)
    }

    // 8. World updates
    const ctx = { t, robot: { x: body.x, z: body.z }, focus: target, sound: opts.sound, harpFlash, padFlash, traceY, layerFocus }
    for (const r of rooms.values()) r.update(ctx)
    structure.update(t, camera.position.z)

    // 9. Render
    renderer.render(scene, camera)

    // 10. Diagnostics, auto quality, position for the map (5 Hz)
    frameMs = frameMs * 0.9 + rawDt * 1000 * 0.1
    fpsFrames++
    fpsTime += rawDt
    if (fpsTime >= 1) {
      fps = Math.round(fpsFrames / fpsTime)
      fpsFrames = 0
      fpsTime = 0
    }
    if (auto) {
      const next = auto.sample(rawDt * 1000)
      if (next !== tier) api.setTier(next)
    }
    posEmit += dt
    if (posEmit > 0.2) {
      posEmit = 0
      emit({ type: 'position', x: body.x, z: body.z, heading: body.heading, room: room })
    }
  }

  function startLoop() {
    if (raf || document.hidden) return
    last = 0
    raf = requestAnimationFrame(frame)
  }
  function stopLoop() {
    if (raf) cancelAnimationFrame(raf)
    raf = 0
  }

  // --- Public API ----------------------------------------------------------------
  const abort = new AbortController()
  const api = {
    /** Load critical assets with real progress. Resolves when the world can be entered. */
    async load() {
      emit({ type: 'progress', loaded: 0, total: MANIFEST.length + 1, unit: 'items', label: 'Building the lab' })
      ensureRoom('atrium')
      let warning: string | undefined
      try {
        const entry = MANIFEST[0]
        const buf = await fetchWithProgress(
          entry.url,
          (loaded, total) =>
            emit(total ? { type: 'progress', loaded, total, unit: 'bytes', label: 'Downloading robot' } : { type: 'progress', loaded: 1, total: 2, unit: 'items', label: 'Downloading robot' }),
          abort.signal,
        )
        const gltf = await new GLTFLoader().parseAsync(buf, '')
        robot = robotFromGltf(gltf, mats, track)
      } catch (err) {
        if (abort.signal.aborted) return
        warning = `Robot model unavailable (${err instanceof Error ? err.message : 'load failed'}); using the built-in robot.`
        robot = proceduralRobot(mats, track)
      }
      scene.add(robot.root)
      placeAt('exterior')
      robot.setDormant(true)
      // First frame so the canvas is never blank behind the boot screen.
      follow.update({ ...body, moving: false }, false, 0, 0, false)
      structure.update(0, camera.position.z)
      renderer.render(scene, camera)
      emit({ type: 'progress', loaded: MANIFEST.length + 1, total: MANIFEST.length + 1, unit: 'items', label: 'Ready' })
      emit({ type: 'ready', robot: robot.kind, warning })
    },
    beginArrival() {
      placeAt('exterior')
      doorOpen = false
      structure.setDoorOpen(0)
      robot?.setDormant(true)
      arrivalT = 0
      mode = 'arrival'
    },
    skipArrival() {
      if (mode !== 'arrival') return
      robot?.setDormant(false)
      mode = 'play'
      emit({ type: 'arrival-done' })
    },
    /** Skip the door and go straight inside (skip intro / deep link). */
    enterAt(room: RoomId) {
      robot?.setDormant(false)
      placeAt(room)
      mode = 'play'
      emit({ type: 'entered', room })
    },
    finishDoor() {
      if (mode !== 'door') return
      doorAnim = 99999
    },
    teleport(room: RoomId) {
      api.enterAt(room)
    },
    startTour(index = 0) {
      if (!doorOpen) {
        doorOpen = true
        structure.setDoorOpen(1)
      }
      tour = startTour(index)
      tourPath = planRoute(body, roomAt(body) ?? 'atrium', stops[index].room)
      mode = 'tour'
      emit({ type: 'tour', index, stage: 'travel' })
    },
    tourControl(cmd: 'pause' | 'resume' | 'next' | 'prev' | 'stop') {
      if (!tour) return
      if (cmd === 'stop') {
        tour = null
        tourPath = []
        mode = 'play'
        return
      }
      if (cmd === 'pause' || cmd === 'resume') tour = tourSetPaused(tour, cmd === 'pause')
      else {
        tour = cmd === 'next' ? tourNext(tour, stops) : tourPrev(tour)
        if (tour.stage === 'travel') tourPath = planRoute(body, roomAt(body) ?? 'atrium', stops[tour.index].room)
      }
      emit({ type: 'tour', index: tour.index, stage: tour.stage })
    },
    setActive(on: boolean) {
      active = on
      if (on) startLoop()
      else {
        stopLoop()
        keys.clear()
      }
      opts.sound.setSuspended(!on)
    },
    setInputEnabled(on: boolean) {
      inputEnabled = on
      if (!on) keys.clear()
    },
    interact() {
      if (!target || (mode !== 'play' && mode !== 'tour')) return
      if (!interactCooldown.ready(target, performance.now())) return
      const it = INTERACTABLES.find((i) => i.id === target)
      robot?.emote(it?.kind === 'comms' ? 'Wave' : it?.kind === 'project' || it?.kind === 'featured' ? 'ThumbsUp' : 'Yes')
      emit({ type: 'interact', id: target })
    },
    emote(name: Emote) {
      robot?.emote(name)
    },
    setStick(x: number, y: number, run: boolean) {
      stick.x = x
      stick.y = y
      stick.run = run
    },
    look(dxPx: number, dyPx: number) {
      const k = 0.0045 * sensitivity
      follow.orbit(dxPx * k, (invertY ? -dyPx : dyPx) * k, performance.now())
    },
    pluck(i: number) {
      opts.sound.pluck(i)
      if (i >= 0 && i < harpFlash.length) harpFlash[i] = 1
    },
    pad(i: number) {
      const tracks = ['kick', 'snare', 'hat', 'kick'] as const
      opts.sound.drum(tracks[i] ?? 'kick')
      if (i >= 0 && i < padFlash.length) padFlash[i] = 1
    },
    setTrace(height: number | null) {
      traceY = height
    },
    setLayerFocus(i: number | null) {
      layerFocus = i
    },
    setTier(next: Tier) {
      if (next === tier) return
      tier = next
      applyPixelRatio()
      resize()
      renderer.shadowMap.enabled = TIER_SETTINGS[tier].shadows
      emit({ type: 'tier', tier })
    },
    setPrefs(p: { reducedMotion?: boolean; sensitivity?: number; invertY?: boolean }) {
      if (p.reducedMotion !== undefined) reducedMotion = p.reducedMotion
      if (p.sensitivity !== undefined) sensitivity = p.sensitivity
      if (p.invertY !== undefined) invertY = p.invertY
    },
    getStats(): EngineStats {
      return {
        fps,
        frameMs: Math.round(frameMs * 10) / 10,
        calls: renderer.info.render.calls,
        triangles: renderer.info.render.triangles,
        geometries: renderer.info.memory.geometries,
        textures: renderer.info.memory.textures,
        room: currentRoom,
        tier,
        roomsBuilt: rooms.size,
        robot: robot?.kind ?? 'none',
      }
    },
    /** Test/QA hook: current body state. */
    getBody() {
      return { ...body, mode, doorOpen }
    },
    dispose() {
      abort.abort()
      stopLoop()
      ro.disconnect()
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', onBlur)
      canvas.removeEventListener('pointerdown', onPointerDown)
      canvas.removeEventListener('pointermove', onPointerMove)
      canvas.removeEventListener('pointerup', onPointerUp)
      canvas.removeEventListener('pointercancel', onPointerUp)
      canvas.removeEventListener('wheel', onWheel)
      canvas.removeEventListener('webglcontextlost', onContextLost)
      document.removeEventListener('visibilitychange', onVisibility)
      robot?.dispose()
      for (const d of disposables) d.dispose()
      renderer.dispose()
      renderer.forceContextLoss()
    },
  }
  return api
}

export type Engine = ReturnType<typeof createEngine>
export const TOUR_STOPS = tourStops
export const MOVE_TUNING = MOVE
