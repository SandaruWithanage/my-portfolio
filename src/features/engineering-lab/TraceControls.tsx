import { graphTraces, type Trace } from '../../data/eduverse-graph'

type Props = {
  trace: Trace | null
  step: number
  playing: boolean
  onStart: (id: string) => void
  onStep: (delta: 1 | -1) => void
  onPlay: () => void
  onReset: () => void
}

export function TraceControls({ trace, step, playing, onStart, onStep, onPlay, onReset }: Props) {
  const last = trace ? trace.steps.length - 1 : 0
  return (
    <div className="trace" role="group" aria-labelledby="trace-title">
      <p id="trace-title" className="eyebrow">
        Trace a request
      </p>
      <div className="trace-picks">
        {graphTraces.map((t) => (
          <button
            key={t.id}
            type="button"
            className="btn"
            aria-pressed={trace?.id === t.id}
            onClick={() => (trace?.id === t.id ? onReset() : onStart(t.id))}
          >
            {t.title}
          </button>
        ))}
      </div>
      {trace && (
        <div className="trace-run">
          <div className="trace-buttons">
            <button type="button" className="btn" onClick={() => onStep(-1)} disabled={step <= 0}>
              Previous
            </button>
            <button type="button" className="btn" onClick={() => onStep(1)} disabled={step >= last}>
              Next
            </button>
            <button type="button" className="btn" onClick={onPlay} disabled={step >= last}>
              {playing ? 'Pause' : 'Play'}
            </button>
            <button type="button" className="btn" onClick={onReset}>
              Reset
            </button>
          </div>
          <p className="trace-caption" aria-live="polite">
            <strong>
              Step {step + 1} of {trace.steps.length}:
            </strong>{' '}
            {trace.steps[step].caption}
          </p>
        </div>
      )}
    </div>
  )
}
