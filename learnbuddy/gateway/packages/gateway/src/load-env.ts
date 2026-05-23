import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/** Load `gateway/.env` before `config/env` reads process.env. */
export function loadGatewayEnvFiles(): void {
  const gatewayRoot = path.resolve(__dirname, '../../..')
  dotenv.config({ path: path.join(gatewayRoot, '.env'), override: true })
}

loadGatewayEnvFiles()
