import { pentatonic, scheduleWindow, starterPattern, type Pattern, type Track } from './music'

type Listener = () => void

/**
 * Opt-in synthesised audio. Nothing is created until `enable()` is called from a user
 * gesture, every sound is generated (no samples, no copyrighted material), output goes
 * through a limiter, voices are short-lived and disconnect themselves, and the context
 * suspends when the page is hidden or the experience is paused.
 */
export class SoundManager {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private noise: AudioBuffer | null = null
  private timer: number | null = null
  private nextTime = 0
  private nextStep = 0
  private listeners = new Set<Listener>()
  enabled = false
  volume = 0.7
  bpm = 108
  playing = false
  playhead = -1
  pattern: Pattern = starterPattern()
  readonly harpNotes = pentatonic(7, 220)

  subscribe(l: Listener) {
    this.listeners.add(l)
    return () => {
      this.listeners.delete(l)
    }
  }
  private emit() {
    for (const l of this.listeners) l()
  }

  /** Must be called from a click/tap/keypress (browser autoplay rules). */
  async enable() {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctor) return false
    if (!this.ctx) {
      const ctx = new Ctor()
      const limiter = ctx.createDynamicsCompressor()
      limiter.threshold.value = -10
      limiter.ratio.value = 12
      const master = ctx.createGain()
      master.gain.value = this.volume
      master.connect(limiter).connect(ctx.destination)
      const buf = ctx.createBuffer(1, ctx.sampleRate * 0.4, ctx.sampleRate)
      const data = buf.getChannelData(0)
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
      this.ctx = ctx
      this.master = master
      this.noise = buf
    }
    await this.ctx.resume().catch(() => undefined)
    this.enabled = true
    this.emit()
    return true
  }

  disable() {
    this.stopSequencer()
    this.enabled = false
    void this.ctx?.suspend().catch(() => undefined)
    this.emit()
  }

  setVolume(v: number) {
    this.volume = Math.max(0, Math.min(1, v))
    if (this.master) this.master.gain.value = this.volume
    this.emit()
  }

  /** Pause/hidden: stop scheduling and suspend the context; resume restores it if enabled. */
  setSuspended(suspended: boolean) {
    if (!this.ctx) return
    if (suspended) {
      if (this.timer !== null) window.clearInterval(this.timer)
      this.timer = null
      void this.ctx.suspend().catch(() => undefined)
    } else if (this.enabled) {
      void this.ctx.resume().catch(() => undefined)
      if (this.playing) this.startTimer()
    }
  }

  private voice(type: OscillatorType, freq: number, start: number, dur: number, peak: number, sweepTo?: number) {
    const ctx = this.ctx!
    const osc = ctx.createOscillator()
    const g = ctx.createGain()
    osc.type = type
    osc.frequency.setValueAtTime(freq, start)
    if (sweepTo) osc.frequency.exponentialRampToValueAtTime(sweepTo, start + dur)
    g.gain.setValueAtTime(0.0001, start)
    g.gain.exponentialRampToValueAtTime(peak, start + 0.008)
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur)
    osc.connect(g).connect(this.master!)
    osc.start(start)
    osc.stop(start + dur + 0.02)
    osc.onended = () => {
      osc.disconnect()
      g.disconnect()
    }
  }

  private noiseHit(start: number, dur: number, peak: number, highpass: number) {
    const ctx = this.ctx!
    const src = ctx.createBufferSource()
    src.buffer = this.noise
    const f = ctx.createBiquadFilter()
    f.type = 'highpass'
    f.frequency.value = highpass
    const g = ctx.createGain()
    g.gain.setValueAtTime(peak, start)
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur)
    src.connect(f).connect(g).connect(this.master!)
    src.start(start)
    src.stop(start + dur + 0.02)
    src.onended = () => {
      src.disconnect()
      f.disconnect()
      g.disconnect()
    }
  }

  private play(track: Track, at?: number, note = 0) {
    if (!this.enabled || !this.ctx || !this.master) return
    const t = at ?? this.ctx.currentTime
    if (track === 'kick') this.voice('sine', 140, t, 0.35, 0.9, 45)
    else if (track === 'snare') {
      this.noiseHit(t, 0.18, 0.5, 1200)
      this.voice('triangle', 190, t, 0.12, 0.25)
    } else if (track === 'hat') this.noiseHit(t, 0.05, 0.25, 7000)
    else this.voice('sawtooth', this.harpNotes[note % this.harpNotes.length] / 2, t, 0.28, 0.18)
  }

  /** Laser harp string `i` (0..6). */
  pluck(i: number) {
    if (!this.enabled || !this.ctx) return
    const f = this.harpNotes[Math.max(0, Math.min(this.harpNotes.length - 1, i))]
    const t = this.ctx.currentTime
    this.voice('triangle', f, t, 0.9, 0.35)
    this.voice('sine', f * 2, t, 0.5, 0.08)
  }

  drum(track: Exclude<Track, 'synth'>) {
    this.play(track)
  }

  setPattern(p: Pattern) {
    this.pattern = p
    this.emit()
  }

  setBpm(bpm: number) {
    this.bpm = Math.max(60, Math.min(160, Math.round(bpm)))
    this.emit()
  }

  private startTimer() {
    if (this.timer !== null || !this.ctx) return
    this.timer = window.setInterval(() => {
      if (!this.ctx) return
      const w = scheduleWindow(this.ctx.currentTime, this.nextTime, this.nextStep, this.bpm)
      for (const d of w.due) {
        for (const tr of ['kick', 'snare', 'hat', 'synth'] as Track[]) if (this.pattern[tr][d.step]) this.play(tr, d.time, d.step % 5)
        const delay = Math.max(0, (d.time - this.ctx.currentTime) * 1000)
        window.setTimeout(() => {
          this.playhead = d.step
          this.emit()
        }, delay)
      }
      this.nextTime = w.nextTime
      this.nextStep = w.nextStep
    }, 25)
  }

  startSequencer() {
    if (!this.enabled || !this.ctx) return
    this.playing = true
    this.nextTime = this.ctx.currentTime + 0.05
    this.nextStep = 0
    this.startTimer()
    this.emit()
  }

  stopSequencer() {
    this.playing = false
    this.playhead = -1
    if (this.timer !== null) window.clearInterval(this.timer)
    this.timer = null
    this.emit()
  }

  dispose() {
    this.stopSequencer()
    this.listeners.clear()
    void this.ctx?.close().catch(() => undefined)
    this.ctx = null
    this.master = null
    this.enabled = false
  }
}
