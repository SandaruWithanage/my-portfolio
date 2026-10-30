import type { Rect, RoomId } from '../world/layout'
import { companionExhibits, coreLayers, projectExhibits, skillExhibits } from './adapters'

export type InteractableKind =
  | 'directory'
  | 'featured'
  | 'skill'
  | 'project'
  | 'companion'
  | 'core-layer'
  | 'core-trace'
  | 'harp'
  | 'pads'
  | 'sequencer'
  | 'comms'

export type Interactable = {
  id: string
  kind: InteractableKind
  room: RoomId
  x: number
  z: number
  radius: number
  facing: boolean
  /** Short name shown in the prompt: "E · Inspect EduVerse". */
  label: string
  verb: string
  /** Id of the underlying content record (skill group, project slug, layer…). */
  ref: string
  /** Footprint the robot cannot walk through. */
  block?: Rect
}

const box = (x: number, z: number, w: number, d: number): Rect => ({ x0: x - w / 2, x1: x + w / 2, z0: z - d / 2, z1: z + d / 2 })

/** Skills Bay bench positions (north row, south row, west wall), entrance kept clear. */
const BENCH_SPOTS: { x: number; z: number; rot: number }[] = [
  { x: -21.5, z: -2.2, rot: 0 },
  { x: -16.8, z: -2.2, rot: 0 },
  { x: -23.6, z: 2.2, rot: Math.PI / 2 },
  { x: -23.6, z: 5.8, rot: Math.PI / 2 },
  { x: -21.5, z: 10.2, rot: Math.PI },
  { x: -16.8, z: 10.2, rot: Math.PI },
]
export const benchSpots = BENCH_SPOTS

/** Gallery plinths: the main project centre stage, companions on the side walls. */
export const GALLERY_SPOTS = {
  main: { x: 19.5, z: 4 },
  companions: [
    { x: 22.8, z: -1.6 },
    { x: 22.8, z: 9.6 },
  ],
}

export const CORE_CENTER = { x: 0, z: -15.5 }
export const LAYER_SPOTS = [
  { x: -5.2, z: -11.4 },
  { x: 5.2, z: -11.4 },
  { x: 5.2, z: -19.6 },
  { x: -5.2, z: -19.6 },
]
export const TRACE_SPOT = { x: 0, z: -21.4 }

export const SOUND_SPOTS = {
  harp: { x: -20, z: -10.4, width: 5 },
  pads: { x: -17.2, z: -18.6 },
  sequencer: { x: -24.3, z: -15.5 },
}
export const COMMS_SPOT = { x: 20.6, z: -15.5 }
export const DIRECTORY_SPOT = { x: 0, z: 3.5 }
export const FEATURED_SPOT = { x: -5.6, z: 8.6 }

export function buildInteractables(): Interactable[] {
  const out: Interactable[] = []
  const projects = projectExhibits()
  const featured = projects[0]

  out.push({
    id: 'directory',
    kind: 'directory',
    room: 'atrium',
    ...DIRECTORY_SPOT,
    radius: 3.2,
    facing: false,
    label: 'Lab directory',
    verb: 'Open',
    ref: 'directory',
    block: box(DIRECTORY_SPOT.x, DIRECTORY_SPOT.z, 2.6, 2.6),
  })
  if (featured) {
    out.push({
      id: 'featured',
      kind: 'featured',
      room: 'atrium',
      ...FEATURED_SPOT,
      radius: 2.4,
      facing: false,
      label: featured.title,
      verb: 'Inspect',
      ref: featured.slug,
      block: box(FEATURED_SPOT.x, FEATURED_SPOT.z, 1.4, 1.4),
    })
  }

  skillExhibits().forEach((s, i) => {
    const spot = BENCH_SPOTS[i]
    if (!spot) return
    const horizontal = Math.abs(Math.sin(spot.rot)) < 0.5
    out.push({
      id: s.id,
      kind: 'skill',
      room: 'skills',
      x: spot.x,
      z: spot.z,
      radius: 2.6,
      facing: false,
      label: `${s.label} bench`,
      verb: 'Inspect',
      ref: s.category,
      block: horizontal ? box(spot.x, spot.z, 3, 1.3) : box(spot.x, spot.z, 1.3, 3),
    })
  })

  projects.forEach((p, i) => {
    if (i > 0) return // one centre stage; further projects would get their own plinths here
    out.push({
      id: p.id,
      kind: 'project',
      room: 'gallery',
      ...GALLERY_SPOTS.main,
      radius: 3,
      facing: false,
      label: p.title,
      verb: 'Inspect',
      ref: p.slug,
      block: box(GALLERY_SPOTS.main.x, GALLERY_SPOTS.main.z, 2.2, 2.2),
    })
  })
  companionExhibits.forEach((c, i) => {
    const spot = GALLERY_SPOTS.companions[i]
    out.push({
      id: c.id,
      kind: 'companion',
      room: 'gallery',
      ...spot,
      radius: 2.4,
      facing: false,
      label: c.title,
      verb: 'Inspect',
      ref: c.id,
      block: box(spot.x, spot.z, 1.3, 1.3),
    })
  })

  coreLayers().forEach((l, i) => {
    const spot = LAYER_SPOTS[i]
    if (!spot) return
    out.push({
      id: l.id,
      kind: 'core-layer',
      room: 'core',
      ...spot,
      radius: 2.2,
      facing: false,
      label: `${l.title} layer`,
      verb: 'Explain',
      ref: l.id,
      block: box(spot.x, spot.z, 1.1, 1.1),
    })
  })
  out.push({
    id: 'core-trace',
    kind: 'core-trace',
    room: 'core',
    ...TRACE_SPOT,
    radius: 2.4,
    facing: false,
    label: 'Request traces',
    verb: 'Run',
    ref: 'traces',
    block: box(TRACE_SPOT.x, TRACE_SPOT.z, 2.4, 1),
  })

  out.push({ id: 'harp', kind: 'harp', room: 'sound', x: SOUND_SPOTS.harp.x, z: SOUND_SPOTS.harp.z - 1.4, radius: 2.6, facing: false, label: 'Laser harp', verb: 'Play', ref: 'harp' })
  out.push({ id: 'pads', kind: 'pads', room: 'sound', ...SOUND_SPOTS.pads, radius: 2.8, facing: false, label: 'Drum pads', verb: 'Play', ref: 'pads' })
  out.push({
    id: 'sequencer',
    kind: 'sequencer',
    room: 'sound',
    x: SOUND_SPOTS.sequencer.x + 1.6,
    z: SOUND_SPOTS.sequencer.z,
    radius: 2.6,
    facing: false,
    label: 'Sequencer wall',
    verb: 'Compose',
    ref: 'sequencer',
  })

  out.push({
    id: 'comms',
    kind: 'comms',
    room: 'comms',
    ...COMMS_SPOT,
    radius: 3,
    facing: false,
    label: 'Comms terminal',
    verb: 'Open',
    ref: 'comms',
    block: box(COMMS_SPOT.x + 0.6, COMMS_SPOT.z, 1.4, 3.2),
  })
  return out
}

export const INTERACTABLES = buildInteractables()
export const interactableById = (id: string | null) => INTERACTABLES.find((i) => i.id === id) ?? null
export const EXHIBIT_BLOCKS: Rect[] = INTERACTABLES.flatMap((i) => (i.block ? [i.block] : []))
