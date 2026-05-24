/**
 * Vite server.watch.ignored — skip accidental tsc emit next to package .ts sources.
 */
import fs from 'node:fs'

const KEEP_DTS = new Set([
  'brand.d.ts',
  'preload-api.d.ts',
  'vite-env.d.ts',
  'react-syntax-highlighter-subpaths.d.ts',
])

/** @param {string} file */
export function ignorePackageEmit(file) {
  const norm = file.replace(/\\/g, '/')
  if (!norm.includes('/packages/')) return false

  if (norm.endsWith('.js.map') || norm.endsWith('.d.ts.map')) return true

  if (norm.endsWith('.js') && !norm.endsWith('brand.mjs')) {
    const ts = norm.replace(/\.js$/, '.ts')
    return fs.existsSync(ts)
  }

  if (norm.endsWith('.d.ts')) {
    const base = norm.slice(norm.lastIndexOf('/') + 1)
    if (KEEP_DTS.has(base)) return false
    const ts = norm.replace(/\.d\.ts$/, '.ts')
    return fs.existsSync(ts)
  }

  return false
}
