import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'
import { applyCatbuddyDevMode } from '@catbuddy/shared'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '../../../..')

/** Load repo root `.env` (+ `.env.production` when NODE_ENV=production). */
export function loadGatewayEnvFiles(): void {
  const base = path.join(repoRoot, '.env')
  const production = path.join(repoRoot, '.env.production')
  dotenv.config({ path: base })
  if (process.env.NODE_ENV === 'production') {
    dotenv.config({ path: production, override: true })
  } else {
    applyCatbuddyDevMode()
  }
}

loadGatewayEnvFiles()
