import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/**
 * Load env before `config/env` reads process.env.
 * - `learnbuddy/.env` only fills keys not already set (desktop shared vars).
 * - `gateway/.env` is the primary config (standalone backend).
 */
export function loadGatewayEnvFiles(): void {
  const gatewayRoot = path.resolve(__dirname, '../../..')
  const monorepoRoot = path.resolve(gatewayRoot, '..')
  dotenv.config({ path: path.join(monorepoRoot, '.env'), override: false })
  dotenv.config({ path: path.join(gatewayRoot, '.env'), override: true })
}

loadGatewayEnvFiles()
