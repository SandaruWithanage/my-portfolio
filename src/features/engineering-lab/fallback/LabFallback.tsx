export function LabFallback({ reason }: { reason: string }) {
  return (
    <div className="lab-fallback" role="note">
      <p className="eyebrow">2D view</p>
      <p>{reason}</p>
      <p className="muted">All project information is available in the list below.</p>
    </div>
  )
}
