/**
 * Asset manifest and loading with truthful progress: byte progress when the server
 * reports Content-Length, otherwise item counts — and the UI is told which one it is.
 */

export type AssetEntry = {
  id: string
  url: string
  kind: 'gltf'
  critical: boolean
  license: string
  /** What the experience does if this asset fails. */
  fallback: string
}

const base = typeof import.meta !== 'undefined' ? import.meta.env.BASE_URL : '/'

export const MANIFEST: AssetEntry[] = [
  {
    id: 'robot',
    url: `${base}models/robot/RobotExpressive.glb`,
    kind: 'gltf',
    critical: true,
    license: 'CC0 1.0 — see public/models/robot/LICENSE.md',
    fallback: 'Original procedural robot built in code',
  },
]

export type Progress = { loaded: number; total: number | null; unit: 'bytes' | 'items'; label: string }

/** Fetch with streaming byte progress, abortable, with a timeout. */
export async function fetchWithProgress(url: string, onProgress: (loaded: number, total: number | null) => void, signal: AbortSignal, timeoutMs = 20000): Promise<ArrayBuffer> {
  const ctl = new AbortController()
  const timer = setTimeout(() => ctl.abort(), timeoutMs)
  const onAbort = () => ctl.abort()
  signal.addEventListener('abort', onAbort)
  try {
    const res = await fetch(url, { signal: ctl.signal })
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`)
    const lenHeader = res.headers.get('content-length')
    const encoded = res.headers.get('content-encoding')
    // A compressed response's Content-Length is not the decoded size: report bytes only when exact.
    const total = lenHeader && !encoded ? Number(lenHeader) : null
    if (!res.body) {
      const buf = await res.arrayBuffer()
      onProgress(buf.byteLength, total)
      return buf
    }
    const reader = res.body.getReader()
    const chunks: Uint8Array[] = []
    let loaded = 0
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      chunks.push(value)
      loaded += value.byteLength
      onProgress(loaded, total)
    }
    const out = new Uint8Array(loaded)
    let off = 0
    for (const c of chunks) {
      out.set(c, off)
      off += c.byteLength
    }
    return out.buffer
  } finally {
    clearTimeout(timer)
    signal.removeEventListener('abort', onAbort)
  }
}
