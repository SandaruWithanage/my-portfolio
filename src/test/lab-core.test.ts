import { describe, expect, it } from 'vitest'
import { MOVE, cameraRelative, resolve, seek, step, type Body } from '../experience/actors/controller'
import { pentatonic, scheduleWindow, starterPattern, stepSeconds, STEPS, toggleStep } from '../experience/audio/music'
import { arrived, next, setPaused, startTour, tick, tourStops } from '../experience/cinematics/tour'
import { contactLinks, coreLayers, projectExhibits, skillExhibits } from '../experience/content/adapters'
import { EXHIBIT_BLOCKS, INTERACTABLES } from '../experience/content/interactables'
import { createAutoTier, initialTier } from '../experience/engine/quality'
import { HYSTERESIS, makeCooldowns, resolveTarget } from '../experience/interactions/resolver'
import { initialState, isPlaying, parseDeepLink, reduce, type ExperienceEvent, type ExperienceState } from '../experience/state/machine'
import { planRoute, segmentHitsBox } from '../experience/world/navigation'
import {
  CORRIDORS,
  DESTINATIONS,
  DOOR_BOX,
  ROOMS,
  ROOM_IDS,
  WALKABLE,
  WALLS,
  contains,
  doorwayBetween,
  roomAt,
  roomRoute,
  type Rect,
} from '../experience/world/layout'
import { profile, skills } from '../data/profile'
import { projects } from '../data/projects'
import { graphNodes } from '../data/eduverse-graph'

const body = (x: number, z: number, heading = Math.PI): Body => ({ x, z, vx: 0, vz: 0, heading })
const run = (b: Body, dir: { x: number; z: number }, seconds: number, boxes: Rect[] = WALLS, isRun = false) => {
  for (let t = 0; t < seconds; t += 1 / 60) b = step(b, { ...dir, run: isRun }, 1 / 60, boxes)
  return b
}

describe('floor plan', () => {
  it('connects every room to every other room', () => {
    for (const a of ROOM_IDS) for (const b of ROOM_IDS) expect(roomRoute(a, b).length, `${a}→${b}`).toBeGreaterThan(0)
  })

  it('spawns every room on walkable floor, clear of walls and exhibits', () => {
    for (const id of ROOM_IDS) {
      const s = ROOMS[id].spawn
      expect(contains(ROOMS[id].rect, s, MOVE.radius), id).toBe(true)
      expect(resolve(s, MOVE.radius, [...WALLS, ...EXHIBIT_BLOCKS]), id).toEqual(s)
    }
  })

  it('leaves an opening (no wall) at every doorway', () => {
    for (const c of CORRIDORS) {
      const [a, b] = c.connects
      const p = doorwayBetween(a, b)
      expect(resolve(p, MOVE.radius, WALLS)).toEqual(p)
    }
  })

  it('reports which room a point is in', () => {
    expect(roomAt({ x: 0, z: 5 })).toBe('atrium')
    expect(roomAt({ x: -20, z: -15 })).toBe('sound')
    expect(roomAt({ x: 100, z: 100 })).toBeNull()
  })

  it('walks every destination from the atrium along open floor', () => {
    for (const to of DESTINATIONS) {
      let b = body(ROOMS.atrium.spawn.x, ROOMS.atrium.spawn.z)
      for (const target of planRoute(b, 'atrium', to)) {
        for (let i = 0; i < 60 * 30; i++) {
          const s = seek(b, target)
          if (s.arrived) break
          b = step(b, s.intent, 1 / 60, [...WALLS, ...EXHIBIT_BLOCKS])
        }
      }
      expect(roomAt(b), to).toBe(to)
    }
  })
})

describe('route planning', () => {
  it('detects a segment crossing a box', () => {
    const box = { x0: -1, x1: 1, z0: -1, z1: 1 }
    expect(segmentHitsBox({ x: -3, z: 0 }, { x: 3, z: 0 }, box)).toBe(true)
    expect(segmentHitsBox({ x: -3, z: 2 }, { x: 3, z: 2 }, box)).toBe(false)
  })
  it('routes around the central directory instead of through it', () => {
    const route = planRoute(ROOMS.atrium.spawn, 'atrium', 'core')
    expect(route.length).toBeGreaterThan(2)
    for (let i = 1; i < route.length; i++)
      for (const blk of EXHIBIT_BLOCKS) expect(segmentHitsBox(route[i - 1], route[i], blk)).toBe(false)
  })
})

describe('character controller', () => {
  it('moves relative to the camera (forward = where the camera looks)', () => {
    const d = cameraRelative({ x: 0, y: 1 }, Math.PI) // camera looks -z
    expect(d.x).toBeCloseTo(0)
    expect(d.z).toBeCloseTo(-1)
    const r = cameraRelative({ x: 1, y: 0 }, Math.PI)
    expect(r.x).toBeCloseTo(1)
  })

  it('accelerates smoothly and caps speed', () => {
    let b = body(0, 5)
    b = step(b, { x: 0, z: -1, run: false }, 1 / 60, [])
    expect(Math.hypot(b.vx, b.vz)).toBeLessThan(MOVE.walk)
    b = run(b, { x: 0, z: -1 }, 2, [])
    expect(Math.hypot(b.vx, b.vz)).toBeCloseTo(MOVE.walk, 1)
  })

  it('caps delta time, so a long pause cannot teleport the robot', () => {
    const b = step({ ...body(0, 5), vz: -MOVE.run }, { x: 0, z: -1, run: true }, 5, [])
    expect(Math.abs(b.z - 5)).toBeLessThanOrEqual(MOVE.run * MOVE.maxDt + 1e-6)
  })

  it('cannot pass a wall even when running for a long time', () => {
    const b = run(body(0, 9), { x: 1, z: 0 }, 6, WALLS, true) // solid east wall of the atrium (doorway is z 2–6)
    expect(b.x).toBeLessThanOrEqual(ROOMS.atrium.rect.x1)
  })

  it('cannot pass the closed entrance door, but can once it opens', () => {
    const blocked = run(body(0, 19), { x: 0, z: -1 }, 3, [...WALLS, DOOR_BOX])
    expect(blocked.z).toBeGreaterThan(16)
    const open = run(body(0, 19), { x: 0, z: -1 }, 3, WALLS)
    expect(open.z).toBeLessThan(15)
  })

  it('turns smoothly toward the direction of travel', () => {
    let b = body(0, 5, 0)
    b = step(b, { x: 1, z: 0, run: false }, 1 / 60, [])
    expect(b.heading).toBeGreaterThan(0)
    expect(b.heading).toBeLessThan(Math.PI / 2)
  })
})

describe('interaction focus', () => {
  const items = [
    { id: 'a', x: 0, z: -2, radius: 2.5 },
    { id: 'b', x: 0, z: -2.6, radius: 2.5 },
  ]
  it('picks the nearest eligible target', () => {
    expect(resolveTarget({ x: 0, z: 0 }, Math.PI, items, null)).toBe('a')
  })
  it('keeps the current target slightly beyond reach (no flicker)', () => {
    const far = { x: 0, z: 2.5 + HYSTERESIS * 0.5 - 2 }
    expect(resolveTarget({ x: 0, z: 2.6 }, Math.PI, [items[0]], null)).toBeNull()
    expect(resolveTarget(far, Math.PI, [items[0]], 'a')).toBe('a')
  })
  it('ignores disabled targets and respects facing when required', () => {
    expect(resolveTarget({ x: 0, z: 0 }, Math.PI, [{ ...items[0], enabled: false }], null)).toBeNull()
    expect(resolveTarget({ x: 0, z: 0 }, 0, [{ ...items[0], facing: true }], null)).toBeNull()
  })
  it('rate-limits repeated actions with a cooldown', () => {
    const c = makeCooldowns(300)
    expect(c.ready('x', 0)).toBe(true)
    expect(c.ready('x', 100)).toBe(false)
    expect(c.ready('x', 400)).toBe(true)
  })
})

describe('experience state machine', () => {
  const play = (events: ExperienceEvent[], s: ExperienceState = initialState) => events.reduce(reduce, s)

  it('follows boot → arrival → doorstep → airlock → exploring', () => {
    const s = play([{ type: 'ASSETS_READY' }, { type: 'START_EXPLORE' }, { type: 'ARRIVAL_DONE' }, { type: 'APPROACH_DOOR' }, { type: 'DOOR_OPENED' }])
    expect(s.phase).toBe('exploring')
  })

  it('goes straight to touring after the door when the tour was chosen', () => {
    const s = play([{ type: 'ASSETS_READY' }, { type: 'START_TOUR' }, { type: 'SKIP_INTRO' }, { type: 'APPROACH_DOOR' }, { type: 'DOOR_OPENED' }])
    expect(s.phase).toBe('touring')
  })

  it('ignores illegal events (e.g. opening the door before loading)', () => {
    expect(play([{ type: 'DOOR_OPENED' }]).phase).toBe('booting')
    expect(play([{ type: 'ASSETS_READY' }, { type: 'APPROACH_DOOR' }]).phase).toBe('ready')
  })

  it('pauses and resumes to the same phase; tour cancel while paused resumes exploring', () => {
    let s = play([{ type: 'ASSETS_READY' }, { type: 'START_TOUR' }, { type: 'SKIP_INTRO' }, { type: 'SKIP_INTRO' }])
    expect(s.phase).toBe('touring')
    s = reduce(s, { type: 'PAUSE' })
    expect(s.phase).toBe('paused')
    expect(reduce(s, { type: 'RESUME' }).phase).toBe('touring')
    expect(reduce(reduce(s, { type: 'CANCEL_TOUR' }), { type: 'RESUME' }).phase).toBe('exploring')
  })

  it('always allows the 2D fallback and recovers from errors via retry', () => {
    const err = play([{ type: 'ASSETS_READY' }, { type: 'ASSET_ERROR', message: 'robot failed' }])
    expect(err.phase).toBe('recoverable-error')
    expect(reduce(err, { type: 'RETRY' }).phase).toBe('booting')
    expect(reduce(initialState, { type: 'OPEN_FALLBACK' }).phase).toBe('fallback')
  })

  it('deep links skip the intro and land in the right mode', () => {
    expect(play([{ type: 'ASSETS_READY' }, { type: 'DEEP_LINK', room: 'gallery', tour: false }]).phase).toBe('exploring')
    expect(play([{ type: 'ASSETS_READY' }, { type: 'DEEP_LINK', room: 'atrium', tour: true }]).phase).toBe('touring')
    expect(isPlaying('exploring')).toBe(true)
    expect(isPlaying('paused')).toBe(false)
  })

  it('parses deep-link query strings; unknown rooms fall back to the atrium', () => {
    expect(parseDeepLink('?room=gallery')).toEqual({ room: 'gallery', tour: false })
    expect(parseDeepLink('?room=nope')).toEqual({ room: 'atrium', tour: false })
    expect(parseDeepLink('?room=airlock')).toEqual({ room: 'atrium', tour: false })
    expect(parseDeepLink('?tour=1')).toEqual({ room: 'atrium', tour: true })
    expect(parseDeepLink('')).toEqual({ room: null, tour: false })
  })
})

describe('content adapters (canonical data only)', () => {
  it('maps every skill group, with project links derived from real stacks', () => {
    const ex = skillExhibits()
    expect(ex.map((e) => e.label)).toEqual(skills.map((s) => s.group))
    const backend = ex.find((e) => e.category === 'backend')!
    expect(backend.projectSlugs).toEqual(['eduverse']) // NestJS is in EduVerse's stack
    const testing = ex.find((e) => e.category === 'testing')!
    expect(testing.projectSlugs).toEqual([]) // no verified project lists Jest/Playwright in its stack
  })

  it('exhibits real projects with working case-study URLs', () => {
    const ex = projectExhibits()
    expect(ex.map((p) => p.slug)).toEqual(projects.map((p) => p.slug))
    for (const p of ex) expect(p.caseStudyUrl).toBe(`/projects/${p.slug}`)
  })

  it('covers every EduVerse node exactly once across the core layers', () => {
    const ids = coreLayers().flatMap((l) => l.nodes.map((n) => n.id)).sort()
    expect(ids).toEqual(graphNodes.map((n) => n.id).sort())
  })

  it('offers only contact links that exist in the profile (no CV)', () => {
    const links = contactLinks()
    expect(links.map((l) => l.href)).toEqual([`mailto:${profile.email}`, profile.github, profile.linkedin])
    expect(links.some((l) => /cv|resume/i.test(l.label))).toBe(false)
  })
})

describe('interactables', () => {
  it('gives every destination room at least one interaction', () => {
    for (const r of DESTINATIONS) expect(INTERACTABLES.some((i) => i.room === r), r).toBe(true)
  })
  it('places every interaction inside its own room', () => {
    for (const i of INTERACTABLES) expect(contains(ROOMS[i.room].rect, i), i.id).toBe(true)
  })
  it('keeps exhibit footprints inside walkable space', () => {
    for (const b of EXHIBIT_BLOCKS) {
      const c = { x: (b.x0 + b.x1) / 2, z: (b.z0 + b.z1) / 2 }
      expect(WALKABLE.some((r) => contains(r, c))).toBe(true)
    }
  })
})

describe('guided tour', () => {
  const stops = tourStops()
  it('visits rooms in a meaningful order with captions from real data', () => {
    expect(stops.map((s) => s.room)).toEqual(['atrium', 'skills', 'gallery', 'core', 'sound', 'comms'])
    expect(stops[0].caption).toContain(profile.name)
    expect(stops[2].caption).toContain(projects[0].title)
  })
  it('holds at each stop, advances, pauses and finishes', () => {
    let s = arrived(startTour(), stops)
    expect(s.stage).toBe('hold')
    s = setPaused(s, true)
    expect(tick(s, stops, 60_000)).toEqual(s)
    s = tick(setPaused(s, false), stops, stops[0].holdMs + 1)
    expect(s).toMatchObject({ index: 1, stage: 'travel' })
    let t = startTour(stops.length - 1)
    t = next(t, stops)
    expect(t.stage).toBe('done')
  })
})

describe('sound lab timing (no speakers needed)', () => {
  it('computes 16th-note steps and schedules a lookahead window without gaps', () => {
    expect(stepSeconds(120)).toBeCloseTo(0.125)
    const w = scheduleWindow(10, 10, 0, 120, 0.3)
    expect(w.due.map((d) => d.step)).toEqual([0, 1, 2])
    expect(w.nextStep).toBe(3)
    const w2 = scheduleWindow(10.3, w.nextTime, w.nextStep, 120, 0.3)
    expect(w2.due[0].time).toBeCloseTo(w.nextTime)
  })
  it('builds tunings and toggles steps immutably', () => {
    const n = pentatonic(7, 220)
    expect(n[0]).toBe(220)
    expect(n[5]).toBeCloseTo(440)
    const p = starterPattern()
    expect(p.kick).toHaveLength(STEPS)
    const q = toggleStep(p, 'kick', 1)
    expect(q.kick[1]).toBe(true)
    expect(p.kick[1]).toBe(false)
  })
})

describe('quality manager', () => {
  it('starts conservatively on small or weak devices', () => {
    expect(initialTier('auto', { width: 390 })).toBe('low')
    expect(initialTier('auto', { width: 1440, deviceMemory: 4 })).toBe('medium')
    expect(initialTier('auto', { width: 1440 })).toBe('high')
    expect(initialTier('low', { width: 1440 })).toBe('low')
  })
  it('steps down only after sustained slow frames and never flips per frame', () => {
    const a = createAutoTier('high')
    a.sample(50)
    expect(a.tier).toBe('high')
    for (let i = 0; i < 80; i++) a.sample(45)
    expect(a.tier).toBe('medium')
    for (let i = 0; i < 100; i++) a.sample(10)
    expect(a.tier).toBe('medium') // not yet: needs ~8 s of fast frames
    for (let i = 0; i < 900; i++) a.sample(10)
    expect(a.tier).toBe('high')
  })
})
