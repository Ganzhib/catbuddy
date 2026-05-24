/**
 * Persist catbuddy config to disk (strips ephemeral runtime fields).
 */
import * as fs from 'node:fs'
import * as path from 'node:path'
import type { catbuddyConfig } from "@catbuddy/shared"

export function saveConfig(configFile: string, config: catbuddyConfig): void {
  const dir = path.dirname(configFile)
  fs.mkdirSync(dir, { recursive: true })

  const snapshot = { ...config } as catbuddyConfig & { runtime?: unknown }
  delete snapshot.runtime

  const tmp = `${configFile}.${process.pid}.tmp`
  fs.writeFileSync(tmp, JSON.stringify(snapshot, null, 2), 'utf-8')
  fs.renameSync(tmp, configFile)
}
