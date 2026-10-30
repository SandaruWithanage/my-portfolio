import { coreLayers, identity, projectExhibits, skillExhibits } from '../content/adapters'
import type { RoomId } from '../world/layout'

export type TourStop = { room: RoomId; title: string; caption: string; holdMs: number; focus?: string }

/** Tour stops in a meaningful order, captions written from the canonical data. */
export function tourStops(): TourStop[] {
  const groups = skillExhibits().map((s) => s.label)
  const project = projectExhibits()[0]
  const layers = coreLayers().map((l) => l.title.toLowerCase())
  const stops: TourStop[] = [
    {
      room: 'atrium',
      title: 'Welcome',
      caption: `This is the lab of ${identity.name}, ${identity.role}. ${identity.summary}`,
      holdMs: 7000,
      focus: 'directory',
    },
    {
      room: 'skills',
      title: 'Skills Bay',
      caption: `One workbench per skill group — ${groups.join(', ')}. Each bench lists the tools and the projects that used them.`,
      holdMs: 6500,
    },
  ]
  if (project) {
    stops.push({
      room: 'gallery',
      title: 'Project Gallery',
      caption: `${project.title}: ${project.summary} Status: ${project.status}.`,
      holdMs: 7500,
      focus: project.id,
    })
  }
  stops.push(
    {
      room: 'core',
      title: 'Architecture Core',
      caption: `EduVerse in layers — ${layers.join(', ')}. Pick a layer to see what it does, or run a request trace.`,
      holdMs: 7000,
      focus: 'core-trace',
    },
    {
      room: 'sound',
      title: 'Sound Lab',
      caption: 'A playground: a laser harp, drum pads and a step sequencer. Sound stays off until you enable it.',
      holdMs: 5500,
    },
    {
      room: 'comms',
      title: 'Comms Room',
      caption: 'Want to talk? The terminal has email, GitHub and LinkedIn.',
      holdMs: 5500,
      focus: 'comms',
    },
  )
  return stops
}

export type TourState = {
  index: number
  stage: 'travel' | 'hold' | 'done'
  holdLeft: number
  paused: boolean
}

export const startTour = (index = 0): TourState => ({ index, stage: 'travel', holdLeft: 0, paused: false })

/** The robot reached the current stop: start holding on its caption. */
export function arrived(s: TourState, stops: TourStop[]): TourState {
  if (s.stage !== 'travel') return s
  return { ...s, stage: 'hold', holdLeft: stops[s.index]?.holdMs ?? 0 }
}

/** Advance the hold timer; moves to the next stop (or done) when it runs out. Paused tours don't advance. */
export function tick(s: TourState, stops: TourStop[], dtMs: number): TourState {
  if (s.paused || s.stage !== 'hold') return s
  const left = s.holdLeft - dtMs
  if (left > 0) return { ...s, holdLeft: left }
  return next(s, stops)
}

export function next(s: TourState, stops: TourStop[]): TourState {
  if (s.index + 1 >= stops.length) return { ...s, stage: 'done', holdLeft: 0 }
  return { index: s.index + 1, stage: 'travel', holdLeft: 0, paused: s.paused }
}

export function previous(s: TourState): TourState {
  return { index: Math.max(0, s.index - 1), stage: 'travel', holdLeft: 0, paused: s.paused }
}

export const setPaused = (s: TourState, paused: boolean): TourState => ({ ...s, paused })
