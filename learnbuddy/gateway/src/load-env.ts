import * as fs from 'node:fs'
import * as path from 'node:path'

/** Load `learnbuddy/.env` and `gateway/.env` before `config/env` reads process.env. */
export function loadGatewayEnvFiles(): void {
  const gatewayRoot = path.resolve(__dirname, '..')
  const monorepoRoot = path.resolve(gatewayRoot, '..')
  for (const file of [
    path.join(monorepoRoot, '.env'),
    path.join(gatewayRoot, '.env'),
  ]) {
    loadEnvFile(file)
  }
}

function loadEnvFile(filePath: string): void {
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
      if (process.env[key] === undefined) process.env[key] = val
    }
  } catch {
    /* ignore */
  }
}

loadGatewayEnvFiles()
