/**
 * Remove accidental TypeScript emit files co-located with package/app sources.
 * Run: node scripts/clean-package-emit.mjs  (or pnpm clean:packages)
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

/** Hand-written declarations — never delete. */
const KEEP_DTS = new Set([
  'brand.d.ts',
  'preload-api.d.ts',
  'vite-env.d.ts',
  'react-syntax-highlighter-subpaths.d.ts',
])

function shouldRemove(file) {
  const base = path.basename(file)
  if (base === 'brand.mjs') return false
  if (file.endsWith('.js.map') || file.endsWith('.d.ts.map')) return true
  if (file.endsWith('.js')) return true
  if (file.endsWith('.d.ts') && KEEP_DTS.has(base)) return false
  if (file.endsWith('.d.ts')) return true
  return false
}

function walk(dir, out = []) {
  for (const name of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, name.name)
    if (name.isDirectory()) walk(full, out)
    else out.push(full)
  }
  return out
}

function cleanSrcUnder(parentDir) {
  if (!fs.existsSync(parentDir)) return 0
  let removed = 0
  for (const entry of fs.readdirSync(parentDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    const src = path.join(parentDir, entry.name, 'src')
    if (!fs.existsSync(src)) continue
    for (const file of walk(src)) {
      if (!shouldRemove(file)) continue
      fs.unlinkSync(file)
      removed += 1
    }
  }
  return removed
}

let removed = 0
removed += cleanSrcUnder(path.join(root, 'packages'))
removed += cleanSrcUnder(path.join(root, 'apps'))

console.log(
  `[clean-package-emit] removed ${removed} file(s) under packages/*/src and apps/*/src`,
)
