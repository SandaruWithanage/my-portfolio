/**
 * Small line diagrams on the hub tiles, one per destination, hinting at what the
 * screen contains. Decorative only (aria-hidden): the tile's text carries the meaning.
 */
export function HoloDiagram({ id }: { id: string }) {
  return (
    <svg className="holo-diagram" viewBox="0 0 96 64" fill="none" stroke="currentColor" strokeWidth="1.2" aria-hidden="true">
      {id === 'workshop' && (
        // System graph: gateway fanning out to services and a datastore.
        <>
          <rect x="4" y="26" width="18" height="12" rx="2" />
          <rect x="38" y="6" width="18" height="12" rx="2" />
          <rect x="38" y="46" width="18" height="12" rx="2" />
          <path d="M72 22h20v20H72z" className="holo-diagram-accent" />
          <path d="M22 32h8l8-20M30 32l8 20M56 12l16 14M56 52l16-14" />
          <circle cx="30" cy="32" r="2" />
        </>
      )}
      {id === 'projects' && (
        // Stacked isometric modules: shipped systems.
        <>
          <path d="M48 6l22 11-22 11-22-11z" />
          <path d="M26 17v12l22 11 22-11V17" />
          <path d="M26 31v12l22 11 22-11V31" className="holo-diagram-accent" />
          <path d="M48 28v26" />
        </>
      )}
      {id === 'background' && (
        // Skill stack and a timeline: experience layered over time.
        <>
          <path d="M8 54h80" />
          <circle cx="16" cy="54" r="2.5" />
          <circle cx="48" cy="54" r="2.5" />
          <circle cx="80" cy="54" r="2.5" className="holo-diagram-accent" />
          <rect x="30" y="34" width="36" height="8" rx="1.5" />
          <rect x="34" y="22" width="28" height="8" rx="1.5" />
          <rect x="38" y="10" width="20" height="8" rx="1.5" className="holo-diagram-accent" />
        </>
      )}
      {id === 'contact' && (
        // Identification card with a signal mark.
        <>
          <rect x="8" y="10" width="56" height="44" rx="4" />
          <circle cx="24" cy="28" r="7" />
          <path d="M13 46c2-6 20-6 22 0M42 24h14M42 32h10" />
          <path d="M72 22a14 14 0 0 1 0 20M78 16a22 22 0 0 1 0 32" className="holo-diagram-accent" />
        </>
      )}
    </svg>
  )
}
