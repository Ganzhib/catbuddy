import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptsDir = path.dirname(fileURLToPath(import.meta.url))
const gatewayRoot = path.resolve(scriptsDir, '..')
const monorepoRoot = path.resolve(gatewayRoot, '..')

/** gateway/.env 优先；learnbuddy/.env 仅补缺（与 gateway `load-env.ts` 一致）。 */
export function loadGatewayEnvFiles() {
  loadEnvFile(path.join(monorepoRoot, '.env'), false)
  loadEnvFile(path.join(gatewayRoot, '.env'), true)
}

function loadEnvFile(filePath, override) {
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
      if (override || process.env[key] === undefined) process.env[key] = val
    }
  } catch {
    /* ignore */
  }
}

export function resolveGatewayDataPaths() {
  const homedir = os.homedir()
  const dataDir = (
    process.env.GATEWAY_DATA_DIR
    || process.env.RELAY_DATA_DIR
    || ''
  ).trim()

  const usersBase = dataDir || path.join(homedir, '.learnbuddy-gateway')
  const workspaceBase =
    dataDir || path.join(homedir, '.learnbuddy-gateway', 'workspace')

  return {
    dataDir: dataDir || null,
    usersFile: path.join(usersBase, 'users.json'),
    sessionsDir: path.join(workspaceBase, 'sessions'),
  }
}
