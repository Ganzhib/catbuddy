import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/** Load `gateway/.env` (+ `.env.production` when NODE_ENV=production) before config reads process.env. */
export function loadGatewayEnvFiles(): void {
  const gatewayRoot = path.resolve(__dirname, '../../..')
  const base = path.join(gatewayRoot, '.env')
  const production = path.join(gatewayRoot, '.env.production')
  // Do not override existing env (Docker Compose / systemd inject MYSQL_HOST, secrets, etc.)
  dotenv.config({ path: base })
  if (process.env.NODE_ENV === 'production') {
    dotenv.config({ path: production, override: true })
  }
}

loadGatewayEnvFiles()
