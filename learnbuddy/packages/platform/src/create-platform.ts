import type { BootstrapResponse, ChatSummary, SettingsPayload, SettingsUpdate, SlashCommand, WebuiThreadPersistedPayload, ProviderSettingsUpdate, WebSearchSettingsUpdate } from '@learnbuddy/shared'
import { fetchBootstrapHttp, deriveWsUrlHttp } from './http-bootstrap'
import { fetchBootstrapIpc, deriveWsUrlIpc } from './ipc-bootstrap'
import {
  listSessionsHttp,
  createSessionHttp,
  fetchWebuiThreadHttp,
  deleteSessionHttp,
  fetchSettingsHttp,
  updateSettingsHttp,
  updateProviderSettingsHttp,
  updateWebSearchSettingsHttp,
  listSlashCommandsHttp,
} from './http-api'
import {
  listSessionsIpc,
  fetchWebuiThreadIpc,
  deleteSessionIpc,
  fetchSettingsIpc,
  updateSettingsIpc,
  updateProviderSettingsIpc,
  updateWebSearchSettingsIpc,
  listSlashCommandsIpc,
} from './ipc-api'

export { ApiError } from './ipc-api'
export { loadSavedSecret, saveSecret, clearSavedSecret } from './secrets'

export function hasLearnbuddyIpc(): boolean {
  return typeof window !== 'undefined' && !!window.learnbuddy
}

export interface PlatformApi {
  fetchBootstrap(baseUrl?: string, secret?: string): Promise<BootstrapResponse>
  deriveWsUrl(wsPath: string, token: string): string
  listSessions(token: string, base?: string): Promise<ChatSummary[]>
  createSession(token: string, base?: string, chatId?: string): Promise<ChatSummary>
  fetchWebuiThread(token: string, key: string, base?: string): Promise<WebuiThreadPersistedPayload | null>
  deleteSession(token: string, key: string, base?: string): Promise<boolean>
  fetchSettings(token: string, base?: string): Promise<SettingsPayload>
  updateSettings(token: string, update: SettingsUpdate, base?: string): Promise<SettingsPayload>
  updateProviderSettings(token: string, update: ProviderSettingsUpdate, base?: string): Promise<SettingsPayload>
  updateWebSearchSettings(token: string, update: WebSearchSettingsUpdate, base?: string): Promise<SettingsPayload>
  listSlashCommands(token: string, base?: string): Promise<SlashCommand[]>
  readonly mode: 'desktop' | 'web'
}

export function createPlatformApi(): PlatformApi {
  if (hasLearnbuddyIpc()) {
    return {
      mode: 'desktop',
      fetchBootstrap: fetchBootstrapIpc,
      deriveWsUrl: deriveWsUrlIpc,
      listSessions: listSessionsIpc,
      createSession: async (_token, _base, chatId?) => {
        const id =
          chatId?.replace(/^desktop:/, '')
          ?? `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
        const key = `desktop:${id}`
        const now = new Date().toISOString()
        return {
          key,
          channel: 'desktop',
          chatId: id,
          createdAt: now,
          updatedAt: now,
          title: '',
          preview: '',
        }
      },
      fetchWebuiThread: fetchWebuiThreadIpc,
      deleteSession: deleteSessionIpc,
      fetchSettings: fetchSettingsIpc,
      updateSettings: updateSettingsIpc,
      updateProviderSettings: updateProviderSettingsIpc,
      updateWebSearchSettings: updateWebSearchSettingsIpc,
      listSlashCommands: listSlashCommandsIpc,
    }
  }

  return {
    mode: 'web',
    fetchBootstrap: fetchBootstrapHttp,
    deriveWsUrl: deriveWsUrlHttp,
    listSessions: listSessionsHttp,
    createSession: createSessionHttp,
    fetchWebuiThread: fetchWebuiThreadHttp,
    deleteSession: deleteSessionHttp,
    fetchSettings: fetchSettingsHttp,
    updateSettings: updateSettingsHttp,
    updateProviderSettings: updateProviderSettingsHttp,
    updateWebSearchSettings: updateWebSearchSettingsHttp,
    listSlashCommands: listSlashCommandsHttp,
  }
}

/** @deprecated Use createPlatformApi().fetchBootstrap */
export async function fetchBootstrap(baseUrl?: string, secret?: string) {
  return createPlatformApi().fetchBootstrap(baseUrl, secret)
}
