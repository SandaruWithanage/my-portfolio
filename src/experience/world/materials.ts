import * as THREE from 'three'

/** Lab palette (matches the CSS tokens in experience.css). */
export const PALETTE = {
  night: 0x070b14,
  concrete: 0x2a313b,
  concreteDark: 0x1a2029,
  metal: 0x3a4552,
  metalDark: 0x161c24,
  cyan: 0x3fd8f2,
  amber: 0xf2b45a,
  violet: 0x9a7cff,
  green: 0x58e3a0,
  blue: 0x5b8cff,
  white: 0xe9eef5,
} as const

export const ACCENT: Record<'cyan' | 'amber' | 'violet' | 'green' | 'blue', number> = {
  cyan: PALETTE.cyan,
  amber: PALETTE.amber,
  violet: PALETTE.violet,
  green: PALETTE.green,
  blue: PALETTE.blue,
}

type Tracker = <T extends { dispose: () => void }>(o: T) => T

function canvas(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const g = c.getContext('2d')
  if (g) draw(g)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 4
  return t
}

/** Concrete floor tiles with fine seams and a little tonal variation (deterministic). */
export function floorTexture(): THREE.CanvasTexture {
  const t = canvas(256, 256, (g) => {
    g.fillStyle = '#262c35'
    g.fillRect(0, 0, 256, 256)
    let seed = 11
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
    for (let i = 0; i < 900; i++) {
      g.fillStyle = `rgba(255,255,255,${rnd() * 0.025})`
      g.fillRect(rnd() * 256, rnd() * 256, 2, 2)
    }
    g.strokeStyle = 'rgba(0,0,0,0.45)'
    g.lineWidth = 2
    for (let i = 0; i <= 256; i += 128) {
      g.beginPath()
      g.moveTo(i, 0)
      g.lineTo(i, 256)
      g.moveTo(0, i)
      g.lineTo(256, i)
      g.stroke()
    }
    g.strokeStyle = 'rgba(120,200,230,0.06)'
    g.lineWidth = 1
    for (let i = 32; i < 256; i += 32) {
      g.beginPath()
      g.moveTo(i, 0)
      g.lineTo(i, 256)
      g.moveTo(0, i)
      g.lineTo(256, i)
      g.stroke()
    }
  })
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  return t
}

/** Wall panelling: tall panels with seams, a vent band and bolt dots. */
export function wallTexture(): THREE.CanvasTexture {
  const t = canvas(256, 256, (g) => {
    const grad = g.createLinearGradient(0, 0, 0, 256)
    grad.addColorStop(0, '#2e3742')
    grad.addColorStop(1, '#222932')
    g.fillStyle = grad
    g.fillRect(0, 0, 256, 256)
    g.fillStyle = 'rgba(0,0,0,0.5)'
    g.fillRect(126, 0, 4, 256)
    g.fillRect(0, 200, 256, 3)
    g.fillStyle = 'rgba(0,0,0,0.35)'
    for (let x = 12; x < 120; x += 10) g.fillRect(x, 214, 5, 26)
    for (let x = 140; x < 248; x += 10) g.fillRect(x, 214, 5, 26)
    g.fillStyle = 'rgba(255,255,255,0.08)'
    for (const [x, y] of [
      [10, 10],
      [116, 10],
      [140, 10],
      [246, 10],
    ])
      g.fillRect(x - 2, y - 2, 4, 4)
  })
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  return t
}

/** Exterior facade: large precast panels with recessed window slits. */
export function facadeTexture(): THREE.CanvasTexture {
  const t = canvas(256, 256, (g) => {
    g.fillStyle = '#1c232c'
    g.fillRect(0, 0, 256, 256)
    g.fillStyle = '#141a21'
    g.fillRect(0, 124, 256, 8)
    g.fillRect(124, 0, 8, 256)
    g.fillStyle = 'rgba(63,216,242,0.22)'
    g.fillRect(20, 40, 84, 6)
    g.fillRect(152, 40, 84, 6)
    g.fillStyle = 'rgba(242,180,90,0.16)'
    g.fillRect(20, 172, 40, 4)
  })
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  return t
}

/**
 * Signage drawn to a canvas: title, optional subtitle and accent bar. Decorative —
 * the same names are always available in DOM (map, room directory, prompts).
 */
export function signTexture(title: string, subtitle: string, accent: number, width = 1024, height = 256): THREE.CanvasTexture {
  const hex = `#${accent.toString(16).padStart(6, '0')}`
  return canvas(width, height, (g) => {
    g.fillStyle = 'rgba(8,12,20,0.92)'
    g.fillRect(0, 0, width, height)
    g.fillStyle = hex
    g.fillRect(0, 0, 14, height)
    g.fillRect(14, height - 8, width - 14, 8)
    // Text always fits: shrink the font until the line fits the sign's width.
    const fit = (text: string, weight: number, size: number, family: string) => {
      let px = size
      do {
        g.font = `${weight} ${px}px ${family}`
        px -= 2
      } while (g.measureText(text).width > width - 90 && px > 10)
    }
    g.fillStyle = '#e9eef5'
    g.textBaseline = 'middle'
    fit(title.toUpperCase(), 700, Math.round(height * 0.36), 'system-ui, sans-serif')
    g.fillText(title.toUpperCase(), 52, height * 0.42)
    if (subtitle) {
      g.fillStyle = hex
      fit(subtitle.toUpperCase(), 500, Math.round(height * 0.15), 'ui-monospace, monospace')
      g.fillText(subtitle.toUpperCase(), 54, height * 0.78)
    }
  })
}

/** Panel of text lines for in-world screens (short labels only; full content is DOM). */
export function screenTexture(lines: string[], accent: number, width = 512, height = 320): THREE.CanvasTexture {
  const hex = `#${accent.toString(16).padStart(6, '0')}`
  return canvas(width, height, (g) => {
    g.fillStyle = '#060a12'
    g.fillRect(0, 0, width, height)
    g.fillStyle = 'rgba(63,216,242,0.05)'
    for (let y = 0; y < height; y += 4) g.fillRect(0, y, width, 1)
    g.strokeStyle = hex
    g.lineWidth = 4
    g.strokeRect(8, 8, width - 16, height - 16)
    g.textBaseline = 'top'
    lines.forEach((line, i) => {
      g.fillStyle = i === 0 ? hex : '#cfe7f2'
      g.font = i === 0 ? `700 ${Math.round(height * 0.12)}px system-ui, sans-serif` : `500 ${Math.round(height * 0.075)}px ui-monospace, monospace`
      g.fillText(line.length > 34 ? `${line.slice(0, 33)}…` : line, 28, 26 + (i === 0 ? 0 : 20 + i * height * 0.11))
    })
  })
}

/** Soft radial falloff used for glow pools and the robot's contact shadow. */
export function softTexture(): THREE.CanvasTexture {
  return canvas(128, 128, (g) => {
    const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64)
    grad.addColorStop(0, 'rgba(255,255,255,1)')
    grad.addColorStop(0.5, 'rgba(255,255,255,0.4)')
    grad.addColorStop(1, 'rgba(255,255,255,0)')
    g.fillStyle = grad
    g.fillRect(0, 0, 128, 128)
  })
}

/** Shared materials, created once per engine and disposed with it. */
export function createMaterials(track: Tracker) {
  const floorMap = track(floorTexture())
  const wallMap = track(wallTexture())
  const facadeMap = track(facadeTexture())
  const soft = track(softTexture())
  const emissive = (color: number, intensity = 1) =>
    track(new THREE.MeshStandardMaterial({ color: 0x0b0f16, emissive: color, emissiveIntensity: intensity, roughness: 0.4 }))
  return {
    soft,
    floor: track(new THREE.MeshStandardMaterial({ map: floorMap, color: 0xffffff, roughness: 0.82, metalness: 0.08 })),
    wall: track(new THREE.MeshStandardMaterial({ map: wallMap, color: 0xffffff, roughness: 0.78, metalness: 0.15 })),
    facade: track(new THREE.MeshStandardMaterial({ map: facadeMap, color: 0xffffff, roughness: 0.85, metalness: 0.1 })),
    ceiling: track(new THREE.MeshStandardMaterial({ color: 0x10151c, roughness: 0.95 })),
    metal: track(new THREE.MeshStandardMaterial({ color: PALETTE.metal, roughness: 0.38, metalness: 0.8 })),
    metalDark: track(new THREE.MeshStandardMaterial({ color: PALETTE.metalDark, roughness: 0.5, metalness: 0.7 })),
    rubber: track(new THREE.MeshStandardMaterial({ color: 0x0a0c10, roughness: 0.95 })),
    glass: track(new THREE.MeshPhysicalMaterial({ color: 0x9fdcf0, roughness: 0.05, metalness: 0, transmission: 0, transparent: true, opacity: 0.18 })),
    holo: (color: number, opacity = 0.55) =>
      track(new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending })),
    wire: (color: number, opacity = 0.6) => track(new THREE.MeshBasicMaterial({ color, wireframe: true, transparent: true, opacity })),
    emissive,
    trim: {
      cyan: emissive(PALETTE.cyan, 1.6),
      amber: emissive(PALETTE.amber, 1.4),
      violet: emissive(PALETTE.violet, 1.6),
      green: emissive(PALETTE.green, 1.4),
      blue: emissive(PALETTE.blue, 1.6),
    },
    glow: (color: number, opacity = 0.35) =>
      track(new THREE.MeshBasicMaterial({ map: soft, color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending })),
    shadow: track(new THREE.MeshBasicMaterial({ color: 0x000000, alphaMap: soft, transparent: true, opacity: 0.6, depthWrite: false })),
  }
}

export type Materials = ReturnType<typeof createMaterials>
