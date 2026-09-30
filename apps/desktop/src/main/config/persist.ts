/**
 * Persist catbuddy config to disk (strips ephemeral runtime fields).
 */
import * as fs from 'node:fs'
import * as path from 'node:path'
import type { catbuddyConfig } from "@catbuddy/shared"
import { stripEnvProviderKeys } from './env-provider-fallback.js'

export function saveConfig(configFile: string, config: catbuddyConfig): void {
  const dir = path.dirname(configFile)
  fs.mkdirSync(dir, { recursive: true })

  const snapshot = JSON.parse(JSON.stringify(config)) as catbuddyConfig & { runtime?: unknown }
  delete snapshot.runtime
  stripEnvProviderKeys(snapshot)

  const tmp = `${configFile}.${process.pid}.tmp`
  fs.writeFileSync(tmp, JSON.stringify(snapshot, null, 2), 'utf-8')
  fs.renameSync(tmp, configFile)
}

/** Renderer-safe snapshot; no credential-bearing field crosses the IPC boundary. */
export function sanitizeConfigForRenderer(config: catbuddyConfig): catbuddyConfig {
  const snapshot = JSON.parse(JSON.stringify(config)) as catbuddyConfig
  stripEnvProviderKeys(snapshot)
  for (const provider of Object.values(snapshot.providers)) {
    delete provider.extraHeaders
    delete provider.extraBody
  }
  if (snapshot.gateway?.secret) snapshot.gateway.secret = ''
  if (snapshot.langfuse?.secretKey) snapshot.langfuse.secretKey = ''
  for (const server of Object.values(snapshot.tools?.mcpServers ?? {})) {
    if (server.env) server.env = {}
  }
  return snapshot
}
