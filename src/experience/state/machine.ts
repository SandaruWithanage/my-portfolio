import { isRoomId, type RoomId } from '../world/layout'

export type ExperiencePhase =
  | 'booting'
  | 'ready'
  | 'arrival'
  | 'doorstep'
  | 'airlock'
  | 'exploring'
  | 'touring'
  | 'paused'
  | 'recoverable-error'
  | 'fallback'

export type ExperienceEvent =
  | { type: 'ASSETS_READY' }
  | { type: 'START_EXPLORE' }
  | { type: 'START_TOUR' }
  | { type: 'SKIP_INTRO' }
  | { type: 'ARRIVAL_DONE' }
  | { type: 'APPROACH_DOOR' }
  | { type: 'DOOR_OPENED' }
  | { type: 'ENTER_ATRIUM' }
  | { type: 'DEEP_LINK'; room: RoomId; tour: boolean }
  | { type: 'PAUSE' }
  | { type: 'RESUME' }
  | { type: 'CANCEL_TOUR' }
  | { type: 'TOUR_DONE' }
  | { type: 'CONTEXT_LOST' }
  | { type: 'ASSET_ERROR'; message: string }
  | { type: 'RETRY' }
  | { type: 'OPEN_FALLBACK' }

export type ExperienceState = {
  phase: ExperiencePhase
  /** Where to return after pause. */
  resumeTo: ExperiencePhase | null
  /** Visitor chose the guided tour; it starts once inside. */
  tourRequested: boolean
  error: string | null
}

export const initialState: ExperienceState = { phase: 'booting', resumeTo: null, tourRequested: false, error: null }

/** Phases in which the world is live and the pause menu is meaningful. */
const PAUSABLE: ExperiencePhase[] = ['arrival', 'doorstep', 'airlock', 'exploring', 'touring']

/**
 * Deterministic reducer. Illegal events are ignored (state returned unchanged), which
 * the tests pin down, so a stray key press can never leave the world half-transitioned.
 */
export function reduce(s: ExperienceState, e: ExperienceEvent): ExperienceState {
  // Escape hatches that are always legal.
  if (e.type === 'OPEN_FALLBACK') return { ...s, phase: 'fallback', resumeTo: null }
  if (e.type === 'CONTEXT_LOST' || e.type === 'ASSET_ERROR') {
    if (s.phase === 'fallback') return s
    return { ...s, phase: 'recoverable-error', resumeTo: null, error: e.type === 'ASSET_ERROR' ? e.message : 'Graphics context lost' }
  }

  switch (s.phase) {
    case 'booting':
      if (e.type === 'ASSETS_READY') return { ...s, phase: 'ready' }
      return s
    case 'ready':
      if (e.type === 'START_EXPLORE') return { ...s, phase: 'arrival', tourRequested: false }
      if (e.type === 'START_TOUR') return { ...s, phase: 'arrival', tourRequested: true }
      if (e.type === 'DEEP_LINK') return { ...s, phase: e.tour ? 'touring' : 'exploring', tourRequested: e.tour }
      return s
    case 'arrival':
      if (e.type === 'ARRIVAL_DONE' || e.type === 'SKIP_INTRO') return { ...s, phase: 'doorstep' }
      break
    case 'doorstep':
      if (e.type === 'APPROACH_DOOR') return { ...s, phase: 'airlock' }
      if (e.type === 'SKIP_INTRO') return { ...s, phase: s.tourRequested ? 'touring' : 'exploring' }
      break
    case 'airlock':
      if (e.type === 'DOOR_OPENED' || e.type === 'ENTER_ATRIUM' || e.type === 'SKIP_INTRO')
        return { ...s, phase: s.tourRequested ? 'touring' : 'exploring' }
      break
    case 'exploring':
      if (e.type === 'START_TOUR') return { ...s, phase: 'touring', tourRequested: true }
      break
    case 'touring':
      if (e.type === 'CANCEL_TOUR' || e.type === 'TOUR_DONE') return { ...s, phase: 'exploring', tourRequested: false }
      break
    case 'paused':
      if (e.type === 'RESUME') return { ...s, phase: s.resumeTo ?? 'exploring', resumeTo: null }
      if (e.type === 'START_TOUR') return { ...s, phase: 'touring', resumeTo: null, tourRequested: true }
      if (e.type === 'CANCEL_TOUR' && s.resumeTo === 'touring') return { ...s, resumeTo: 'exploring', tourRequested: false }
      return s
    case 'recoverable-error':
      if (e.type === 'RETRY') return { ...initialState }
      return s
    case 'fallback':
      return s
  }
  if (e.type === 'PAUSE' && PAUSABLE.includes(s.phase)) return { ...s, phase: 'paused', resumeTo: s.phase }
  return s
}

/** Parse `?room=` / `?tour=` deep links; unknown rooms fall back to the atrium. */
export function parseDeepLink(search: string): { room: RoomId | null; tour: boolean } {
  const p = new URLSearchParams(search)
  const raw = p.get('room')
  const tour = p.get('tour') === '1'
  if (raw === null) return { room: tour ? 'atrium' : null, tour }
  const room = isRoomId(raw) && raw !== 'exterior' && raw !== 'airlock' ? raw : 'atrium'
  return { room, tour }
}

/** Phases in which the world should be rendering and accepting movement. */
export const isPlaying = (p: ExperiencePhase) => p === 'doorstep' || p === 'airlock' || p === 'exploring' || p === 'touring'
