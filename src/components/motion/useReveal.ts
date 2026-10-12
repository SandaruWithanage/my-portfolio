import { animate, createScope, stagger, utils } from 'animejs'
import { useLayoutEffect, type RefObject } from 'react'
import { DURATION, STAGGER_MS } from './motion'
import { usePrefersReducedMotion } from './usePrefersReducedMotion'

type RevealOptions = {
  /** Elements inside the ref to animate. Omit to animate the ref element itself. */
  selector?: string
  duration?: number
  /** Delay between successive targets, in ms. */
  step?: number
  /** Starting opacity. */
  from?: number
  /** Starting vertical offset in px. */
  y?: number
  /** Re-run (reverting the previous run first) when any of these change. */
  deps?: readonly unknown[]
}

/**
 * Staggered fade/slide-in scoped to `ref`. Content is visible by default: the start
 * state is applied by Anime and fully removed by `revert()`, which runs on unmount,
 * on every dependency change (so interrupted runs never leave stale styles), and is
 * skipped entirely under reduced motion.
 */
export function useReveal(ref: RefObject<HTMLElement | null>, options: RevealOptions = {}) {
  const reduced = usePrefersReducedMotion()
  const {
    selector,
    duration = DURATION.reveal,
    step = STAGGER_MS,
    from = 0,
    y = 16,
    deps = [],
  } = options

  useLayoutEffect(() => {
    const root = ref.current
    if (!root || reduced) return
    const scope = createScope({ root }).add(() => {
      const targets = selector ? root.querySelectorAll(selector) : root
      if (selector && targets instanceof NodeList && targets.length === 0) return
      utils.set(targets, { opacity: from, translateY: y })
      animate(targets, {
        opacity: 1,
        translateY: 0,
        duration,
        delay: stagger(step),
        ease: 'outQuad',
      })
    })
    return () => scope.revert()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ref, reduced, selector, duration, step, from, y, ...deps])
}
