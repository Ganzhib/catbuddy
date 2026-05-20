/**
 * IPC-based API — 替代 HTTP /api/* 调用
 */
import type {
  ChatSummary, SettingsPayload, SettingsUpdate,
  SlashCommand, WebuiThreadPersistedPayload,
  ProviderSettingsUpdate, WebSearchSettingsUpdate,
} from './types'

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

/** 列出所有会话 */
export async function listSessions(
  _token: string,
  _base: string = '',
): Promise<ChatSummary[]> {
  const sessions = await window.nanobot.listSessions()
  return sessions.map(s => ({
    key: s.key,
    ...splitKey(s.key),
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
    title: s.title ?? '',
    preview: s.preview ?? '',
  }))
}

/** 获取某会话的完整消息历史 */
export async function fetchWebuiThread(
  _token: string,
  key: string,
  _base: string = '',
): Promise<WebuiThreadPersistedPayload | null> {
  const session = await window.nanobot.getSession(key)
  if (!session) return null

  const result: WebuiThreadPersistedPayload = {
    schemaVersion: 1,
    sessionKey: session.key,
    savedAt: session.updatedAt,
    messages: [],
  }

  for (const m of session.messages) {
    if (m.role === 'tool') {
      // 将 tool 内部消息转换为 trace 行，保持与 Agent 执行时一致的展示方式
      result.messages.push({
        id: String(m.id),
        role: 'assistant',
        kind: 'trace',
        traces: [
          `${m.name}: ${m.content}`,
        ],
        createdAt: new Date(m.timestamp).getTime(),
        content: ''
      })
    } else {
      result.messages.push({
        id: String(m.id),
        role: m.role as any,
        content: m.content,
        createdAt: new Date(m.timestamp).getTime(),
      })
    }
  }

  return result
}

/** 删除会话 */
export async function deleteSession(
  _token: string,
  key: string,
  _base: string = '',
): Promise<boolean> {
  return window.nanobot.deleteSession(key)
}

/** 获取设置 */
export async function fetchSettings(
  _token: string,
  _base: string = '',
): Promise<SettingsPayload> {
  const config = await window.nanobot.getConfig()
  return {
    agent: {
      model: config.agents.defaults.model,
      provider: config.agents.defaults.provider,
      resolved_provider: config.agents.defaults.provider,
      has_api_key: true,
    },
    providers: Object.entries(config.providers).map(([name, p]: [string, any]) => ({
      name,
      label: name,
      configured: !!p.apiKey,
      api_key_required: true,
      api_key_hint: null,
      api_base: p.apiBase ?? null,
      default_api_base: null,
    })),
    web_search: {
      provider: config.tools.web.searchProvider ?? 'ddg',
      providers: [{ name: 'ddg', label: 'DuckDuckGo', credential: 'none' as const }],
    },
    runtime: { config_path: (config as any).runtime?.config_path || '' },
    requires_restart: false,  // 桌面版实时切换，无需重启
  }
}

/** 更新设置 */
export async function updateSettings(
  _token: string,
  update: SettingsUpdate,
  _base: string = '',
): Promise<SettingsPayload> {
  if (update.model) await window.nanobot.setModel(update.model)
  return fetchSettings(_token, _base)
}

/** 更新 provider 设置 */
export async function updateProviderSettings(
  _token: string,
  update: ProviderSettingsUpdate,
  _base: string = '',
): Promise<SettingsPayload> {
  const path = `providers.${update.provider}`
  if (update.apiKey !== undefined) await window.nanobot.updateConfig(`${path}.apiKey`, update.apiKey)
  if (update.apiBase !== undefined) await window.nanobot.updateConfig(`${path}.apiBase`, update.apiBase)
  return fetchSettings(_token, _base)
}

/** 更新 web search 设置 */
export async function updateWebSearchSettings(
  _token: string,
  update: WebSearchSettingsUpdate,
  _base: string = '',
): Promise<SettingsPayload> {
  // 桌面版暂不支持，返回当前设置
  return fetchSettings(_token, _base)
}

/** 列出斜杠命令 */
export async function listSlashCommands(
  _token: string,
  _base: string = '',
): Promise<SlashCommand[]> {
  return [
    { command: '/new',     title: 'New Chat',    description: 'Start a fresh conversation',             icon: '✨', argHint: '' },
    { command: '/history', title: 'History',      description: 'Show conversation history',               icon: '📜', argHint: '' },
    { command: '/model',   title: 'Switch Model', description: 'Switch the AI model for this session',   icon: '🧠', argHint: '[model]' },
  ]
}
