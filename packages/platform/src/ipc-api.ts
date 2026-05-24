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
  const config = await requireIpcBridge().getConfig()
  return {
    agent: {
      model: config.agents.defaults.model,
      provider: config.agents.defaults.provider,
      resolved_provider: config.agents.defaults.provider,
      has_api_key: true,
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
  if (update.model) await requireIpcBridge().setModel(update.model)
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

export async function listSlashCommandsIpc(
  _token: string,
  _base: string = '',
): Promise<SlashCommand[]> {
  return [
    { command: '/new', title: 'New Chat', description: 'Start a fresh conversation', icon: '✨', argHint: '' },
    { command: '/history', title: 'History', description: 'Show conversation history', icon: '📜', argHint: '' },
    { command: '/model', title: 'Switch Model', description: 'Switch the AI model for this session', icon: '🧠', argHint: '[model]' },
  ]
}
