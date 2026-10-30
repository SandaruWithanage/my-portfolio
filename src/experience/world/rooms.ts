import * as THREE from 'three'
import { graphNodes } from '../../data/eduverse-graph'
import { buildCore } from '../../features/hub/backdrop/core'
import type { SoundManager } from '../audio/SoundManager'
import { STEPS, TRACKS } from '../audio/music'
import { companionExhibits, coreLayers, identity, projectExhibits, skillExhibits, type SkillCategory } from '../content/adapters'
import {
  CORE_CENTER,
  COMMS_SPOT,
  DIRECTORY_SPOT,
  FEATURED_SPOT,
  GALLERY_SPOTS,
  INTERACTABLES,
  LAYER_SPOTS,
  SOUND_SPOTS,
  TRACE_SPOT,
  benchSpots,
} from '../content/interactables'
import type { Tier } from '../engine/quality'
import { ROOMS, type RoomId, type Vec2 } from './layout'
import { ACCENT, PALETTE, screenTexture, signTexture, type Materials } from './materials'
import { markDynamic, mergeStatic } from './merge'

type Tracker = <T extends { dispose: () => void }>(o: T) => T

export type RoomContext = {
  t: number
  robot: Vec2
  focus: string | null
  sound: SoundManager
  /** Recently struck harp strings / drum pads (0..1 flash levels). */
  harpFlash: number[]
  padFlash: number[]
  traceY: number | null
  layerFocus: number | null
}

export type RoomVisual = { id: RoomId; group: THREE.Group; update(ctx: RoomContext): void }

/** Height (relative to the pedestal top) of each core tier, matching buildCore. */
const TIER_Y = [0.45, 0.85, 1.35, 1.85]
export const CORE_PEDESTAL_TOP = 0.3

export function buildRoom(id: RoomId, mats: Materials, track: Tracker, tier: Tier): RoomVisual | null {
  const unit = track(new THREE.BoxGeometry(1, 1, 1))
  const group = new THREE.Group()
  group.name = `room-${id}`
  const updaters: ((ctx: RoomContext) => void)[] = []

  const box = (w: number, h: number, d: number, mat: THREE.Material, x: number, y: number, z: number) => {
    const m = new THREE.Mesh(unit, mat)
    m.scale.set(w, h, d)
    m.position.set(x, y, z)
    m.castShadow = tier === 'high'
    m.receiveShadow = true
    group.add(m)
    return m
  }
  const screen = (lines: string[], accent: number, w: number, h: number) =>
    new THREE.Mesh(track(new THREE.PlaneGeometry(w, h)), track(new THREE.MeshBasicMaterial({ map: track(screenTexture(lines, accent)), toneMapped: false })))
  const sign = (title: string, sub: string, accent: number, w: number, h: number) =>
    new THREE.Mesh(track(new THREE.PlaneGeometry(w, h)), track(new THREE.MeshBasicMaterial({ map: track(signTexture(title, sub, accent)), toneMapped: false })))
  const pointLight = (color: number, intensity: number, x: number, y: number, z: number, dist = 12) => {
    if (tier === 'low') return
    const l = new THREE.PointLight(color, intensity, dist, 1.8)
    l.position.set(x, y, z)
    group.add(l)
  }
  const accent = ACCENT[ROOMS[id].accent]

  // Interaction beacons: a floating diamond and a floor ring for every interactable in
  // this room — visible affordance, amber and larger while focused.
  const beaconGeo = track(new THREE.OctahedronGeometry(0.16, 0))
  const ringGeo = track(new THREE.RingGeometry(0.75, 0.85, 40))
  for (const it of INTERACTABLES.filter((i) => i.room === id)) {
    const diamondMat = mats.emissive(PALETTE.cyan, 2)
    const diamond = new THREE.Mesh(beaconGeo, diamondMat)
    const baseY = it.kind === 'directory' ? 3.6 : it.kind === 'core-trace' ? 2.3 : 2.4
    diamond.position.set(it.x, baseY, it.z)
    const ringMat = mats.holo(PALETTE.cyan, 0.0)
    const ring = new THREE.Mesh(ringGeo, ringMat)
    ring.rotation.x = -Math.PI / 2
    ring.position.set(it.x, 0.02, it.z)
    ring.scale.setScalar(Math.max(1, it.radius * 0.45))
    group.add(markDynamic(diamond), markDynamic(ring))
    updaters.push(({ t, focus, robot }) => {
      const on = focus === it.id
      const near = Math.hypot(robot.x - it.x, robot.z - it.z) < it.radius + 3
      diamond.position.y = baseY + Math.sin(t * 2 + it.x) * 0.1
      diamond.rotation.y = t * 1.5
      diamond.scale.setScalar(on ? 1.5 : 1)
      diamondMat.emissive.setHex(on ? PALETTE.amber : PALETTE.cyan)
      ringMat.color.setHex(on ? PALETTE.amber : PALETTE.cyan)
      ringMat.opacity = on ? 0.6 : near ? 0.22 : 0
    })
  }

  switch (id) {
    case 'atrium': {
      // Central directory: pedestal, counter-rotating holo rings and a floating screen.
      const d = DIRECTORY_SPOT
      box(2.2, 0.5, 2.2, mats.metalDark, d.x, 0.25, d.z)
      box(1.6, 0.12, 1.6, mats.trim.cyan, d.x, 0.52, d.z)
      const rings = [1.0, 1.35].map((r, i) => {
        const m = new THREE.Mesh(track(new THREE.TorusGeometry(r, 0.025, 8, 80)), mats.holo(PALETTE.cyan, 0.7))
        m.position.set(d.x, 1.4 + i * 0.5, d.z)
        m.rotation.x = Math.PI / 2
        group.add(markDynamic(m))
        return m
      })
      const dir = screen(['LAB DIRECTORY', '◂ Skills Bay      west', '▸ Project Gallery  east', '▴ Architecture Core north', '  Sound Lab · Comms beyond'], PALETTE.cyan, 3.2, 2)
      dir.position.set(d.x, 2.6, d.z + 0.2)
      const dirBack = dir.clone()
      dirBack.rotation.y = Math.PI
      dirBack.position.z = d.z - 0.2
      group.add(dir, dirBack)
      updaters.push(({ t }) => {
        rings[0].rotation.z = t * 0.6
        rings[1].rotation.z = -t * 0.4
        rings[1].rotation.y = Math.sin(t * 0.5) * 0.2
      })
      // Identity wall either side of the north corridor.
      const who = sign(identity.name, identity.role, PALETTE.cyan, 5.2, 1.3)
      who.position.set(-5.6, 3.2, -3.78)
      const tag = sign(identity.tagline, 'Full-stack systems · made visible', PALETTE.amber, 5.2, 1.3)
      tag.position.set(5.6, 3.2, -3.78)
      group.add(who, tag)
      // Featured project plinth just inside the entrance.
      const f = FEATURED_SPOT
      const plinth = new THREE.Mesh(track(new THREE.CylinderGeometry(0.62, 0.72, 1, 6)), mats.metal)
      plinth.position.set(f.x, 0.5, f.z)
      group.add(plinth)
      const holo = new THREE.Mesh(track(new THREE.IcosahedronGeometry(0.45, 1)), mats.wire(PALETTE.amber, 0.85))
      holo.position.set(f.x, 1.55, f.z)
      group.add(markDynamic(holo))
      const featured = projectExhibits()[0]
      if (featured) {
        const lbl = sign(`Featured · ${featured.title}`, featured.status, PALETTE.amber, 2.6, 0.65)
        lbl.position.set(f.x, 2.55, f.z + 0.01)
        lbl.rotation.y = Math.PI * 0.12
        group.add(lbl)
      }
      const fGlow = new THREE.Mesh(track(new THREE.PlaneGeometry(3.4, 3.4)), mats.glow(PALETTE.amber, 0.28))
      fGlow.rotation.x = -Math.PI / 2
      fGlow.position.set(f.x, 0.015, f.z)
      group.add(fGlow)
      updaters.push(({ t }) => {
        holo.rotation.set(t * 0.4, t * 0.7, 0)
      })
      // Benches for scale.
      box(2.8, 0.45, 0.8, mats.metalDark, 6, 0.22, 9.4)
      box(2.8, 0.45, 0.8, mats.metalDark, 6, 0.22, -1.6)
      pointLight(PALETTE.cyan, 10, d.x, 3.4, d.z, 10)
      break
    }

    case 'skills': {
      skillExhibits().forEach((sk, i) => {
        const spot = benchSpots[i]
        if (!spot) return
        const bench = new THREE.Group()
        bench.position.set(spot.x, 0, spot.z)
        bench.rotation.y = spot.rot
        const top = new THREE.Mesh(unit, mats.metal)
        top.scale.set(2.8, 0.1, 1.1)
        top.position.y = 0.95
        bench.add(top)
        for (const lx of [-1.25, 1.25]) {
          const leg = new THREE.Mesh(unit, mats.metalDark)
          leg.scale.set(0.12, 0.95, 0.9)
          leg.position.set(lx, 0.47, 0)
          bench.add(leg)
        }
        const edge = new THREE.Mesh(unit, mats.trim.cyan)
        edge.scale.set(2.8, 0.03, 0.03)
        edge.position.set(0, 0.92, 0.56)
        bench.add(edge)
        const scr = screen([sk.label.toUpperCase(), ...sk.items.slice(0, 4)], accent, 2.2, 1.35)
        scr.position.set(0, 1.85, -0.5)
        bench.add(scr)
        const prop = markDynamic(categoryProp(sk.category, mats, track))
        prop.position.y = 1.0
        bench.add(prop)
        const lamp = new THREE.Mesh(track(new THREE.PlaneGeometry(3.4, 2.4)), mats.glow(PALETTE.cyan, 0.0))
        lamp.rotation.x = -Math.PI / 2
        lamp.position.y = 0.02
        bench.add(lamp)
        group.add(bench)
        const lampMat = lamp.material as THREE.MeshBasicMaterial
        updaters.push(({ t, robot }) => {
          // Benches power on as the robot approaches.
          const near = Math.hypot(robot.x - spot.x, robot.z - spot.z)
          const on = THREE.MathUtils.clamp(1 - (near - 2) / 4, 0.15, 1)
          lampMat.opacity = 0.35 * on
          prop.rotation.y = t * 0.35 * on
          ;(scr.material as THREE.MeshBasicMaterial).color.setScalar(0.45 + on * 0.55)
        })
      })
      const banner = sign('Skills Bay', 'one bench per skill group', accent, 6, 1.5)
      banner.position.set(-24.78, 3.4, 4)
      banner.rotation.y = Math.PI / 2
      group.add(banner)
      pointLight(PALETTE.cyan, 12, -18.5, 3.8, 4, 14)
      break
    }

    case 'gallery': {
      const main = GALLERY_SPOTS.main
      const plinth = new THREE.Mesh(track(new THREE.CylinderGeometry(1.1, 1.25, 0.9, 6)), mats.metal)
      plinth.position.set(main.x, 0.45, main.z)
      group.add(plinth)
      box(2.1, 0.04, 2.1, mats.trim.amber, main.x, 0.92, main.z)
      const caseGlass = new THREE.Mesh(track(new THREE.BoxGeometry(1.9, 1.8, 1.9)), mats.glass)
      caseGlass.position.set(main.x, 1.85, main.z)
      group.add(caseGlass)
      // A miniature of the EduVerse stack inside the case: tiers of rings and modules.
      const mini = new THREE.Group()
      mini.position.set(main.x, 1.1, main.z)
      ;[0.75, 0.6, 0.45].forEach((r, i) => {
        const ring = new THREE.Mesh(track(new THREE.TorusGeometry(r, 0.025, 6, 48)), mats.holo(i === 1 ? PALETTE.amber : PALETTE.cyan, 0.85))
        ring.rotation.x = Math.PI / 2
        ring.position.y = 0.3 + i * 0.45
        mini.add(ring)
        for (let k = 0; k < 3; k++) {
          const blk = new THREE.Mesh(unit, mats.emissive(i === 1 ? PALETTE.amber : PALETTE.cyan, 0.8))
          const a = (k / 3) * Math.PI * 2
          blk.scale.setScalar(0.14)
          blk.position.set(Math.cos(a) * r, 0.3 + i * 0.45, Math.sin(a) * r)
          mini.add(blk)
        }
      })
      group.add(markDynamic(mini))
      const project = projectExhibits()[0]
      if (project) {
        const title = sign(project.title, project.status, PALETTE.amber, 4.2, 1.05)
        title.position.set(main.x - 0.02, 3.6, main.z)
        title.rotation.y = -Math.PI / 2
        group.add(title)
        const stack = screen(['STACK', ...project.technologies.slice(0, 5)], PALETTE.amber, 2.4, 1.5)
        stack.position.set(24.78, 2.2, main.z)
        stack.rotation.y = -Math.PI / 2
        group.add(stack)
      }
      companionExhibits.forEach((c, i) => {
        const spot = GALLERY_SPOTS.companions[i]
        box(1.1, 1, 1.1, mats.metalDark, spot.x, 0.5, spot.z)
        const icon = i === 0 ? new THREE.Mesh(track(new THREE.IcosahedronGeometry(0.35, 0)), mats.wire(PALETTE.cyan, 0.9)) : new THREE.Mesh(unit, mats.wire(PALETTE.cyan, 0.9))
        if (i === 1) icon.scale.set(0.6, 0.4, 0.5)
        icon.position.set(spot.x, 1.45, spot.z)
        group.add(markDynamic(icon))
        const lbl = sign(c.title, 'inspect', PALETTE.cyan, 2.6, 0.62)
        lbl.position.set(24.78, 2.6, spot.z)
        lbl.rotation.y = -Math.PI / 2
        group.add(lbl)
        updaters.push(({ t }) => {
          icon.rotation.y = t * 0.6 + i
        })
      })
      const banner = sign('Project Gallery', 'real, shipped work', accent, 6, 1.5)
      banner.position.set(18.5, 3.6, 11.78)
      banner.rotation.y = Math.PI
      group.add(banner)
      updaters.push(({ t }) => {
        mini.rotation.y = t * 0.3
      })
      pointLight(PALETTE.amber, 16, main.x, 3.8, main.z, 10)
      break
    }

    case 'core': {
      const pedestal = new THREE.Mesh(track(new THREE.CylinderGeometry(2.4, 2.7, CORE_PEDESTAL_TOP, 48)), mats.metalDark)
      pedestal.position.set(CORE_CENTER.x, CORE_PEDESTAL_TOP / 2, CORE_CENTER.z)
      group.add(pedestal)
      const coreScene = new THREE.Scene()
      const core = buildCore(coreScene, graphNodes, new THREE.Vector3(CORE_CENTER.x, CORE_PEDESTAL_TOP, CORE_CENTER.z), { particles: tier === 'high' })
      const coreGroup = markDynamic(new THREE.Group())
      coreGroup.add(...coreScene.children)
      group.add(coreGroup)
      // Layer highlight ring and a request-trace orb.
      const layerRing = new THREE.Mesh(track(new THREE.TorusGeometry(2.05, 0.05, 8, 72)), mats.holo(PALETTE.amber, 0.9))
      layerRing.rotation.x = Math.PI / 2
      layerRing.position.set(CORE_CENTER.x, 0, CORE_CENTER.z)
      layerRing.visible = false
      const orb = new THREE.Mesh(track(new THREE.SphereGeometry(0.16, 16, 12)), mats.emissive(PALETTE.amber, 3))
      orb.visible = false
      group.add(markDynamic(layerRing), markDynamic(orb))
      coreLayers().forEach((l, i) => {
        const spot = LAYER_SPOTS[i]
        if (!spot) return
        box(0.9, 1.05, 0.6, mats.metal, spot.x, 0.52, spot.z)
        const scr = screen([l.title.toUpperCase(), ...l.nodes.map((n) => n.label)], PALETTE.blue, 1.4, 0.9)
        scr.position.set(spot.x, 1.55, spot.z)
        scr.lookAt(CORE_CENTER.x, 1.55, CORE_CENTER.z)
        scr.rotateY(Math.PI)
        group.add(scr)
      })
      box(2.2, 0.95, 0.8, mats.metal, TRACE_SPOT.x, 0.47, TRACE_SPOT.z)
      const traceScr = screen(['REQUEST TRACES', 'tenant request', 'offline sync', 'public site'], PALETTE.amber, 2.2, 1.2)
      traceScr.position.set(TRACE_SPOT.x, 1.75, TRACE_SPOT.z - 0.1)
      group.add(traceScr)
      const banner = sign('Architecture Core', 'EduVerse, layer by layer', accent, 6, 1.5)
      banner.position.set(0, 3.9, -22.78)
      group.add(banner)
      updaters.push(({ t, traceY, layerFocus }) => {
        core.update(t)
        orb.visible = traceY !== null
        if (traceY !== null) orb.position.set(CORE_CENTER.x + Math.sin(t * 6) * 0.25, CORE_PEDESTAL_TOP + traceY, CORE_CENTER.z + Math.cos(t * 6) * 0.25)
        layerRing.visible = layerFocus !== null
        if (layerFocus !== null) layerRing.position.y = CORE_PEDESTAL_TOP + TIER_Y[3 - layerFocus]
      })
      pointLight(PALETTE.blue, 18, CORE_CENTER.x, 4, CORE_CENTER.z, 14)
      break
    }

    case 'sound': {
      // Laser harp: a frame with seven light beams across the walkway.
      const h = SOUND_SPOTS.harp
      box(0.25, 3.4, 0.25, mats.metal, h.x - h.width / 2 - 0.3, 1.7, h.z)
      box(0.25, 3.4, 0.25, mats.metal, h.x + h.width / 2 + 0.3, 1.7, h.z)
      box(h.width + 0.85, 0.2, 0.3, mats.metal, h.x, 3.4, h.z)
      const beamMats: THREE.MeshBasicMaterial[] = []
      for (let i = 0; i < 7; i++) {
        const mat = mats.holo(PALETTE.violet, 0.45)
        beamMats.push(mat)
        const beam = new THREE.Mesh(track(new THREE.CylinderGeometry(0.035, 0.035, 3.2, 8)), mat)
        beam.position.set(h.x - h.width / 2 + (i * h.width) / 6, 1.7, h.z)
        group.add(beam)
      }
      // Drum pads: four floor pads, two rows.
      const padMats: THREE.MeshStandardMaterial[] = []
      const padColors = [PALETTE.violet, PALETTE.cyan, PALETTE.amber, PALETTE.green]
      for (let i = 0; i < 4; i++) {
        const mat = mats.emissive(padColors[i], 0.5)
        padMats.push(mat)
        const pad = new THREE.Mesh(track(new THREE.CylinderGeometry(0.6, 0.65, 0.08, 32)), mat)
        pad.position.set(SOUND_SPOTS.pads.x + (i % 2 ? 0.8 : -0.8), 0.04, SOUND_SPOTS.pads.z + (i < 2 ? -0.8 : 0.8))
        group.add(pad)
      }
      // Sequencer wall: 16 × 4 lights on the west wall — one instanced draw call,
      // each cell's colour set per instance.
      const cellGeo = track(new THREE.PlaneGeometry(0.42, 0.34))
      const cellMesh = track(new THREE.InstancedMesh(cellGeo, track(new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false })), TRACKS.length * STEPS))
      const cellM = new THREE.Matrix4()
      const cellQ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2)
      const cellColor = new THREE.Color()
      TRACKS.forEach((_, r) => {
        for (let c = 0; c < STEPS; c++) {
          cellM.compose(new THREE.Vector3(SOUND_SPOTS.sequencer.x - 0.45, 3.0 - r * 0.45, SOUND_SPOTS.sequencer.z - 3.8 + c * 0.5), cellQ, new THREE.Vector3(1, 1, 1))
          cellMesh.setMatrixAt(r * STEPS + c, cellM)
          cellMesh.setColorAt(r * STEPS + c, cellColor.setHex(0x1b1530))
        }
      })
      cellMesh.instanceMatrix.needsUpdate = true
      group.add(markDynamic(cellMesh))
      box(0.12, 2.2, 8.6, mats.metalDark, SOUND_SPOTS.sequencer.x - 0.55, 2.3, SOUND_SPOTS.sequencer.z)
      // Speaker stacks for scale and mood.
      for (const z of [-21.6, -9.4]) {
        box(1, 2.2, 1, mats.rubber, -13.2, 1.1, z)
        const cone = new THREE.Mesh(track(new THREE.CircleGeometry(0.3, 24)), mats.emissive(PALETTE.violet, 0.6))
        cone.position.set(-13.2 - 0.51, 1.5, z)
        cone.rotation.y = -Math.PI / 2
        group.add(cone)
      }
      const banner = sign('Sound Lab', 'play · sound is opt-in', accent, 6, 1.5)
      banner.position.set(-18.5, 3.9, -22.78)
      group.add(banner)
      const colours = { kick: PALETTE.violet, snare: PALETTE.cyan, hat: PALETTE.amber, synth: PALETTE.green }
      updaters.push(({ sound, harpFlash, padFlash }) => {
        beamMats.forEach((m, i) => (m.opacity = 0.35 + harpFlash[i] * 0.65))
        padMats.forEach((m, i) => (m.emissiveIntensity = 0.5 + padFlash[i] * 3))
        TRACKS.forEach((tr, r) => {
          for (let c = 0; c < STEPS; c++) {
            const on = sound.pattern[tr][c]
            const head = sound.playing && sound.playhead === c
            cellColor.setHex(on && head ? 0xffffff : on ? colours[tr] : head ? 0x3a2d66 : 0x1b1530)
            cellMesh.setColorAt(r * STEPS + c, cellColor)
          }
        })
        if (cellMesh.instanceColor) cellMesh.instanceColor.needsUpdate = true
      })
      pointLight(PALETTE.violet, 16, -18.5, 3.8, -15.5, 14)
      break
    }

    case 'comms': {
      const c = COMMS_SPOT
      box(1.2, 1, 3.4, mats.metal, c.x + 0.6, 0.5, c.z)
      const links = ['COMMS', 'email', 'github', 'linkedin']
      const scr = screen(links, PALETTE.green, 2.8, 1.6)
      scr.position.set(c.x + 1.2, 1.95, c.z)
      scr.rotation.y = -Math.PI / 2
      group.add(scr)
      // Antenna array on a mast, slowly sweeping.
      box(0.3, 3.2, 0.3, mats.metalDark, 23.6, 1.6, -11)
      const dish = new THREE.Mesh(track(new THREE.SphereGeometry(1.2, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.32)), mats.metal)
      dish.position.set(23.6, 3.4, -11)
      dish.rotation.x = -Math.PI / 2.4
      const tip = new THREE.Mesh(track(new THREE.SphereGeometry(0.09, 12, 8)), mats.emissive(PALETTE.green, 3))
      tip.position.set(23.6, 3.6, -10.6)
      group.add(markDynamic(dish), markDynamic(tip))
      for (let i = 0; i < 3; i++) box(0.9, 1.8, 0.5, mats.metalDark, 24, 0.9, -20.5 + i * 1.1)
      const banner = sign('Comms Room', 'open a channel', accent, 6, 1.5)
      banner.position.set(18.5, 3.9, -22.78)
      group.add(banner)
      updaters.push(({ t }) => {
        dish.rotation.z = Math.sin(t * 0.4) * 0.5
        ;(tip.material as THREE.MeshStandardMaterial).emissiveIntensity = 1 + (Math.sin(t * 4) > 0.6 ? 3 : 0)
      })
      pointLight(PALETTE.green, 14, 18.5, 3.8, -15.5, 14)
      break
    }

    default:
      return null
  }

  mergeStatic(group, track)
  return { id, group, update: (ctx) => updaters.forEach((u) => u(ctx)) }
}

/** Small sculptural metaphor on each skill bench. */
function categoryProp(cat: SkillCategory, mats: Materials, track: Tracker): THREE.Group {
  const g = new THREE.Group()
  const unit = track(new THREE.BoxGeometry(1, 1, 1))
  switch (cat) {
    case 'languages':
      for (let i = 0; i < 4; i++) {
        const slab = new THREE.Mesh(unit, i % 2 ? mats.metal : mats.emissive(PALETTE.cyan, 0.7))
        slab.scale.set(0.7 - i * 0.1, 0.08, 0.5 - i * 0.06)
        slab.position.y = 0.1 + i * 0.12
        g.add(slab)
      }
      break
    case 'backend': {
      const nodes = [
        [0, 0.35, 0],
        [-0.45, 0.2, -0.2],
        [0.45, 0.2, -0.2],
        [-0.3, 0.55, 0.2],
        [0.3, 0.55, 0.2],
      ]
      const sphere = track(new THREE.SphereGeometry(0.08, 12, 8))
      for (const [x, y, z] of nodes) {
        const n = new THREE.Mesh(sphere, mats.emissive(PALETTE.cyan, 1.5))
        n.position.set(x, y, z)
        g.add(n)
        if (x !== 0) {
          // A link from the hub node (0, 0.35, 0) to this node, aligned along their direction.
          const dir = new THREE.Vector3(x, y - 0.35, z)
          const link = new THREE.Mesh(track(new THREE.CylinderGeometry(0.012, 0.012, dir.length(), 6)), mats.holo(PALETTE.cyan, 0.7))
          link.position.set(x / 2, (y + 0.35) / 2, z / 2)
          link.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize())
          g.add(link)
        }
      }
      break
    }
    case 'frontend':
      for (let i = 0; i < 3; i++) {
        const p = new THREE.Mesh(track(new THREE.PlaneGeometry(0.7, 0.45)), mats.holo(i === 1 ? PALETTE.amber : PALETTE.cyan, 0.45))
        p.position.set(-0.12 + i * 0.12, 0.3 + i * 0.12, -0.1 + i * 0.1)
        g.add(p)
      }
      break
    case 'data':
      for (let i = 0; i < 3; i++) {
        const c = new THREE.Mesh(track(new THREE.CylinderGeometry(0.16, 0.16, 0.42, 20)), mats.metal)
        c.position.set(-0.4 + i * 0.4, 0.21, 0)
        const ring = new THREE.Mesh(track(new THREE.TorusGeometry(0.165, 0.012, 6, 24)), mats.emissive(PALETTE.cyan, 1.5))
        ring.rotation.x = Math.PI / 2
        ring.position.set(-0.4 + i * 0.4, 0.3, 0)
        g.add(c, ring)
      }
      break
    case 'devops':
      for (let i = 0; i < 4; i++) {
        const roller = new THREE.Mesh(track(new THREE.CylinderGeometry(0.06, 0.06, 0.6, 12)), mats.metalDark)
        roller.rotation.x = Math.PI / 2
        roller.position.set(-0.45 + i * 0.3, 0.08, 0)
        g.add(roller)
      }
      for (let i = 0; i < 2; i++) {
        const pkg = new THREE.Mesh(unit, mats.emissive(PALETTE.amber, 0.6))
        pkg.scale.setScalar(0.2)
        pkg.position.set(-0.3 + i * 0.5, 0.25, 0)
        g.add(pkg)
      }
      break
    case 'testing':
      for (let i = 0; i < 3; i++) {
        const s = new THREE.Mesh(unit, mats.emissive(PALETTE.green, 0.9))
        s.scale.set(0.3, 0.22, 0.03)
        s.position.set(-0.36 + i * 0.36, 0.3, 0)
        g.add(s)
      }
      break
    default:
      break
  }
  return g
}
