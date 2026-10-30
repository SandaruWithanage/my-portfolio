import { MOVE } from '../actors/controller'
import { EXHIBIT_BLOCKS } from '../content/interactables'
import { WALKABLE, contains, walkPath, type Rect, type RoomId, type Vec2 } from './layout'

const grow = (b: Rect, by: number): Rect => ({ x0: b.x0 - by, x1: b.x1 + by, z0: b.z0 - by, z1: b.z1 + by })

/** Does the segment a→b cross the box? (2D slab test) */
export function segmentHitsBox(a: Vec2, b: Vec2, box: Rect): boolean {
  let t0 = 0
  let t1 = 1
  const d = { x: b.x - a.x, z: b.z - a.z }
  for (const [p, dp, lo, hi] of [
    [a.x, d.x, box.x0, box.x1],
    [a.z, d.z, box.z0, box.z1],
  ] as const) {
    if (Math.abs(dp) < 1e-9) {
      if (p < lo || p > hi) return false
    } else {
      let ta = (lo - p) / dp
      let tb = (hi - p) / dp
      if (ta > tb) [ta, tb] = [tb, ta]
      t0 = Math.max(t0, ta)
      t1 = Math.min(t1, tb)
      if (t0 > t1) return false
    }
  }
  return true
}

const walkable = (p: Vec2) => WALKABLE.some((r) => contains(r, p, MOVE.radius))

/**
 * Insert detour points so no straight leg of the path crosses an exhibit footprint.
 * Detours go round the blocking footprint's corners (with clearance), choosing the
 * shortest clear option. Pure and deterministic.
 */
export function avoidBlocks(start: Vec2, points: Vec2[], blocks: Rect[] = EXHIBIT_BLOCKS): Vec2[] {
  const hit = blocks.map((b) => grow(b, MOVE.radius + 0.1))
  const clear = (a: Vec2, b: Vec2) => !hit.some((h) => segmentHitsBox(a, b, h))
  const out: Vec2[] = []
  let from = start
  for (const target of points) {
    let guard = 0
    while (!clear(from, target) && guard++ < 6) {
      const blocking = hit.find((h) => segmentHitsBox(from, target, h))!
      const around = grow(blocking, 0.6)
      const corners: Vec2[] = [
        { x: around.x0, z: around.z0 },
        { x: around.x1, z: around.z0 },
        { x: around.x0, z: around.z1 },
        { x: around.x1, z: around.z1 },
      ].filter(walkable)
      const options = corners
        .filter((c) => clear(from, c))
        .sort((a, b) => Math.hypot(a.x - from.x, a.z - from.z) + Math.hypot(target.x - a.x, target.z - a.z) - (Math.hypot(b.x - from.x, b.z - from.z) + Math.hypot(target.x - b.x, target.z - b.z)))
      const via = options[0]
      if (!via) break
      out.push(via)
      from = via
    }
    out.push(target)
    from = target
  }
  return out
}

/** Full route from a position in one room to another room's spawn, around exhibits. */
export function planRoute(from: Vec2, fromRoom: RoomId, to: RoomId): Vec2[] {
  return avoidBlocks(from, walkPath(fromRoom, to))
}
