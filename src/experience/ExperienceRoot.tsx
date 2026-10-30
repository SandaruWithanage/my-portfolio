import { useCallback, useEffect, useMemo, useReducer, useRef, useState, useSyncExternalStore } from 'react'
import { Link } from 'react-router-dom'
import { useDocumentTitle } from '../app/useDocumentTitle'
import { isWebGLAvailable } from '../features/engineering-lab/support'
import { PortfolioContent } from '../pages/PortfolioPage'
import { SoundManager } from './audio/SoundManager'
import { tourStops } from './cinematics/tour'
import { interactableById } from './content/interactables'
import type { Engine, EngineEvent, EngineStats } from './engine/createEngine'
import type { Progress } from './engine/assets'
import { initialTier, type Tier } from './engine/quality'
import { initialState, isPlaying, parseDeepLink, reduce, type ExperienceState } from './state/machine'
import { loadSettings, saveSettings, type Settings } from './state/settings'
import { BootScreen, Captions, Hints, MobileControls, PauseMenu, Prompt, StatsPanel, TopBar, WorldMap } from './ui/Chrome'
import { InspectPanel, type PanelActions } from './ui/Panels'
import { ROOMS, type RoomId } from './world/layout'
import './experience.css'

const prefersReducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
const VISITED_KEY = 'lab-world-visited'
const coarsePointer = () => typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches

/**
 * Lab World shell. React owns the phase (pure reducer), UI and every word of content;
 * the engine (lazy-loaded, owns Three.js) reports typed events and obeys commands.
 */
export function ExperienceRoot() {
  useDocumentTitle()
  const [webgl] = useState(() => isWebGLAvailable())
  // Without WebGL the plain portfolio is the first paint — no flash of the 3D loader.
  const [state, dispatch] = useReducer(reduce, webgl, (ok): ExperienceState => (ok ? initialState : { ...initialState, phase: 'fallback' }))
  const [settings, setSettings] = useState<Settings>(loadSettings)
  const reducedMotion = settings.reducedMotion ?? prefersReducedMotion()
  const touch = useMemo(coarsePointer, [])
  // Returning in the same session (e.g. Back from a case study) skips the intro to the atrium.
  const deepLink = useMemo(() => {
    const link = parseDeepLink(window.location.search)
    if (link.room) return link
    try {
      if (sessionStorage.getItem(VISITED_KEY) === '1') return { room: 'atrium' as RoomId, tour: false }
    } catch {
      // Storage unavailable: always show the intro.
    }
    return link
  }, [])
  const showStats = useMemo(() => new URLSearchParams(window.location.search).has('stats'), [])

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const engineRef = useRef<Engine | null>(null)
  const sound = useMemo(() => new SoundManager(), [])
  const soundOn = useSyncExternalStore((cb) => sound.subscribe(cb), () => sound.enabled)
  const [progress, setProgress] = useState<Progress | null>(null)
  const [warning, setWarning] = useState<string | null>(null)
  const [target, setTarget] = useState<string | null>(null)
  const [panel, setPanel] = useState<string | null>(null)
  const [menu, setMenu] = useState(false)
  const [map, setMap] = useState(false)
  const [room, setRoom] = useState<RoomId | null>(null)
  const [pos, setPos] = useState<{ x: number; z: number; heading: number } | null>(null)
  const [tour, setTour] = useState<{ index: number; stage: 'travel' | 'hold' | 'done'; paused: boolean } | null>(null)
  const [hints, setHints] = useState(false)
  const [announce, setAnnounce] = useState('')
  const [, setTier] = useState<Tier>('high')
  const [attempt, setAttempt] = useState(0)
  const stops = useMemo(tourStops, [])

  // --- Engine lifecycle (one engine per mount/attempt; Strict-Mode safe) --------
  const onEvent = useRef<(e: EngineEvent) => void>(() => {})
  useEffect(() => {
    const canvas = canvasRef.current
    if (!webgl || !canvas) return
    let disposed = false
    let engine: Engine | null = null
    const tier = initialTier(settings.quality, {
      width: window.innerWidth,
      deviceMemory: (navigator as { deviceMemory?: number }).deviceMemory,
      hardwareConcurrency: navigator.hardwareConcurrency,
      coarsePointer: coarsePointer(),
    })
    setTier(tier)
    import('./engine/createEngine')
      .then(({ createEngine }) => {
        if (disposed) return
        engine = createEngine(canvas, {
          tier,
          autoQuality: settings.quality === 'auto',
          reducedMotion,
          sensitivity: settings.sensitivity,
          invertY: settings.invertY,
          sound,
          onEvent: (e) => onEvent.current(e),
        })
        engineRef.current = engine
        return engine.load()
      })
      .catch((err) => {
        if (!disposed) dispatch({ type: 'ASSET_ERROR', message: err instanceof Error ? err.message : 'The 3D lab failed to start' })
      })
    return () => {
      disposed = true
      engine?.dispose()
      engineRef.current = null
    }
    // Recreate only on retry or when the quality choice changes (tier/pixel budget).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [webgl, attempt, settings.quality])

  useEffect(() => () => sound.dispose(), [sound])

  // Engine events → reducer / UI state.
  onEvent.current = (e) => {
    switch (e.type) {
      case 'progress':
        setProgress(e)
        break
      case 'ready':
        if (e.warning) setWarning(e.warning)
        dispatch({ type: 'ASSETS_READY' })
        break
      case 'error':
        dispatch({ type: 'ASSET_ERROR', message: e.message })
        break
      case 'arrival-done':
        dispatch({ type: 'ARRIVAL_DONE' })
        break
      case 'door-trigger':
        dispatch({ type: 'APPROACH_DOOR' })
        setAnnounce('Scanning… the airlock is opening.')
        break
      case 'door-opened':
        dispatch({ type: 'DOOR_OPENED' })
        setAnnounce('Door open. Welcome to the lab.')
        break
      case 'entered':
        setRoom(e.room)
        if (ROOMS[e.room].inside && e.room !== 'airlock') setAnnounce(`Entered ${ROOMS[e.room].name}.`)
        break
      case 'target':
        setTarget(e.id)
        break
      case 'interact':
        setPanel(e.id)
        break
      case 'tour':
        setTour((t) => ({ index: e.index, stage: e.stage, paused: t?.paused ?? false }))
        if (e.stage === 'done') {
          tourRunning.current = false
          dispatch({ type: 'TOUR_DONE' })
          setTour(null)
          setAnnounce('Tour complete. Explore freely.')
        }
        break
      case 'position':
        setPos({ x: e.x, z: e.z, heading: e.heading })
        break
      case 'tier':
        setTier(e.tier)
        break
      case 'context-lost':
        dispatch({ type: 'CONTEXT_LOST' })
        break
    }
  }

  // Deep links (`?room=` / `?tour=1`): skip the intro once ready.
  useEffect(() => {
    if (state.phase === 'ready' && deepLink.room) {
      dispatch({ type: 'DEEP_LINK', room: deepLink.room, tour: deepLink.tour })
      engineRef.current?.enterAt(deepLink.room)
    }
  }, [state.phase, deepLink])

  // Phase → engine commands.
  const prevPhase = useRef(state.phase)
  const tourRunning = useRef(false)
  useEffect(() => {
    const engine = engineRef.current
    const prev = prevPhase.current
    prevPhase.current = state.phase
    if (!engine) return
    if (state.phase === 'arrival' && prev === 'ready') {
      engine.beginArrival()
      if (!settings.seenHints) setHints(true)
    }
    // The engine's tour runs once per tour request: resuming from pause continues it,
    // starting from the menu (paused → touring) begins it.
    if (state.phase === 'touring' && !tourRunning.current) {
      engine.startTour(0)
      tourRunning.current = true
      setTour({ index: 0, stage: 'travel', paused: false })
    }
    if (state.phase === 'exploring' && tourRunning.current) {
      engine.tourControl('stop')
      tourRunning.current = false
      setTour(null)
    }
    if (state.phase === 'exploring' || state.phase === 'touring') {
      try {
        sessionStorage.setItem(VISITED_KEY, '1')
      } catch {
        // Storage unavailable: the intro simply replays.
      }
    }
  }, [state.phase, settings.seenHints])

  // Rendering is active only while the world is visible and not covered by the menu.
  const worldVisible = state.phase === 'arrival' || isPlaying(state.phase)
  useEffect(() => {
    engineRef.current?.setActive(worldVisible && !menu)
  }, [worldVisible, menu])
  // Panels and the map freeze movement (the world keeps animating behind them).
  useEffect(() => {
    engineRef.current?.setInputEnabled(!panel && !map)
  }, [panel, map])
  // A panel opened during the tour pauses it without losing its place.
  useEffect(() => {
    if (state.phase !== 'touring') return
    engineRef.current?.tourControl(panel || map ? 'pause' : 'resume')
  }, [panel, map, state.phase])

  // Settings persistence and live updates.
  const updateSettings = useCallback(
    (patch: Partial<Settings>) =>
      setSettings((s) => {
        const next = { ...s, ...patch }
        saveSettings(next)
        return next
      }),
    [],
  )
  useEffect(() => {
    engineRef.current?.setPrefs({ reducedMotion, sensitivity: settings.sensitivity, invertY: settings.invertY })
    sound.setVolume(settings.volume)
  }, [reducedMotion, settings.sensitivity, settings.invertY, settings.volume, sound])

  // --- Actions -------------------------------------------------------------------
  const closeOverlays = useCallback(() => {
    setPanel(null)
    setMap(false)
  }, [])
  const teleport = useCallback(
    (r: RoomId) => {
      closeOverlays()
      setMenu(false)
      if (state.phase === 'paused') dispatch({ type: 'RESUME' })
      if (state.phase === 'touring' || state.resumeTo === 'touring') dispatch({ type: 'CANCEL_TOUR' })
      if (state.phase === 'arrival') dispatch({ type: 'SKIP_INTRO' })
      if (state.phase === 'arrival' || state.phase === 'doorstep' || state.phase === 'airlock') dispatch({ type: 'SKIP_INTRO' })
      engineRef.current?.teleport(r)
    },
    [closeOverlays, state.phase, state.resumeTo],
  )
  const toggleSound = useCallback(() => {
    if (sound.enabled) {
      sound.disable()
      updateSettings({ soundPreferred: false })
    } else {
      void sound.enable()
      updateSettings({ soundPreferred: true })
    }
  }, [sound, updateSettings])
  const startTour = useCallback(() => {
    closeOverlays()
    setMenu(false)
    if (state.phase === 'ready') dispatch({ type: 'START_TOUR' })
    else {
      if (state.phase === 'doorstep' || state.phase === 'airlock' || state.phase === 'arrival') {
        dispatch({ type: 'SKIP_INTRO' })
        dispatch({ type: 'SKIP_INTRO' })
      }
      dispatch({ type: 'START_TOUR' })
    }
  }, [closeOverlays, state.phase])
  const skipIntro = useCallback(() => {
    const engine = engineRef.current
    if (state.phase === 'arrival') {
      engine?.skipArrival()
    } else if (state.phase === 'doorstep' || state.phase === 'airlock') {
      dispatch({ type: 'SKIP_INTRO' })
      engine?.enterAt('atrium')
      if (state.tourRequested) engine?.startTour(0)
    }
  }, [state.phase, state.tourRequested])

  const panelActions = useMemo<PanelActions>(
    () => ({
      close: () => setPanel(null),
      teleport,
      startTour,
      enableSound: () => {
        void sound.enable()
        updateSettings({ soundPreferred: true })
      },
      pluck: (i) => engineRef.current?.pluck(i) ?? sound.pluck(i),
      pad: (i) => engineRef.current?.pad(i),
      setTrace: (h) => engineRef.current?.setTrace(h),
      setLayerFocus: (i) => engineRef.current?.setLayerFocus(i),
    }),
    [teleport, startTour, sound, updateSettings],
  )

  // Keyboard: Esc closes the top-most overlay or opens the menu; M toggles the map;
  // 1–7 play the harp when its panel is open. Tab is never intercepted.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null
      if (el && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName))) return
      if (e.key === 'Escape') {
        if (panel || map) closeOverlays()
        else if (menu) {
          setMenu(false)
          dispatch({ type: 'RESUME' })
        } else if (worldVisible) {
          setMenu(true)
          dispatch({ type: 'PAUSE' })
        }
      } else if ((e.key === 'm' || e.key === 'M') && isPlaying(state.phase) && !menu) {
        setPanel(null)
        setMap((v) => !v)
      } else if (panel === 'harp' && /^[1-7]$/.test(e.key)) {
        panelActions.pluck(Number(e.key) - 1)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [panel, map, menu, worldVisible, state.phase, closeOverlays, panelActions])

  const dismissHints = () => {
    setHints(false)
    updateSettings({ seenHints: true })
  }
  useEffect(() => {
    if (!hints) return
    const id = window.setTimeout(dismissHints, 12000)
    return () => window.clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hints])

  const getStats = useCallback((): EngineStats | null => engineRef.current?.getStats() ?? null, [])

  // QA hook for scripted browser checks; only present with `?debug=1`.
  const phaseRef = useRef(state.phase)
  phaseRef.current = state.phase
  useEffect(() => {
    if (!new URLSearchParams(window.location.search).has('debug')) return
    const w = window as unknown as { __lab?: unknown }
    w.__lab = { engine: () => engineRef.current, phase: () => phaseRef.current }
    return () => {
      delete w.__lab
    }
  }, [])

  // --- Render --------------------------------------------------------------------
  if (state.phase === 'fallback') {
    return (
      <main className="lw-fallback container page">
        {!webgl && <p className="lw-note">Your browser can’t show the 3D lab here, so this is the full portfolio as a regular page.</p>}
        <PortfolioContent />
        {webgl && (
          <p className="section">
            <button type="button" className="lw-btn" onClick={() => window.location.reload()}>
              Try the 3D lab again
            </button>
          </p>
        )}
      </main>
    )
  }

  const item = interactableById(panel)
  const targetItem = interactableById(target)
  const stop = tour ? stops[tour.index] : null

  return (
    <div className={`lw-root${touch ? ' is-touch' : ''}`}>
      <canvas ref={canvasRef} className="lw-canvas" aria-hidden="true" tabIndex={-1} />
      <a className="skip-link" href="/portfolio">
        Skip to the plain portfolio
      </a>
      <p className="visually-hidden" aria-live="polite">
        {announce}
      </p>

      {(state.phase === 'booting' || state.phase === 'ready') && (
        <BootScreen
          progress={progress}
          ready={state.phase === 'ready'}
          warning={warning}
          onExplore={() => dispatch({ type: 'START_EXPLORE' })}
          onTour={() => dispatch({ type: 'START_TOUR' })}
        />
      )}

      {state.phase === 'recoverable-error' && (
        <div className="lw-boot">
          <div className="lw-boot-card" role="alert">
            <h1>The lab hit a problem</h1>
            <p>{state.error}</p>
            <div className="lw-choices">
              <button
                type="button"
                className="lw-btn lw-btn--primary"
                onClick={() => {
                  dispatch({ type: 'RETRY' })
                  setAttempt((a) => a + 1)
                }}
              >
                Retry
              </button>
              <button
                type="button"
                className="lw-btn"
                onClick={() => {
                  updateSettings({ quality: 'low' })
                  dispatch({ type: 'RETRY' })
                  setAttempt((a) => a + 1)
                }}
              >
                Retry with low graphics
              </button>
              <Link className="lw-btn lw-btn--ghost" to="/portfolio">
                Open the 2D portfolio
              </Link>
            </div>
          </div>
        </div>
      )}

      {(worldVisible || state.phase === 'paused') && (
        <>
          <TopBar soundOn={soundOn} onSound={toggleSound} onMap={() => setMap((v) => !v)} onMenu={() => (setMenu(true), dispatch({ type: 'PAUSE' }))} room={room} />

          {(state.phase === 'arrival' || state.phase === 'doorstep' || state.phase === 'airlock') && (
            <div className="lw-skip">
              <button type="button" className="lw-btn lw-btn--small" onClick={skipIntro}>
                {state.phase === 'arrival' ? 'Skip intro' : 'Skip to the atrium'}
              </button>
              {state.phase === 'doorstep' && <p className="lw-objective">Walk to the lab door ▸</p>}
              {state.phase === 'airlock' && <p className="lw-objective">Scanning…</p>}
            </div>
          )}

          {hints && isPlaying(state.phase) && <Hints touch={touch} onDismiss={dismissHints} />}

          {targetItem && !panel && !map && isPlaying(state.phase) && (
            <Prompt label={targetItem.label} verb={targetItem.verb} touch={touch} onAct={() => engineRef.current?.interact()} />
          )}

          {state.phase === 'touring' && stop && settings.captions && (
            <Captions
              title={`Tour ${(tour?.index ?? 0) + 1}/${stops.length} · ${stop.title}`}
              text={stop.caption}
              controls={
                <>
                  <button
                    type="button"
                    className="lw-btn lw-btn--small"
                    onClick={() => {
                      const paused = !tour?.paused
                      engineRef.current?.tourControl(paused ? 'pause' : 'resume')
                      setTour((t) => (t ? { ...t, paused } : t))
                    }}
                  >
                    {tour?.paused ? 'Resume tour' : 'Pause tour'}
                  </button>
                  <button type="button" className="lw-btn lw-btn--small" onClick={() => engineRef.current?.tourControl('next')}>
                    Next stop
                  </button>
                  <button type="button" className="lw-btn lw-btn--small" onClick={() => dispatch({ type: 'CANCEL_TOUR' })}>
                    Exit tour
                  </button>
                </>
              }
            />
          )}

          {item && <InspectPanel item={item} sound={sound} actions={panelActions} />}
          {map && <WorldMap pos={pos} onTeleport={teleport} onClose={() => setMap(false)} />}
          {touch && isPlaying(state.phase) && !panel && !map && (
            <MobileControls onStick={(x, y, run) => engineRef.current?.setStick(x, y, run)} onLook={(dx, dy) => engineRef.current?.look(dx, dy)} />
          )}
          {menu && (
            <PauseMenu
              settings={settings}
              onSettings={updateSettings}
              onResume={() => {
                setMenu(false)
                dispatch({ type: 'RESUME' })
              }}
              onTeleport={teleport}
              onTour={startTour}
              touring={state.resumeTo === 'touring'}
              onStopTour={() => dispatch({ type: 'CANCEL_TOUR' })}
              soundOn={soundOn}
              onSound={toggleSound}
            />
          )}
        </>
      )}
      {showStats && <StatsPanel get={getStats} />}
    </div>
  )
}
