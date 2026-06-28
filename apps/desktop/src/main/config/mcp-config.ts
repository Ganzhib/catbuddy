import type { McpServerConfig } from '@catbuddy/shared'

export function validateMcpServers(
  servers: unknown,
): Record<string, McpServerConfig> {
  if (!servers || typeof servers !== 'object' || Array.isArray(servers)) {
    throw new Error('MCP config must be a JSON object of server entries.')
  }

  const result: Record<string, McpServerConfig> = {}
  for (const [name, raw] of Object.entries(servers as Record<string, unknown>)) {
    if (!name.trim()) continue
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      throw new Error(`Server "${name}": config must be an object.`)
    }
    const cfg = raw as Record<string, unknown>
    const command = typeof cfg.command === 'string' ? cfg.command.trim() : ''
    if (!command) {
      throw new Error(`Server "${name}": "command" is required.`)
    }
    const entry: McpServerConfig = { command }
    if (cfg.args !== undefined) {
      if (!Array.isArray(cfg.args) || !cfg.args.every((a) => typeof a === 'string')) {
        throw new Error(`Server "${name}": "args" must be a string array.`)
      }
      entry.args = cfg.args
    }
    if (cfg.env !== undefined) {
      if (!cfg.env || typeof cfg.env !== 'object' || Array.isArray(cfg.env)) {
        throw new Error(`Server "${name}": "env" must be an object.`)
      }
      entry.env = Object.fromEntries(
        Object.entries(cfg.env as Record<string, unknown>).map(([k, v]) => [k, String(v)]),
      )
    }
    if (cfg.cwd !== undefined) {
      if (typeof cfg.cwd !== 'string') {
        throw new Error(`Server "${name}": "cwd" must be a string.`)
      }
      entry.cwd = cfg.cwd
    }
    if (cfg.toolTimeout !== undefined) {
      const n = Number(cfg.toolTimeout)
      if (Number.isNaN(n) || n < 1) {
        throw new Error(`Server "${name}": "toolTimeout" must be a positive number.`)
      }
      entry.toolTimeout = n
    }
    if (cfg.enabledTools !== undefined) {
      if (!Array.isArray(cfg.enabledTools) || !cfg.enabledTools.every((t) => typeof t === 'string')) {
        throw new Error(`Server "${name}": "enabledTools" must be a string array.`)
      }
      entry.enabledTools = cfg.enabledTools
    }
    result[name] = entry
  }
  return result
}

/** Accept pasted JSON: full config, `{ mcpServers: ... }`, or a single server object. */
export function parseMcpPaste(raw: string, defaultName = 'custom'): Record<string, McpServerConfig> {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw.trim())
  } catch {
    throw new Error('Invalid JSON. Paste a server config or tools.mcpServers object.')
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('MCP config must be a JSON object.')
  }
  const obj = parsed as Record<string, unknown>
  if (obj.mcpServers && typeof obj.mcpServers === 'object') {
    return validateMcpServers(obj.mcpServers)
  }
  if (typeof obj.command === 'string') {
    return validateMcpServers({ [defaultName]: obj })
  }
  return validateMcpServers(obj)
}
