import * as THREE from 'three'
import { WALL_HEIGHT, type Wall } from '../world/layout'

export const CAMERA = {
  distance: 5.4,
  outsideDistance: 7.2,
  minDistance: 1.4,
  height: 1.45,
  minPitch: -0.12,
  maxPitch: 0.75,
  clearance: 0.35,
}

/** Ray (origin + dir * t, t in [0, max]) vs. axis-aligned box in 3D. Returns hit t or null. */
export function rayBox(o: THREE.Vector3, d: THREE.Vector3, max: number, b: { x0: number; x1: number; z0: number; z1: number; height: number }): number | null {
  let t0 = 0
  let t1 = max
  const lo = [b.x0, 0, b.z0]
  const hi = [b.x1, b.height, b.z1]
  const oo = [o.x, o.y, o.z]
  const dd = [d.x, d.y, d.z]
  for (let i = 0; i < 3; i++) {
    if (Math.abs(dd[i]) < 1e-9) {
      if (oo[i] < lo[i] || oo[i] > hi[i]) return null
    } else {
      let ta = (lo[i] - oo[i]) / dd[i]
      let tb = (hi[i] - oo[i]) / dd[i]
      if (ta > tb) [ta, tb] = [tb, ta]
      t0 = Math.max(t0, ta)
      t1 = Math.min(t1, tb)
      if (t0 > t1) return null
    }
  }
  return t0
}

/**
 * Third-person spring-arm camera: orbits the robot with clamped pitch, pulls in when a
 * wall is between it and the robot (never clips through walls or the ceiling), and
 * eases toward its goal. One owner at a time: follow, tour (auto-aligned) or rail.
 */
export function createFollowCamera(camera: THREE.PerspectiveCamera, walls: Wall[]) {
  let yaw = Math.PI
  let pitch = 0.32
  let dist = CAMERA.distance
  let lastManual = -Infinity
  const pos = new THREE.Vector3()
  const goal = new THREE.Vector3()
  const target = new THREE.Vector3()
  const dir = new THREE.Vector3()
  let initialised = false

  return {
    get yaw() {
      return yaw
    },
    set yaw(v: number) {
      yaw = v
    },
    /** Mouse / touch orbit (radians). */
    orbit(dx: number, dy: number, now: number) {
      yaw -= dx
      pitch = THREE.MathUtils.clamp(pitch + dy, CAMERA.minPitch, CAMERA.maxPitch)
      lastManual = now
    },
    zoom(delta: number) {
      dist = THREE.MathUtils.clamp(dist + delta, 3, 9)
    },
    /** Snap behind a heading (spawns, teleports, reduced motion). */
    snapBehind(heading: number) {
      yaw = heading
      initialised = false
    },
    update(robot: { x: number; z: number; heading: number; moving: boolean }, inside: boolean, dt: number, now: number, smooth: boolean) {
      // Keyboard players get the camera drifting behind the robot while it walks, unless they just orbited.
      if (robot.moving && now - lastManual > 1600) {
        const diff = Math.atan2(Math.sin(robot.heading - yaw), Math.cos(robot.heading - yaw))
        yaw += diff * Math.min(1, dt * 1.6)
      }
      const want = inside ? Math.min(dist, CAMERA.distance) : Math.max(dist, CAMERA.outsideDistance)
      target.set(robot.x, CAMERA.height, robot.z)
      dir.set(-Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch)).normalize()
      let len = want
      for (const w of walls) {
        if (w.kind === 'boundary') continue
        const t = rayBox(target, dir, len, w)
        if (t !== null) len = Math.max(CAMERA.minDistance, t - CAMERA.clearance)
      }
      goal.copy(target).addScaledVector(dir, len)
      if (inside) goal.y = Math.min(goal.y, WALL_HEIGHT - 0.4)
      if (!initialised || !smooth) {
        pos.copy(goal)
        initialised = true
      } else {
        pos.lerp(goal, 1 - Math.exp(-dt * 10))
      }
      camera.position.copy(pos)
      camera.lookAt(target.x, target.y + 0.25, target.z)
    },
  }
}

export type FollowCamera = ReturnType<typeof createFollowCamera>

/** Arrival rail: high establishing shot → behind the robot at the doorstep. */
export const ARRIVAL_RAIL = {
  durationMs: 3800,
  from: { pos: new THREE.Vector3(14, 22, 72), look: new THREE.Vector3(0, 6, 16) },
  via: { pos: new THREE.Vector3(-6, 9, 46), look: new THREE.Vector3(0, 4, 20) },
}

export const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2)
