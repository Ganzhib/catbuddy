import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/**
 * Load env before `config/env` reads process.env.
 * - `gateway/.env` is the primary config (standalone backend).
 * - `learnbuddy/.env` only fills keys not set in gateway (desktop shared vars).
 */
export function loadGatewayEnvFiles(): void {
  const gatewayRoot = path.resolve(__dirname, '../../..')
  const monorepoRoot = path.resolve(gatewayRoot, '..')
  loadEnvFile(path.join(monorepoRoot, '.env'), false)
  loadEnvFile(path.join(gatewayRoot, '.env'), true)
}

function loadEnvFile(filePath: string, override: boolean): void {
  try {
    if (!fs.existsSync(filePath)) return
    const text = fs.readFileSync(filePath, 'utf-8')
    for (const line of text.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const eq = trimmed.indexOf('=')
      if (eq <= 0) continue
      const key = trimmed.slice(0, eq).trim()
      let val = trimmed.slice(eq + 1).trim()
      if (
        (val.startsWith('"') && val.endsWith('"'))
        || (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1)
      }
      if (override || process.env[key] === undefined) {
        process.env[key] = val
      }
    }
  } catch {
    /* ignore */
  }
}

loadGatewayEnvFiles()
