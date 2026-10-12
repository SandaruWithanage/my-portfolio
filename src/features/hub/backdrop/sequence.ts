/** When the bench monitors power on after Initialize, left to right (ms). */
export const MONITOR_START_MS = 250
export const MONITOR_STEP_MS = 150

/** Whether monitor `index` should be on, `elapsedMs` after the lab went online. */
export function monitorOn(index: number, elapsedMs: number): boolean {
  return elapsedMs >= MONITOR_START_MS + index * MONITOR_STEP_MS
}

/** Time until every monitor is on; the render loop keeps running until then. */
export const monitorsSettleMs = (count: number) => MONITOR_START_MS + (count - 1) * MONITOR_STEP_MS

/** Ambient motion (the centerpiece) is capped at 30 fps; transitions render every frame. */
export const AMBIENT_FRAME_MS = 1000 / 30

/** Whether to draw this frame: always during a transition, otherwise at the ambient cap. */
export function shouldDraw(transitioning: boolean, sinceLastDrawMs: number): boolean {
  return transitioning || sinceLastDrawMs >= AMBIENT_FRAME_MS - 1
}
