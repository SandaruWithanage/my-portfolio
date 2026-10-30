import * as THREE from 'three'
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { PALETTE, type Materials } from '../world/materials'

export type Emote = 'Wave' | 'ThumbsUp' | 'Yes' | 'Jump'

/** Robot height in metres after normalising the model's scale. */
export const ROBOT_HEIGHT = 1.75

export type Robot = {
  root: THREE.Group
  kind: 'model' | 'procedural'
  /** Locomotion blend from horizontal speed (m/s); `dt` in seconds. */
  update(dt: number, speed: number, t: number): void
  /** One-shot gesture that interrupts locomotion and returns to it. */
  emote(name: Emote): void
  /** Powered-down pose for the arrival (sitting), then stand up. */
  setDormant(dormant: boolean): void
  dispose(): void
}

type Tracker = <T extends { dispose: () => void }>(o: T) => T

/**
 * Animated robot from the CC0 RobotExpressive model: idle/walk/run blended by speed,
 * one-shot emotes cross-faded on top, and a sit-to-stand power-on for the arrival.
 */
export function robotFromGltf(gltf: GLTF, mats: Materials, track: Tracker): Robot {
  const root = new THREE.Group()
  const model = gltf.scene
  // Normalise to a believable height and stand on the floor.
  const box = new THREE.Box3().setFromObject(model)
  const size = box.getSize(new THREE.Vector3())
  const scale = ROBOT_HEIGHT / (size.y || 1)
  model.scale.setScalar(scale)
  model.position.y = -box.min.y * scale
  model.traverse((o) => {
    const mesh = o as THREE.Mesh
    if (mesh.isMesh) {
      mesh.castShadow = true
      mesh.frustumCulled = false
      track(mesh.geometry)
      for (const m of [mesh.material].flat()) track(m as THREE.Material)
    }
  })
  root.add(model)
  root.add(contactShadow(mats, track))

  const mixer = new THREE.AnimationMixer(model)
  const clip = (name: string) => gltf.animations.find((a) => a.name === name)
  const action = (name: string) => {
    const c = clip(name)
    return c ? mixer.clipAction(c) : null
  }
  const idle = action('Idle')
  const walk = action('Walking')
  const runA = action('Running')
  const loco = [idle, walk, runA].filter(Boolean) as THREE.AnimationAction[]
  for (const a of loco) {
    a.play()
    a.setEffectiveWeight(0)
  }
  idle?.setEffectiveWeight(1)
  let locoGain = 1
  let current: THREE.AnimationAction | null = null
  let dormant = false
  const sit = action('Sitting')
  const stand = action('Standing')

  const playOnce = (a: THREE.AnimationAction | null, fade = 0.25) => {
    if (!a) return
    current?.fadeOut(fade)
    a.reset()
    a.setLoop(THREE.LoopOnce, 1)
    a.clampWhenFinished = true
    a.setEffectiveWeight(1)
    a.fadeIn(fade).play()
    current = a
  }
  mixer.addEventListener('finished', (e) => {
    if (e.action === current && !dormant) {
      current.fadeOut(0.35)
      current = null
    }
  })

  return {
    root,
    kind: 'model',
    update(dt, speed) {
      // Weights: idle below ~0.3 m/s, walk around 3 m/s, run above ~5 m/s.
      const w = THREE.MathUtils.clamp((speed - 0.3) / 2.7, 0, 1)
      const r = THREE.MathUtils.clamp((speed - 3.6) / 2, 0, 1)
      const target = current ? 0 : 1
      locoGain += (target - locoGain) * Math.min(1, dt * 8)
      idle?.setEffectiveWeight((1 - w) * locoGain)
      walk?.setEffectiveWeight(w * (1 - r) * locoGain)
      runA?.setEffectiveWeight(r * locoGain)
      if (walk) walk.timeScale = THREE.MathUtils.clamp(speed / 3, 0.6, 1.4)
      mixer.update(dt)
    },
    emote(name) {
      if (dormant) return
      playOnce(action(name))
    },
    setDormant(d) {
      if (d === dormant) return
      dormant = d
      if (d) playOnce(sit, 0.01)
      else playOnce(stand, 0.2)
    },
    dispose() {
      mixer.stopAllAction()
      mixer.uncacheRoot(model)
    },
  }
}

/**
 * Original procedural robot used if the model can't load: rounded body, visor head,
 * jointed arms and legs animated in code. Clearly simpler, but fully functional.
 */
export function proceduralRobot(mats: Materials, track: Tracker): Robot {
  const root = new THREE.Group()
  const shell = track(new THREE.MeshStandardMaterial({ color: 0xd8dde4, roughness: 0.35, metalness: 0.4 }))
  const joint = track(new THREE.MeshStandardMaterial({ color: 0x2a3038, roughness: 0.5, metalness: 0.6 }))
  const visor = mats.emissive(PALETTE.cyan, 2.2)
  const body = new THREE.Mesh(track(new THREE.CapsuleGeometry(0.32, 0.45, 6, 16)), shell)
  body.position.y = 1.0
  const head = new THREE.Mesh(track(new THREE.SphereGeometry(0.27, 24, 16)), shell)
  head.position.y = 1.58
  const eye = new THREE.Mesh(track(new THREE.BoxGeometry(0.34, 0.08, 0.05)), visor)
  eye.position.set(0, 1.6, 0.25)
  const limb = track(new THREE.CapsuleGeometry(0.07, 0.38, 4, 8))
  const mk = (x: number, y: number) => {
    const pivot = new THREE.Group()
    pivot.position.set(x, y, 0)
    const m = new THREE.Mesh(limb, joint)
    m.position.y = -0.24
    pivot.add(m)
    root.add(pivot)
    return pivot
  }
  const armL = mk(-0.42, 1.28)
  const armR = mk(0.42, 1.28)
  const legL = mk(-0.15, 0.62)
  const legR = mk(0.15, 0.62)
  root.add(body, head, eye, contactShadow(mats, track))
  let phase = 0
  let wave = 0
  let dormant = false
  return {
    root,
    kind: 'procedural',
    update(dt, speed, t) {
      phase += dt * (2 + speed * 2.4)
      const swing = Math.min(1, speed / 3) * 0.6
      legL.rotation.x = Math.sin(phase) * swing
      legR.rotation.x = -Math.sin(phase) * swing
      armL.rotation.x = -Math.sin(phase) * swing * 0.8
      armR.rotation.x = wave > 0 ? -2.6 + Math.sin(t * 12) * 0.3 : Math.sin(phase) * swing * 0.8
      wave = Math.max(0, wave - dt)
      body.position.y = 1.0 + Math.abs(Math.sin(phase)) * 0.04 * Math.min(1, speed) - (dormant ? 0.35 : 0)
      head.position.y = body.position.y + 0.58
      eye.position.y = head.position.y + 0.02
      ;(visor as THREE.MeshStandardMaterial).emissiveIntensity = dormant ? 0.2 : 2.2
    },
    emote() {
      wave = 1.4
    },
    setDormant(d) {
      dormant = d
    },
    dispose() {},
  }
}

function contactShadow(mats: Materials, track: Tracker) {
  const s = new THREE.Mesh(track(new THREE.PlaneGeometry(1.4, 1.4)), mats.shadow)
  s.rotation.x = -Math.PI / 2
  s.position.y = 0.015
  return s
}
