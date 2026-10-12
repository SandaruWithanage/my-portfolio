const KEY = 'lab-online'

/** Whether the lab was already brought online in this browser session. */
export function readBooted(): boolean {
  try {
    return sessionStorage.getItem(KEY) === '1'
  } catch {
    return false
  }
}

export function writeBooted(): void {
  try {
    sessionStorage.setItem(KEY, '1')
  } catch {
    // Storage unavailable (private mode, blocked): the boot simply may replay.
  }
}
