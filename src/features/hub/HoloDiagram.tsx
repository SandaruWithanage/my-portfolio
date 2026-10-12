/**
 * Holographic illustrations on the hub tiles, one per destination. Decorative only
 * (aria-hidden): the tile's text carries the meaning.
 */
export function HoloDiagram({ id }: { id: string }) {
  const s = { stroke: 'var(--holo)' }
  return (
    <svg className="holo-diagram" viewBox="0 0 200 100" fill="none" aria-hidden="true">
      {id === 'workshop' && (
        // Cloud service linked to two server stacks.
        <g strokeWidth="1.4" {...s}>
          <path d="M90 32c0-6 5-11 11-11 4 0 7 2 9 5 2-2 6-2 8 0 4 0 7 3 7 7 3 1 5 4 5 7 0 4-3 7-8 7H93c-5 0-8-4-8-8s3-7 5-7z" fill="rgba(56,225,255,0.12)" strokeDasharray="3 2" />
          {[25, 140].map((x) => (
            <g key={x}>
              <rect x={x} y="44" width="36" height="12" rx="2" fill="rgba(0,229,255,0.15)" />
              <rect x={x} y="59" width="36" height="12" rx="2" fill="rgba(0,229,255,0.15)" />
              {[50, 65].map((y) => [6, 11].map((dx) => <circle key={`${y}-${dx}`} cx={x + dx} cy={y} r="1.5" fill="var(--holo)" stroke="none" />))}
            </g>
          ))}
          <path d="M43 44V34h42M158 44V34h-30" strokeDasharray="2 2" />
          <path d="M61 65h79" strokeOpacity="0.6" />
        </g>
      )}
      {id === 'projects' && (
        // A system block with a smaller amber component beside it.
        <g strokeWidth="1.4" {...s}>
          <polygon points="120,14 160,34 120,54 80,34" fill="rgba(56,225,255,0.1)" />
          <polygon points="80,34 120,54 120,84 80,64" fill="rgba(0,229,255,0.18)" />
          <polygon points="160,34 120,54 120,84 160,64" fill="rgba(0,229,255,0.12)" />
          <path d="M80 50l40 20 40-20" strokeDasharray="2 2" strokeWidth="1" />
          <polygon points="56,58 70,65 56,72 42,65" fill="rgba(255,180,0,0.2)" />
          <polygon points="42,65 56,72 56,82 42,75" fill="rgba(255,180,0,0.3)" />
          <polygon points="70,65 56,72 56,82 70,75" fill="rgba(255,180,0,0.25)" />
        </g>
      )}
      {id === 'background' && (
        // Layered learning: stacked platforms under a mortarboard.
        <g strokeWidth="1.3" {...s}>
          <polygon points="100,72 155,53 100,34 45,53" fill="rgba(0,229,255,0.06)" />
          <polygon points="100,82 155,63 155,53 100,72 45,53 45,63" fill="rgba(0,229,255,0.1)" />
          <polygon points="100,58 145,42 100,26 55,42" fill="rgba(0,229,255,0.08)" />
          <polygon points="100,66 145,50 145,42 100,58 55,42 55,50" fill="rgba(0,229,255,0.12)" />
          <polygon points="100,36 140,22 100,8 60,22" fill="rgba(56,225,255,0.22)" strokeWidth="1.6" />
          <path d="M140 22v16" strokeWidth="1.5" />
          <circle cx="140" cy="40" r="2.5" fill="var(--holo)" stroke="none" />
        </g>
      )}
      {id === 'contact' && (
        // Identity portal: an operator inside radar rings.
        <g strokeWidth="1.8" {...s} transform="translate(60 10)">
          <circle cx="40" cy="40" r="38" strokeDasharray="3 3" strokeWidth="1.2" opacity="0.6" />
          <circle cx="40" cy="40" r="31" />
          <circle cx="40" cy="32" r="8" fill="rgba(56,225,255,0.15)" />
          <path d="M26 54c0-8 6-9 14-9s14 1 14 9" fill="rgba(56,225,255,0.12)" strokeLinecap="round" />
        </g>
      )}
    </svg>
  )
}
