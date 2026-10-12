import { ArchitectureDiagram } from '../ArchitectureDiagram'

type Props = {
  reason: string
  selectedId: string | null
  trace: { edgeIds: string[]; step: number } | null
  onSelect: (id: string) => void
}

export function LabFallback({ reason, selectedId, trace, onSelect }: Props) {
  return (
    <div className="lab-fallback">
      <p className="lab-fallback-note" role="note">
        2D view: {reason}
      </p>
      <ArchitectureDiagram selectedId={selectedId} trace={trace} onSelect={onSelect} />
    </div>
  )
}
