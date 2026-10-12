import * as THREE from 'three'

const HOME_POS = new THREE.Vector3(0, 7.2, 12)
const HOME_TARGET = new THREE.Vector3(0, 0.8, -3.5)
const ARRIVAL_POS = new THREE.Vector3(0, 10.5, 22)

/**
 * Camera rig: owns camera position/target easing. `update` returns true while moving,
 * so the render loop can stop when the camera settles.
 */
export function createCameraRig(camera: THREE.PerspectiveCamera, reducedMotion: boolean) {
  const pos = (reducedMotion ? HOME_POS : ARRIVAL_POS).clone()
  const target = HOME_TARGET.clone()
  const posGoal = HOME_POS.clone()
  const targetGoal = HOME_TARGET.clone()
  let mode: 'home' | { x: number; z: number } = 'home'
  let framing = 1

  const apply = () => {
    camera.position.copy(pos)
    camera.lookAt(target)
  }
  apply()

  const applyGoals = () => {
    if (mode === 'home') {
      // Pull back on narrow stages so the outer modules stay in frame.
      posGoal.copy(HOME_TARGET).addScaledVector(HOME_POS.clone().sub(HOME_TARGET), framing)
      targetGoal.copy(HOME_TARGET)
    } else {
      posGoal.set(mode.x * 0.7, 3.4, mode.z + 8.5)
      targetGoal.set(mode.x, 1.2, mode.z)
    }
  }

  return {
    goHome() {
      mode = 'home'
      applyGoals()
    },
    /** Focus a module at world (x, z). */
    focus(x: number, z: number) {
      mode = { x, z }
      applyGoals()
    },
    setAspect(aspect: number) {
      framing = aspect >= 1.7 ? 1 : 1 + (1.7 - aspect) * 1.2
      applyGoals()
    },
    update(dt: number): boolean {
      const k = reducedMotion ? 1 : 1 - Math.exp(-dt * 4)
      pos.lerp(posGoal, k)
      target.lerp(targetGoal, k)
      apply()
      return pos.distanceTo(posGoal) > 0.01 || target.distanceTo(targetGoal) > 0.01
    },
  }
}
