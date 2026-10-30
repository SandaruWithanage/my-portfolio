/**
 * The lab's floor plan as pure data. Collision walls, the minimap, spawn points,
 * tour paths and the meshes are all derived from this one description, so they can
 * never disagree. Units are metres; +x is east, -z is north (into the building).
 */

export type Rect = { x0: number; z0: number; x1: number; z1: number }
export type Vec2 = { x: number; z: number }

export type RoomId = 'exterior' | 'airlock' | 'atrium' | 'skills' | 'gallery' | 'core' | 'sound' | 'comms'

export type Room = {
  id: RoomId
  name: string
  /** One line that tells a visitor what the room is for. */
  purpose: string
  rect: Rect
  spawn: Vec2
  /** Heading the robot faces on spawn (radians; 0 = +z, PI = -z). */
  facing: number
  /** CSS colour token name used for the room's accent (UI + signage). */
  accent: 'cyan' | 'amber' | 'violet' | 'green' | 'blue'
  inside: boolean
}

export type Corridor = { rect: Rect; connects: [RoomId, RoomId] }

export const WALL_HEIGHT = 5
export const FACADE_HEIGHT = 9
export const WALL_THICKNESS = 0.4

export const ROOMS: Record<RoomId, Room> = {
  exterior: {
    id: 'exterior',
    name: 'Doorstep',
    purpose: 'Arrival plaza in front of the lab entrance.',
    rect: { x0: -16, z0: 16, x1: 16, z1: 36 },
    spawn: { x: 0, z: 29 },
    facing: Math.PI,
    accent: 'cyan',
    inside: false,
  },
  airlock: {
    id: 'airlock',
    name: 'Airlock',
    purpose: 'Scanner entrance between the plaza and the atrium.',
    rect: { x0: -3, z0: 12, x1: 3, z1: 16 },
    spawn: { x: 0, z: 14 },
    facing: Math.PI,
    accent: 'cyan',
    inside: true,
  },
  atrium: {
    id: 'atrium',
    name: 'Atrium',
    purpose: 'Welcome hub: who built this lab and where to go next.',
    rect: { x0: -9, z0: -4, x1: 9, z1: 12 },
    spawn: { x: 0, z: 9.5 },
    facing: Math.PI,
    accent: 'cyan',
    inside: true,
  },
  skills: {
    id: 'skills',
    name: 'Skills Bay',
    purpose: 'Workbenches for each technical skill group, linked to the projects that used them.',
    rect: { x0: -25, z0: -4, x1: -12, z1: 12 },
    spawn: { x: -13.8, z: 4 },
    facing: -Math.PI / 2,
    accent: 'cyan',
    inside: true,
  },
  gallery: {
    id: 'gallery',
    name: 'Project Gallery',
    purpose: 'Exhibits of real, shipped work with links to full case studies.',
    rect: { x0: 12, z0: -4, x1: 25, z1: 12 },
    spawn: { x: 13.8, z: 4 },
    facing: Math.PI / 2,
    accent: 'amber',
    inside: true,
  },
  core: {
    id: 'core',
    name: 'Architecture Core',
    purpose: 'EduVerse’s architecture, layer by layer, with animated request traces.',
    rect: { x0: -9, z0: -23, x1: 9, z1: -8 },
    spawn: { x: 0, z: -9.6 },
    facing: Math.PI,
    accent: 'blue',
    inside: true,
  },
  sound: {
    id: 'sound',
    name: 'Sound Lab',
    purpose: 'A playground: laser harp, drum pads and a step sequencer (sound is opt-in).',
    rect: { x0: -25, z0: -23, x1: -12, z1: -8 },
    spawn: { x: -13.8, z: -15 },
    facing: -Math.PI / 2,
    accent: 'violet',
    inside: true,
  },
  comms: {
    id: 'comms',
    name: 'Comms Room',
    purpose: 'Contact terminal: email, GitHub and LinkedIn.',
    rect: { x0: 12, z0: -23, x1: 25, z1: -8 },
    spawn: { x: 13.8, z: -15 },
    facing: Math.PI / 2,
    accent: 'green',
    inside: true,
  },
}

export const ROOM_IDS = Object.keys(ROOMS) as RoomId[]
/** Rooms a visitor can choose from menus, map and deep links (not the plaza/airlock). */
export const DESTINATIONS: RoomId[] = ['atrium', 'skills', 'gallery', 'core', 'sound', 'comms']

export const CORRIDORS: Corridor[] = [
  { rect: { x0: -12, z0: 2, x1: -9, z1: 6 }, connects: ['atrium', 'skills'] },
  { rect: { x0: 9, z0: 2, x1: 12, z1: 6 }, connects: ['atrium', 'gallery'] },
  { rect: { x0: -2.5, z0: -8, x1: 2.5, z1: -4 }, connects: ['atrium', 'core'] },
  { rect: { x0: -12, z0: -17, x1: -9, z1: -13 }, connects: ['core', 'sound'] },
  { rect: { x0: 9, z0: -17, x1: 12, z1: -13 }, connects: ['core', 'comms'] },
]

/** Direct adjacency (the airlock joins the plaza and the atrium without a corridor). */
export const ROOM_LINKS: [RoomId, RoomId][] = [
  ['exterior', 'airlock'],
  ['airlock', 'atrium'],
  ...CORRIDORS.map((c) => c.connects),
]

/** The entrance door spans the airlock mouth on the facade line. */
export const ENTRANCE = { x0: -3, x1: 3, z: 16 }
/** Stepping into this zone in front of the door starts the scan. */
export const DOOR_TRIGGER: Rect = { x0: -3.5, z0: 16, x1: 3.5, z1: 20 }

export function neighbors(id: RoomId): RoomId[] {
  return ROOM_LINKS.flatMap(([a, b]) => (a === id ? [b] : b === id ? [a] : []))
}

export const contains = (r: Rect, p: Vec2, pad = 0) =>
  p.x >= r.x0 + pad && p.x <= r.x1 - pad && p.z >= r.z0 + pad && p.z <= r.z1 - pad

/** Which room a point is in (corridors count as the room nearer to their midpoint's first entry). */
export function roomAt(p: Vec2): RoomId | null {
  for (const id of ROOM_IDS) if (contains(ROOMS[id].rect, p)) return id
  for (const c of CORRIDORS) if (contains(c.rect, p)) return c.connects[0]
  return null
}

/** Walkable areas: every room and corridor. */
export const WALKABLE: Rect[] = [...ROOM_IDS.map((id) => ROOMS[id].rect), ...CORRIDORS.map((c) => c.rect)]

export type Wall = Rect & { height: number; kind: 'interior' | 'facade' | 'boundary' }

type Interval = [number, number]

function subtract(base: Interval, cuts: Interval[]): Interval[] {
  let parts: Interval[] = [base]
  for (const [c0, c1] of cuts) {
    parts = parts.flatMap(([a, b]) => {
      if (c1 <= a || c0 >= b) return [[a, b] as Interval]
      const out: Interval[] = []
      if (c0 > a) out.push([a, c0])
      if (c1 < b) out.push([c1, b])
      return out
    })
  }
  return parts.filter(([a, b]) => b - a > 1e-6)
}

/**
 * Walls are every edge of every walkable rect, minus the stretches where another
 * walkable rect continues on the other side (doorways). Derived, never hand-placed.
 */
export function deriveWalls(rects: Rect[] = WALKABLE): Wall[] {
  const t = WALL_THICKNESS / 2
  const walls: Wall[] = []
  const kindFor = (r: Rect, z: number): Wall['kind'] => {
    if (r === ROOMS.exterior.rect) return z === ENTRANCE.z ? 'facade' : 'boundary'
    return 'interior'
  }
  rects.forEach((r) => {
    // Horizontal edges (constant z): south (z1) and north (z0).
    for (const [z, outward] of [
      [r.z1, 1],
      [r.z0, -1],
    ] as const) {
      const cuts: Interval[] = rects
        .filter((o) => o !== r && (outward > 0 ? o.z0 === z : o.z1 === z))
        .map((o) => [Math.max(o.x0, r.x0), Math.min(o.x1, r.x1)] as Interval)
        .filter(([a, b]) => b > a)
      for (const [a, b] of subtract([r.x0, r.x1], cuts)) {
        const kind = kindFor(r, z)
        walls.push({ x0: a, x1: b, z0: z - t, z1: z + t, height: kind === 'facade' ? FACADE_HEIGHT : WALL_HEIGHT, kind })
      }
    }
    // Vertical edges (constant x): east (x1) and west (x0).
    for (const [x, outward] of [
      [r.x1, 1],
      [r.x0, -1],
    ] as const) {
      const cuts: Interval[] = rects
        .filter((o) => o !== r && (outward > 0 ? o.x0 === x : o.x1 === x))
        .map((o) => [Math.max(o.z0, r.z0), Math.min(o.z1, r.z1)] as Interval)
        .filter(([a, b]) => b > a)
      for (const [a, b] of subtract([r.z0, r.z1], cuts)) {
        const kind = r === ROOMS.exterior.rect ? 'boundary' : 'interior'
        walls.push({ x0: x - t, x1: x + t, z0: a, z1: b, height: WALL_HEIGHT, kind })
      }
    }
  })
  // The facade's own front edge is shared with the airlock interior walls; dedupe exact duplicates.
  const seen = new Set<string>()
  return walls.filter((w) => {
    const k = [w.x0, w.z0, w.x1, w.z1].map((v) => v.toFixed(3)).join(',')
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
}

export const WALLS = deriveWalls()

/** The closed entrance door as a collision box (removed while the door is open). */
export const DOOR_BOX: Rect = { x0: ENTRANCE.x0, x1: ENTRANCE.x1, z0: ENTRANCE.z - 0.3, z1: ENTRANCE.z + 0.3 }

/** Breadth-first route between rooms (room ids, inclusive). */
export function roomRoute(from: RoomId, to: RoomId): RoomId[] {
  const prev = new Map<RoomId, RoomId | null>([[from, null]])
  const queue: RoomId[] = [from]
  while (queue.length) {
    const cur = queue.shift()!
    if (cur === to) break
    for (const n of neighbors(cur)) {
      if (!prev.has(n)) {
        prev.set(n, cur)
        queue.push(n)
      }
    }
  }
  if (!prev.has(to)) return []
  const out: RoomId[] = []
  for (let c: RoomId | null = to; c; c = prev.get(c) ?? null) out.unshift(c)
  return out
}

const center = (r: Rect): Vec2 => ({ x: (r.x0 + r.x1) / 2, z: (r.z0 + r.z1) / 2 })

/** The doorway point between two adjacent rooms (corridor middle, or the shared edge). */
export function doorwayBetween(a: RoomId, b: RoomId): Vec2 {
  const corridor = CORRIDORS.find((c) => c.connects.includes(a) && c.connects.includes(b))
  if (corridor) return center(corridor.rect)
  if ([a, b].includes('exterior')) return { x: 0, z: ENTRANCE.z }
  return { x: 0, z: ROOMS.airlock.rect.z0 }
}

/** Walking path (points) from a position in one room to another room's spawn. */
export function walkPath(fromRoom: RoomId, to: RoomId): Vec2[] {
  const route = roomRoute(fromRoom, to)
  const pts: Vec2[] = []
  for (let i = 1; i < route.length; i++) pts.push(doorwayBetween(route[i - 1], route[i]))
  pts.push(ROOMS[to].spawn)
  return pts
}

export const isRoomId = (v: string | null | undefined): v is RoomId => !!v && v in ROOMS
