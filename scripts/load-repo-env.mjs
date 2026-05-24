import path from 'node:path'
import dotenv from 'dotenv'
import { repoRoot } from './repo-root.mjs'

/** Load root `.env` (+ `.env.production` when `production` is true). */
export function loadRepoEnvFiles(options = {}) {
  const production =
    options.production ?? process.env.NODE_ENV === 'production'
  dotenv.config({ path: path.join(repoRoot, '.env') })
  if (production) {
    dotenv.config({ path: path.join(repoRoot, '.env.production'), override: true })
  }
}
