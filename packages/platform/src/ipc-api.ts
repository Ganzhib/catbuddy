import type {
  ChatSummary,
  SessionInfo,
  SettingsPayload,
  SettingsUpdate,
  SlashCommand,
  WebuiThreadPersistedPayload,
  ProviderSettingsUpdate,
  WebSearchSettingsUpdate,
} from '@catbuddy/shared'
import { DESKTOP_BUILTIN_SLASH_COMMANDS } from '@catbuddy/shared'
import { requireIpcBridge } from './ipc-bridge'

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
    this.name = 'ApiError'
  }
}

function splitKey(key: string): { channel: string; chatId: string } {
  const idx = key.indexOf(':')
  if (idx === -1) return { channel: '', chatId: key }
  return { channel: key.slice(0, idx), chatId: key.slice(idx + 1) }
}

export async function listSessionsIpc(
  _token: string,
  _base: string = '',
): Promise<ChatSummary[]> {
  const sessions = await requireIpcBridge().listSessions()
  return sessions.map((s: SessionInfo) => ({
    key: s.key,
    ...splitKey(s.key),
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
    title: s.title ?? '',
    preview: s.preview ?? '',
    workspaceFolderId:
      typeof s.metadata?.workspaceFolderId === 'string'
        ? s.metadata.workspaceFolderId
        : null,
    workspaceFolderName:
      typeof s.metadata?.workspaceFolderName === 'string'
        ? s.metadata.workspaceFolderName
        : null,
  }))
}

export async function fetchWebuiThreadIpc(
  _token: string,
  key: string,
  _base: string = '',
): Promise<WebuiThreadPersistedPayload | null> {
  const session = await requireIpcBridge().getSession(key)
  if (!session) return null

  const result: WebuiThreadPersistedPayload = {
    schemaVersion: 1,
    sessionKey: session.key,
    savedAt: session.updatedAt,
    messages: [],
  }

  for (const m of session.messages) {
    if (m.role === 'tool') {
      result.messages.push({
        id: String(m.id),
        role: 'assistant',
        kind: 'trace',
        traces: [`${m.name}: ${m.content}`],
        createdAt: new Date(m.timestamp).getTime(),
        content: '',
      })
    } else {
      result.messages.push({
        id: String(m.id),
        role: m.role as 'user' | 'assistant' | 'system',
        content: m.content,
        createdAt: new Date(m.timestamp).getTime(),
      })
    }
  }

  return result
}

export async function deleteSessionIpc(
  _token: string,
  key: string,
  _base: string = '',
): Promise<boolean> {
  return requireIpcBridge().deleteSession(key)
}

export async function fetchSettingsIpc(
  _token: string,
  _base: string = '',
): Promise<SettingsPayload> {
  const api = requireIpcBridge()
  if (api.getSettingsPayload) {
    return api.getSettingsPayload()
  }
  const config = await api.getConfig()
  return {
    agent: {
      model: config.agents.defaults.model,
      provider: config.agents.defaults.provider,
      resolved_provider: config.agents.defaults.provider,
      has_api_key: true,
      model_options: {},
    },
    providers: Object.entries(config.providers).map(([name, p]) => ({
      name,
      label: name,
      configured: !!(p as { apiKey?: string }).apiKey,
      api_key_required: true,
      api_key_hint: null,
      api_base: (p as { apiBase?: string }).apiBase ?? null,
      default_api_base: null,
    })),
    web_search: {
      provider: config.tools.web.searchProvider ?? 'ddg',
      providers: [{ name: 'ddg', label: 'DuckDuckGo', credential: 'none' as const }],
    },
    runtime: { config_path: (config as { runtime?: { config_path?: string } }).runtime?.config_path || '' },
    requires_restart: false,
  }
}

export async function updateSettingsIpc(
  _token: string,
  update: SettingsUpdate,
  _base: string = '',
): Promise<SettingsPayload> {
  if (update.model) await requireIpcBridge().updateConfig('agents.defaults.model', update.model)
  if (update.provider) await requireIpcBridge().updateConfig('agents.defaults.provider', update.provider)
  return fetchSettingsIpc(_token, _base)
}

export async function updateProviderSettingsIpc(
  _token: string,
  update: ProviderSettingsUpdate,
  _base: string = '',
): Promise<SettingsPayload> {
  const path = `providers.${update.provider}`
  if (update.apiKey !== undefined) await requireIpcBridge().updateConfig(`${path}.apiKey`, update.apiKey)
  if (update.apiBase !== undefined) await requireIpcBridge().updateConfig(`${path}.apiBase`, update.apiBase)
  return fetchSettingsIpc(_token, _base)
}

export async function updateWebSearchSettingsIpc(
  _token: string,
  _update: WebSearchSettingsUpdate,
  _base: string = '',
): Promise<SettingsPayload> {
  return fetchSettingsIpc(_token, _base)
}

export async function fetchMcpSettingsIpc(
  _token: string,
  _base: string = '',
): Promise<import('@catbuddy/shared').McpSettingsPayload> {
  const api = requireIpcBridge()
  if (!api.getMcpSettings) {
    throw new ApiError(501, 'MCP settings are only available in the desktop app.')
  }
  return api.getMcpSettings()
}

export async function updateMcpServersIpc(
  _token: string,
  servers: Record<string, import('@catbuddy/shared').McpServerConfig>,
  _base: string = '',
): Promise<import('@catbuddy/shared').McpSettingsUpdateResult> {
  const api = requireIpcBridge()
  if (!api.updateMcpServers) {
    throw new ApiError(501, 'MCP settings are only available in the desktop app.')
  }
  return api.updateMcpServers(servers)
}

export async function fetchMcpMarketplaceIpc(
  _token: string,
  _base: string = '',
): Promise<import('@catbuddy/shared').McpMarketplaceEntry[]> {
  const api = requireIpcBridge()
  if (!api.listMcpMarketplace) {
    throw new ApiError(501, 'MCP marketplace is only available in the desktop app.')
  }
  return api.listMcpMarketplace()
}

export async function addMcpFromMarketplaceIpc(
  _token: string,
  id: string,
  _base: string = '',
): Promise<import('@catbuddy/shared').McpSettingsUpdateResult> {
  const api = requireIpcBridge()
  if (!api.addMcpFromMarketplace) {
    throw new ApiError(501, 'MCP marketplace is only available in the desktop app.')
  }
  return api.addMcpFromMarketplace(id)
}

export async function fetchSkillMarketplaceIpc(
  _token: string,
  _base: string = '',
): Promise<import('@catbuddy/shared').SkillMarketplaceEntry[]> {
  const api = requireIpcBridge()
  if (!api.listSkillMarketplace) {
    throw new ApiError(501, 'Skill marketplace is only available in the desktop app.')
  }
  return api.listSkillMarketplace()
}

export async function installSkillFromMarketplaceIpc(
  _token: string,
  id: string,
  _base: string = '',
): Promise<import('@catbuddy/shared').SkillInstallResult> {
  const api = requireIpcBridge()
  if (!api.installSkillFromMarketplace) {
    throw new ApiError(501, 'Skill marketplace is only available in the desktop app.')
  }
  return api.installSkillFromMarketplace(id)
}

export async function listSkillsIpc(
  _token: string,
  _base: string = '',
): Promise<import('@catbuddy/shared').SkillInfo[]> {
  const api = requireIpcBridge()
  if (!api.listSkills) {
    throw new ApiError(501, 'Skills are only available in the desktop app.')
  }
  return api.listSkills()
}

export async function toggleSkillIpc(
  _token: string,
  name: string,
  enabled: boolean,
  _base: string = '',
): Promise<void> {
  const api = requireIpcBridge()
  if (!api.toggleSkill) {
    throw new ApiError(501, 'Skills are only available in the desktop app.')
  }
  await api.toggleSkill(name, enabled)
}

export async function listSlashCommandsIpc(
  _token: string,
  _base: string = '',
): Promise<SlashCommand[]> {
  try {
    const api = requireIpcBridge()
    if (typeof api.listSlashCommands === 'function') {
      const commands = await api.listSlashCommands()
      if (Array.isArray(commands) && commands.length > 0) {
        return commands
      }
    }
  } catch {
    /* fall through to bundled list */
  }
  return DESKTOP_BUILTIN_SLASH_COMMANDS
}
