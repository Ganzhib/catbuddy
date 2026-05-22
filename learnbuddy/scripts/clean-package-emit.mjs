/**
 * Remove accidental TypeScript emit files co-located with package sources.
 * Run: node scripts/clean-package-emit.mjs  (or pnpm clean:packages)
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const packagesDir = path.join(root, 'packages')

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

let removed = 0
for (const pkg of fs.readdirSync(packagesDir, { withFileTypes: true })) {
  if (!pkg.isDirectory()) continue
  const src = path.join(packagesDir, pkg.name, 'src')
  if (!fs.existsSync(src)) continue
  for (const file of walk(src)) {
    if (!shouldRemove(file)) continue
    fs.unlinkSync(file)
    removed += 1
  }
}

console.log(`[clean-package-emit] removed ${removed} file(s) under packages/*/src`)
