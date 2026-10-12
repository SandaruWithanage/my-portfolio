/** When the bench monitors power on after Initialize, left to right (ms). */
export const MONITOR_START_MS = 250
export const MONITOR_STEP_MS = 150

/** Whether monitor `index` should be on, `elapsedMs` after the lab went online. */
export function monitorOn(index: number, elapsedMs: number): boolean {
  return elapsedMs >= MONITOR_START_MS + index * MONITOR_STEP_MS
}

/** Time until every monitor is on; the render loop keeps running until then. */
export const monitorsSettleMs = (count: number) => MONITOR_START_MS + (count - 1) * MONITOR_STEP_MS
