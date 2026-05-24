import path from 'node:path'
import { fileURLToPath } from 'node:url'

/** Monorepo root (`catbuddy/`). */
export const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
