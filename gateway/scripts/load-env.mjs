import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'

const scriptsDir = path.dirname(fileURLToPath(import.meta.url))
const gatewayRoot = path.resolve(scriptsDir, '..')

/** gateway/.env（+ `.env.production` when NODE_ENV=production）。 */
export function loadGatewayEnvFiles() {
  dotenv.config({ path: path.join(gatewayRoot, '.env') })
  if (process.env.NODE_ENV === 'production') {
    dotenv.config({ path: path.join(gatewayRoot, '.env.production'), override: true })
  }
}

/** MySQL 连接配置（与 `config/env.ts` 默认一致；脚本侧保留 GATEWAY_* 别名）。 */
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
    user: process.env.MYSQL_USER || process.env.GATEWAY_MYSQL_USER || 'catbuddy',
    password:
      process.env.MYSQL_PASSWORD || process.env.GATEWAY_MYSQL_PASSWORD || 'catbuddy',
    database:
      process.env.MYSQL_DATABASE || process.env.GATEWAY_MYSQL_DATABASE || 'catbuddy_gateway',
  }
}
