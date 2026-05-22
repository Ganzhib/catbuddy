import * as fs from 'node:fs'
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

/** MySQL 连接配置（与 `config/env.ts` 默认一致）。 */
export function resolveMysqlConfig() {
  const url = (
    process.env.DATABASE_URL
    || process.env.GATEWAY_DATABASE_URL
    || ''
  ).trim()
  if (url) return { url }
  return {
    host: process.env.MYSQL_HOST || process.env.GATEWAY_MYSQL_HOST || '127.0.0.1',
    port: Number(process.env.MYSQL_PORT || process.env.GATEWAY_MYSQL_PORT || 3306),
    user: process.env.MYSQL_USER || process.env.GATEWAY_MYSQL_USER || 'learnbuddy',
    password:
      process.env.MYSQL_PASSWORD || process.env.GATEWAY_MYSQL_PASSWORD || 'learnbuddy',
    database:
      process.env.MYSQL_DATABASE || process.env.GATEWAY_MYSQL_DATABASE || 'learnbuddy_gateway',
  }
}
