/** Pointer position in [-0.5, 0.5]; (0, 0) is the centre of the viewport. */
export type Look = { x: number; y: number }
type Listener = (look: Look) => void

/**
 * One pointer reading shared by everything that follows the mouse (the CSS tile
 * tilt and the 3D camera), so they can never drift apart. Not React state: updates
 * arrive on every pointer move and must not re-render the hub.
 */
export function createLookSource() {
  const listeners = new Set<Listener>()
  let current: Look = { x: 0, y: 0 }
  return {
    set(look: Look) {
      current = look
      for (const l of listeners) l(current)
    },
    subscribe(l: Listener) {
      listeners.add(l)
      l(current)
      return () => {
        listeners.delete(l)
      }
    },
  }
}

export type LookSource = ReturnType<typeof createLookSource>
