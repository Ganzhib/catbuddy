import fs from 'node:fs'
import path from 'node:path'
import { applyCatbuddyDevMode } from '@catbuddy/shared'

export function loadEnvFile(filePath: string) {
  try {
    console.log('[main] Loading env from:', filePath, 'exists:', fs.existsSync(filePath))
    const content = fs.readFileSync(filePath, 'utf-8')
    for (const line of content.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const eq = trimmed.indexOf('=')
      if (eq === -1) continue
      const key = trimmed.slice(0, eq).trim()
      const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '')
      if (!process.env[key]) process.env[key] = val
    }
    console.log(
      '[main] .env loaded, DEEPSEEK_KEY=',
      process.env.DEEPSEEK_KEY ? 'SET' : 'NOT SET',
      'CATBUDDY_DEV_MODE=',
      process.env.CATBUDDY_DEV_MODE ?? '(unset)',
      'useLocal=',
      process.env.CATBUDDY_GATEWAY_USE_LOCAL ?? '(unset)',
    )
  } catch (err: any) { console.log('[main] No .env:', err.message) }
}

/** `apps/desktop/dist-electron` → monorepo root (`catbuddy/`). */
export function resolveRepoRoot(fromDir: string): string {
  return path.resolve(fromDir, '../../..')
}

/** Dev: repo root `.env`. Packaged: bundled `dist-electron/.env.production`. */
export function loadCatbuddyEnv(fromDir: string, packaged: boolean): void {
  if (packaged) {
    loadEnvFile(path.join(fromDir, '.env.production'))
    return
  }
  loadEnvFile(path.join(resolveRepoRoot(fromDir), '.env'))
  applyCatbuddyDevMode()
}
