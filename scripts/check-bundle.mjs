// Guards first-load cost after `npm run build`: the entry chunk must stay under
// budget and must not contain three.js (the 3D scenes are loaded lazily).
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const BUDGET_KB = 420 // entry chunk, minified (≈389 kB today)
const dir = 'dist/assets'

let entries
try {
  entries = readdirSync(dir).filter((f) => /^index-.*\.js$/.test(f))
} catch {
  console.error('check-bundle: dist/assets not found; run `npm run build` first.')
  process.exit(1)
}

let failed = false
for (const f of entries) {
  const path = join(dir, f)
  const kb = statSync(path).size / 1024
  const code = readFileSync(path, 'utf8')
  const leaks = ['WebGLRenderer', 'PMREMGenerator'].filter((s) => code.includes(s))
  console.log(`${f}: ${kb.toFixed(1)} kB (budget ${BUDGET_KB} kB)`)
  if (kb > BUDGET_KB) {
    console.error(`  over budget by ${(kb - BUDGET_KB).toFixed(1)} kB`)
    failed = true
  }
  if (leaks.length) {
    console.error(`  three.js leaked into the entry chunk (${leaks.join(', ')}); keep scene code behind import()`)
    failed = true
  }
}
process.exit(failed ? 1 : 0)
