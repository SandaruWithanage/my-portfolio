import type { Rect, Vec2 } from '../world/layout'

/** Movement tuning (metres, seconds). */
export const MOVE = {
  walk: 3.2,
  run: 6.2,
  accel: 12,
  turnRate: 11,
  radius: 0.45,
  maxDt: 0.05,
  maxStep: 0.15,
}

export type Body = { x: number; z: number; vx: number; vz: number; heading: number }
export type MoveIntent = { x: number; z: number; run: boolean }

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))

/**
 * Turn stick/keyboard input (x = right, y = forward, each -1..1) into a world-space
 * direction relative to the camera's yaw. Camera forward is (sin yaw, cos yaw).
 */
export function cameraRelative(input: { x: number; y: number }, yaw: number): Vec2 {
  const fx = Math.sin(yaw)
  const fz = Math.cos(yaw)
  // Right is forward rotated -90° about +y.
  const rx = -fz
  const rz = fx
  let x = fx * input.y + rx * input.x
  let z = fz * input.y + rz * input.x
  const len = Math.hypot(x, z)
  if (len > 1) {
    x /= len
    z /= len
  }
  return { x, z }
}

/** Push a circle out of an axis-aligned box (XZ). Returns the corrected position. */
export function pushOut(p: Vec2, r: number, box: Rect): Vec2 {
  const cx = clamp(p.x, box.x0, box.x1)
  const cz = clamp(p.z, box.z0, box.z1)
  let dx = p.x - cx
  let dz = p.z - cz
  const d2 = dx * dx + dz * dz
  if (d2 >= r * r) return p
  if (d2 > 1e-12) {
    const d = Math.sqrt(d2)
    return { x: cx + (dx / d) * r, z: cz + (dz / d) * r }
  }
  // Centre is inside the box: leave along the shallowest axis.
  const left = p.x - box.x0
  const right = box.x1 - p.x
  const down = p.z - box.z0
  const up = box.z1 - p.z
  const m = Math.min(left, right, down, up)
  if (m === left) dx = -(left + r)
  else if (m === right) dx = right + r
  else dx = 0
  if (m === down) dz = -(down + r)
  else if (m === up) dz = up + r
  else dz = 0
  return { x: p.x + dx, z: p.z + dz }
}

export function resolve(p: Vec2, r: number, boxes: Rect[]): Vec2 {
  let q = p
  for (let iter = 0; iter < 3; iter++) {
    const before = q
    for (const b of boxes) q = pushOut(q, r, b)
    if (Math.abs(before.x - q.x) + Math.abs(before.z - q.z) < 1e-6) break
  }
  return q
}

const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a))

/**
 * One frame of character movement: frame-rate independent acceleration toward the
 * intended velocity, capped delta time, sub-stepped collision so the body can never
 * tunnel through a wall or a closed door, and a smooth turn toward the movement.
 */
export function step(body: Body, intent: MoveIntent, dtIn: number, boxes: Rect[]): Body {
  const dt = clamp(dtIn, 0, MOVE.maxDt)
  const speed = intent.run ? MOVE.run : MOVE.walk
  const len = Math.min(1, Math.hypot(intent.x, intent.z))
  const tx = len > 0 ? (intent.x / Math.hypot(intent.x, intent.z)) * speed * len : 0
  const tz = len > 0 ? (intent.z / Math.hypot(intent.x, intent.z)) * speed * len : 0
  const k = 1 - Math.exp(-MOVE.accel * dt)
  let vx = body.vx + (tx - body.vx) * k
  let vz = body.vz + (tz - body.vz) * k
  if (len === 0 && Math.hypot(vx, vz) < 0.05) {
    vx = 0
    vz = 0
  }

  let pos: Vec2 = { x: body.x, z: body.z }
  const dist = Math.hypot(vx, vz) * dt
  const n = Math.max(1, Math.ceil(dist / MOVE.maxStep))
  for (let i = 0; i < n; i++) {
    pos = resolve({ x: pos.x + (vx * dt) / n, z: pos.z + (vz * dt) / n }, MOVE.radius, boxes)
  }
  // Walls absorb the velocity component they blocked (no sliding speed build-up).
  if (dt > 0) {
    vx = (pos.x - body.x) / dt
    vz = (pos.z - body.z) / dt
    const cap = speed * 1.05
    const s = Math.hypot(vx, vz)
    if (s > cap) {
      vx = (vx / s) * cap
      vz = (vz / s) * cap
    }
  }

  let heading = body.heading
  if (Math.hypot(vx, vz) > 0.2) {
    const want = Math.atan2(vx, vz)
    heading = wrap(heading + wrap(want - heading) * (1 - Math.exp(-MOVE.turnRate * dt)))
  }
  return { x: pos.x, z: pos.z, vx, vz, heading }
}

/** Steering toward a point (used by the guided tour): returns a move intent. */
export function seek(body: Body, target: Vec2, arriveRadius = 0.35): { intent: MoveIntent; arrived: boolean } {
  const dx = target.x - body.x
  const dz = target.z - body.z
  const d = Math.hypot(dx, dz)
  if (d <= arriveRadius) return { intent: { x: 0, z: 0, run: false }, arrived: true }
  const slow = Math.min(1, d / 1.5)
  return { intent: { x: (dx / d) * slow, z: (dz / d) * slow, run: d > 6 }, arrived: false }
}
