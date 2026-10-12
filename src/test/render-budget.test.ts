import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// The real renderer needs WebGL; this one only counts draws. Everything else in
// three.js (geometry, materials, scenes) is real, so the scene is built as in production.
const draws = { count: 0 }
vi.mock('three', async (importOriginal) => {
  const actual = await importOriginal<typeof import('three')>()
  class CountingRenderer {
    toneMapping = 0
    toneMappingExposure = 1
    setPixelRatio() {}
    setClearColor() {}
    setSize() {}
    render() {
      draws.count++
    }
    dispose() {}
    forceContextLoss() {}
  }
  class FakePMREM {
    fromScene() {
      return new actual.WebGLRenderTarget(1, 1)
    }
    dispose() {}
  }
  return { ...actual, WebGLRenderer: CountingRenderer, PMREMGenerator: FakePMREM }
})

// Manual frame clock: each tick() runs the queued animation frame at +16.7 ms.
let queue: FrameRequestCallback[] = []
let now = 0
function tick(n: number) {
  for (let i = 0; i < n; i++) {
    now += 1000 / 60
    const run = queue
    queue = []
    for (const cb of run) cb(now)
  }
}

beforeEach(() => {
  draws.count = 0
  queue = []
  now = 0
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => (queue.push(cb), queue.length))
  vi.stubGlobal('cancelAnimationFrame', () => {
    queue = []
  })
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      disconnect() {}
    },
  )
  vi.spyOn(performance, 'now').mockImplementation(() => now)
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

async function make(reducedMotion = false) {
  const { createBackdrop } = await import('../features/hub/backdrop/createBackdrop')
  const canvas = document.createElement('canvas')
  return createBackdrop(canvas, { reducedMotion })
}

describe('hub render budget', () => {
  it('draws nothing while paused behind a screen', async () => {
    const b = await make()
    b.setOnline(true)
    tick(30)
    expect(draws.count).toBeGreaterThan(0)
    b.setPaused(true)
    const before = draws.count
    tick(300)
    expect(draws.count).toBe(before)
    b.look(0.4, 0.1) // pointer input while paused must not wake it
    tick(60)
    expect(draws.count).toBe(before)
    b.dispose()
  })

  it('draws nothing while the tab is hidden', async () => {
    const b = await make()
    b.setOnline(true)
    tick(30)
    const hidden = vi.spyOn(document, 'hidden', 'get').mockReturnValue(true)
    const before = draws.count
    tick(200)
    expect(draws.count).toBe(before)
    hidden.mockRestore()
    b.dispose()
  })

  it('caps idle ambient motion at 30 fps once transitions settle', async () => {
    const b = await make()
    b.setOnline(true)
    tick(600) // lights, monitors and camera have settled
    const before = draws.count
    tick(120) // two seconds at 60 Hz
    expect(draws.count - before).toBeLessThanOrEqual(61)
    expect(draws.count - before).toBeGreaterThan(0)
    b.dispose()
  })

  it('stops drawing entirely when idle under reduced motion', async () => {
    const b = await make(true)
    b.setOnline(true)
    tick(30)
    const before = draws.count
    tick(300)
    expect(draws.count).toBe(before)
    b.dispose()
  })
})
