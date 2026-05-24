/**
 * MCP client: connects to MCP servers and wraps their tools as native tools.
 * 对应 example/agent/tools/mcp.py
 */
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import type { Tool as McpToolDef } from '@modelcontextprotocol/sdk/types.js'
import * as fs from 'node:fs'
import * as path from 'node:path'
import type { McpServerConfig, ToolCallRequest, ToolsConfig } from '@catbuddy/shared'
import type { Tool } from './types'
import type { ToolRegistry } from './registry'

const DEFAULT_TOOL_TIMEOUT_S = 30
const TRANSIENT_EXC_NAMES = new Set([
  'ClosedResourceError',
  'BrokenResourceError',
  'EndOfStream',
  'BrokenPipeError',
  'ECONNRESET',
  'ECONNREFUSED',
  'ECONNABORTED',
  'ConnectionError',
])
const WINDOWS_SHELL_LAUNCHERS = new Set(['npx', 'npm', 'pnpm', 'yarn', 'bunx'])

interface McpServerHandle {
  name: string
  client: Client
  transport: StdioClientTransport
}

/** Sanitize MCP-derived names for model API compatibility. */
export function sanitizeMcpName(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .replace(/_+/g, '_')
}

function isTransient(err: unknown): boolean {
  const name = err instanceof Error ? err.constructor.name : ''
  return TRANSIENT_EXC_NAMES.has(name)
}

function windowsCommandBasename(command: string): string {
  return command.replace(/\\/g, '/').split('/').pop()?.toLowerCase() ?? command.toLowerCase()
}

/** Wrap Windows shell launchers so MCP stdio servers start reliably. */
export function normalizeWindowsStdioCommand(
  command: string,
  args: string[] | undefined,
  env: Record<string, string> | undefined,
): { command: string; args: string[]; env: Record<string, string> | undefined } {
  const normalizedArgs = [...(args ?? [])]
  if (process.platform !== 'win32') {
    return { command, args: normalizedArgs, env }
  }

  const basename = windowsCommandBasename(command)
  if (
    ['cmd', 'cmd.exe', 'powershell', 'powershell.exe', 'pwsh', 'pwsh.exe'].includes(basename)
  ) {
    return { command, args: normalizedArgs, env }
  }
  if (basename.endsWith('.exe') || basename.endsWith('.com')) {
    return { command, args: normalizedArgs, env }
  }

  const pathEnv = env?.PATH ?? env?.Path ?? process.env.PATH ?? ''
  const resolved = pathEnv
    ? requireWhich(command, pathEnv)
    : command
  const resolvedBase = windowsCommandBasename(resolved)
  const shouldWrap =
    WINDOWS_SHELL_LAUNCHERS.has(basename)
    || basename.endsWith('.cmd')
    || basename.endsWith('.bat')
    || resolvedBase.endsWith('.cmd')
    || resolvedBase.endsWith('.bat')

  if (!shouldWrap) {
    return { command, args: normalizedArgs, env }
  }

  const comspec = env?.COMSPEC ?? process.env.COMSPEC ?? 'cmd.exe'
  return {
    command: comspec,
    args: ['/d', '/c', command, ...normalizedArgs],
    env,
  }
}

function requireWhich(command: string, pathEnv: string): string {
  const parts = pathEnv.split(path.delimiter)
  const extensions = process.env.PATHEXT?.split(';') ?? ['.EXE', '.CMD', '.BAT', '.COM']
  for (const dir of parts) {
    for (const ext of ['', ...extensions]) {
      const candidate = path.join(dir, command + ext)
      try {
        fs.accessSync(candidate)
        return candidate
      } catch {
        // continue
      }
    }
  }
  return command
}

function extractNullableBranch(
  options: unknown,
): { branch: Record<string, unknown>; nullable: boolean } | null {
  if (!Array.isArray(options)) return null
  const nonNull: Record<string, unknown>[] = []
  let sawNull = false
  for (const option of options) {
    if (!option || typeof option !== 'object') return null
    const o = option as Record<string, unknown>
    if (o.type === 'null') {
      sawNull = true
      continue
    }
    nonNull.push(o)
  }
  if (sawNull && nonNull.length === 1) {
    return { branch: nonNull[0]!, nullable: true }
  }
  return null
}

/** Normalize nullable JSON Schema patterns for OpenAI tool definitions. */
export function normalizeSchemaForOpenai(schema: unknown): Record<string, unknown> {
  if (!schema || typeof schema !== 'object') {
    return { type: 'object', properties: {} }
  }

  const normalized: Record<string, unknown> = { ...(schema as Record<string, unknown>) }

  const rawType = normalized.type
  if (Array.isArray(rawType)) {
    const nonNull = rawType.filter((t) => t !== 'null')
    if (rawType.includes('null') && nonNull.length === 1) {
      normalized.type = nonNull[0]
      normalized.nullable = true
    }
  }

  for (const key of ['oneOf', 'anyOf'] as const) {
    const branch = extractNullableBranch(normalized[key])
    if (branch) {
      const { [key]: _removed, ...rest } = normalized
      void _removed
      Object.assign(normalized, rest, branch.branch)
      if (branch.nullable) normalized.nullable = true
      break
    }
  }

  const props = normalized.properties
  if (props && typeof props === 'object') {
    const next: Record<string, unknown> = {}
    for (const [name, prop] of Object.entries(props as Record<string, unknown>)) {
      next[name] = typeof prop === 'object' ? normalizeSchemaForOpenai(prop) : prop
    }
    normalized.properties = next
  }

  if (normalized.items && typeof normalized.items === 'object') {
    normalized.items = normalizeSchemaForOpenai(normalized.items)
  }

  if (normalized.type !== 'object') {
    return normalized
  }

  normalized.properties ??= {}
  normalized.required ??= []
  return normalized
}

function formatCallToolResult(result: {
  content?: Array<{ type: string; text?: string; [k: string]: unknown }>
  isError?: boolean
}): string {
  const parts: string[] = []
  for (const block of result.content ?? []) {
    if (block.type === 'text' && typeof block.text === 'string') {
      parts.push(block.text)
    } else {
      parts.push(JSON.stringify(block))
    }
  }
  const text = parts.join('\n') || '(no output)'
  return result.isError ? `(MCP error) ${text}` : text
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('TimeoutError')), ms)
    promise.then(
      (v) => {
        clearTimeout(timer)
        resolve(v)
      },
      (e) => {
        clearTimeout(timer)
        reject(e)
      },
    )
  })
}

/** Wraps a single MCP server tool (MCPToolWrapper). */
export function createMcpToolWrapper(
  client: Client,
  serverName: string,
  toolDef: McpToolDef,
  toolTimeoutS = DEFAULT_TOOL_TIMEOUT_S,
): Tool {
  const originalName = toolDef.name
  const name = sanitizeMcpName(`mcp_${serverName}_${toolDef.name}`)
  const description = toolDef.description ?? toolDef.name
  const parameters = normalizeSchemaForOpenai(
    toolDef.inputSchema ?? { type: 'object', properties: {} },
  )

  return {
    name,
    definition: {
      type: 'function',
      function: { name, description, parameters },
    },
    execute: async (call: ToolCallRequest) => executeMcpTool(
      client,
      originalName,
      name,
      call.arguments,
      toolTimeoutS,
    ),
  }
}

async function executeMcpTool(
  client: Client,
  originalName: string,
  displayName: string,
  args: Record<string, unknown>,
  toolTimeoutS: number,
): Promise<string> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const result = await withTimeout(
        client.callTool({ name: originalName, arguments: args }),
        toolTimeoutS * 1000,
      )
      return formatCallToolResult(result as Parameters<typeof formatCallToolResult>[0])
    } catch (err: unknown) {
      const errName = err instanceof Error ? err.constructor.name : 'Error'
      if (errName === 'TimeoutError') {
        return `(MCP tool call timed out after ${toolTimeoutS}s)`
      }
      if (isTransient(err) && attempt === 0) {
        console.warn(`[MCP] ${displayName} transient error, retrying...`)
        await new Promise((r) => setTimeout(r, 1000))
        continue
      }
      const message = err instanceof Error ? err.message : String(err)
      console.error(`[MCP] ${displayName} failed:`, message)
      return `(MCP tool call failed: ${errName})`
    }
  }
  return '(MCP tool call failed)'
}

/** Connect to configured MCP servers and register their tools. */
export async function connectMcpServers(
  mcpServers: Record<string, McpServerConfig>,
  registry: ToolRegistry,
): Promise<McpServerHandle[]> {
  const handles: McpServerHandle[] = []

  for (const [name, cfg] of Object.entries(mcpServers)) {
    if (!cfg.command?.trim()) {
      console.warn(`[McpManager] server '${name}': no command, skipping`)
      continue
    }

    try {
      const { command, args, env } = normalizeWindowsStdioCommand(
        cfg.command,
        cfg.args,
        cfg.env,
      )
      const transport = new StdioClientTransport({
        command,
        args,
        env: env ? { ...process.env, ...env } as Record<string, string> : undefined,
        cwd: cfg.cwd,
        stderr: 'pipe',
      })
      const client = new Client({ name: 'catbuddy-desktop', version: '0.1.0' })
      await client.connect(transport)

      const { tools } = await client.listTools()
      const enabled = new Set(cfg.enabledTools ?? [])
      const allowAll = enabled.has('*')
      let registered = 0

      for (const toolDef of tools) {
        const wrapped = sanitizeMcpName(`mcp_${name}_${toolDef.name}`)
        if (
          !allowAll
          && enabled.size > 0
          && !enabled.has(toolDef.name)
          && !enabled.has(wrapped)
        ) {
          continue
        }
        registry.register(createMcpToolWrapper(
          client,
          name,
          toolDef,
          cfg.toolTimeout ?? DEFAULT_TOOL_TIMEOUT_S,
        ))
        registered++
      }

      console.info(`[McpManager] '${name}': connected, ${registered} tool(s)`)
      handles.push({ name, client, transport })
    } catch (err) {
      console.error(`[McpManager] failed to connect '${name}':`, err)
    }
  }

  return handles
}

export class McpManager {
  private _handles: McpServerHandle[] = []
  private _registry: ToolRegistry | null = null
  private _connected = false

  constructor(private readonly _servers: ToolsConfig['mcpServers']) {}

  get connected(): boolean {
    return this._connected
  }

  get registeredToolNames(): string[] {
    return this._handles.flatMap((h) =>
      [...(this._registry?.toolNames ?? [])].filter((n) =>
        n.startsWith(`mcp_${h.name}_`),
      ),
    )
  }

  /** Register mcp_reload + connect servers from config. */
  async registerTools(registry: ToolRegistry): Promise<string[]> {
    this._registry = registry
    const names: string[] = ['mcp_reload']
    registry.register(createMcpReloadTool(this))

    const servers = this._servers
    if (!servers || Object.keys(servers).length === 0) {
      this._connected = false
      return names
    }

    await this._connectAll()
    return [...names, ...this._listMcpToolNames()]
  }

  async reload(): Promise<string> {
    await this._disconnectAll()
    if (this._registry) {
      const removed = this._registry.unregisterByPrefix('mcp_')
      if (removed.length > 0) {
        console.info(`[McpManager] unregistered ${removed.length} MCP tool(s)`)
      }
    }

    const count = this._servers ? Object.keys(this._servers).length : 0
    if (count === 0) {
      this._connected = false
      return 'No MCP servers configured in tools.mcpServers.'
    }

    await this._connectAll()
    const toolCount = this._listMcpToolNames().length
    this._connected = this._handles.length > 0
    return (
      `MCP reloaded: ${this._handles.length}/${count} server(s) connected, `
      + `${toolCount} tool(s) registered.`
    )
  }

  async disconnect(): Promise<void> {
    await this._disconnectAll()
    this._connected = false
  }

  private async _connectAll(): Promise<void> {
    if (!this._registry || !this._servers) return
    this._handles = await connectMcpServers(this._servers, this._registry)
    this._connected = this._handles.length > 0
  }

  private async _disconnectAll(): Promise<void> {
    for (const handle of this._handles) {
      try {
        await handle.client.close()
      } catch (err) {
        console.warn(`[McpManager] close '${handle.name}':`, err)
      }
    }
    this._handles = []
  }

  private _listMcpToolNames(): string[] {
    if (!this._registry) return []
    return this._registry.toolNames.filter((n) => n.startsWith('mcp_') && n !== 'mcp_reload')
  }
}

function createMcpReloadTool(manager: McpManager): Tool {
  return {
    name: 'mcp_reload',
    definition: {
      type: 'function',
      function: {
        name: 'mcp_reload',
        description:
          'Reload MCP server connections from config without restarting the app.',
        parameters: { type: 'object', properties: {} },
      },
    },
    execute: async () => manager.reload(),
  }
}
