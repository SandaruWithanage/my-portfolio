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

  const apply = () => {
    camera.position.copy(pos)
    camera.lookAt(target)
  }
  apply()

  return {
    goHome() {
      posGoal.copy(HOME_POS)
      targetGoal.copy(HOME_TARGET)
    },
    /** Focus a module at world (x, z). */
    focus(x: number, z: number) {
      posGoal.set(x * 0.7, 3.4, z + 8.5)
      targetGoal.set(x, 1.2, z)
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
