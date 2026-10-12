import { useCallback, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

const PARAM = 'screen'

/**
 * Open holographic screens on the hub, back to front (the last id is in front).
 * The front screen is mirrored in `?screen=` so a screen can be linked to directly
 * and browser Back/Forward move between screens. Opening pushes a history entry;
 * closing replaces it, so Back never reopens a screen the visitor just closed.
 */
export function useScreenStack(ids: readonly string[]) {
  const [params, setParams] = useSearchParams()
  const raw = params.get(PARAM)
  const fromUrl = raw && ids.includes(raw) ? raw : null
  const [stack, setStack] = useState<string[]>(() => (fromUrl ? [fromUrl] : []))

  // URL → stack (direct links, Back/Forward), adjusted during render when the URL changes.
  const [synced, setSynced] = useState(fromUrl)
  if (synced !== fromUrl) {
    setSynced(fromUrl)
    if (!fromUrl) setStack([])
    else if (stack[stack.length - 1] !== fromUrl) setStack([...stack.filter((x) => x !== fromUrl), fromUrl])
  }

  const writeFront = useCallback(
    (id: string | undefined, replace: boolean) =>
      setParams(
        (p) => {
          const next = new URLSearchParams(p)
          if (id) next.set(PARAM, id)
          else next.delete(PARAM)
          return next
        },
        { replace },
      ),
    [setParams],
  )

  /** Bring a screen to the front, opening it if needed; the previous front moves back. */
  const open = useCallback((id: string) => writeFront(id, false), [writeFront])

  /** Close one screen; the screen behind it (if any) returns to the front. */
  const close = useCallback(
    (id: string) => {
      const next = stack.filter((x) => x !== id)
      const top = next[next.length - 1]
      // The URL catches up on the next render; the sync above then finds the stack already in order.
      setStack(next)
      writeFront(top, true)
    },
    [stack, writeFront],
  )

  const closeAll = useCallback(() => {
    setStack([])
    writeFront(undefined, true)
  }, [writeFront])

  return { stack, front: stack[stack.length - 1] as string | undefined, open, close, closeAll }
}
