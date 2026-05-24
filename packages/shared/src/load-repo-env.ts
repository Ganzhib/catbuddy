import path from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')

/** Load root `.env` (+ `.env.production` when `production` is true). */
export function loadRepoEnvFiles(options: { production?: boolean } = {}) {
  const production =
    options.production ?? process.env.NODE_ENV === 'production'
  dotenv.config({ path: path.join(repoRoot, '.env') })
  if (production) {
    dotenv.config({ path: path.join(repoRoot, '.env.production'), override: true })
  }
}
