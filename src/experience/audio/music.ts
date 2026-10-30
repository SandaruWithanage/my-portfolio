/** Pure music helpers (timing and tuning) so the audio engine stays testable without speakers. */

export const STEPS = 16
export const TRACKS = ['kick', 'snare', 'hat', 'synth'] as const
export type Track = (typeof TRACKS)[number]
export type Pattern = Record<Track, boolean[]>

export const emptyPattern = (): Pattern =>
  Object.fromEntries(TRACKS.map((t) => [t, Array<boolean>(STEPS).fill(false)])) as Pattern

/** A friendly starter groove so the wall isn't blank (original, generated pattern). */
export function starterPattern(): Pattern {
  const p = emptyPattern()
  for (let i = 0; i < STEPS; i += 4) p.kick[i] = true
  p.snare[4] = p.snare[12] = true
  for (let i = 2; i < STEPS; i += 4) p.hat[i] = true
  p.synth[0] = p.synth[6] = p.synth[10] = true
  return p
}

/** Length of one 16th-note step in seconds. */
export const stepSeconds = (bpm: number) => 60 / Math.max(40, Math.min(200, bpm)) / 4

/**
 * Lookahead scheduling: which steps start before `now + ahead`, given the next
 * step's time. Returns the steps to schedule and the new cursor.
 */
export function scheduleWindow(now: number, nextTime: number, nextStep: number, bpm: number, ahead = 0.12) {
  const due: { step: number; time: number }[] = []
  let t = Math.max(nextTime, now)
  let s = nextStep
  const dur = stepSeconds(bpm)
  while (t < now + ahead) {
    due.push({ step: s, time: t })
    t += dur
    s = (s + 1) % STEPS
  }
  return { due, nextTime: t, nextStep: s }
}

/** Minor-pentatonic notes (Hz) from a root; harp strings and sequencer synth use it. */
export function pentatonic(count: number, root = 220): number[] {
  const semis = [0, 3, 5, 7, 10]
  return Array.from({ length: count }, (_, i) => {
    const octave = Math.floor(i / semis.length)
    return root * 2 ** ((semis[i % semis.length] + 12 * octave) / 12)
  })
}

export const toggleStep = (p: Pattern, track: Track, step: number): Pattern => ({
  ...p,
  [track]: p[track].map((v, i) => (i === step ? !v : v)),
})
