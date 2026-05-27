import type { BootstrapResponse, ChatSummary, SettingsPayload, SettingsUpdate, SlashCommand, WebuiThreadPersistedPayload, ProviderSettingsUpdate, WebSearchSettingsUpdate, SkillInfo } from '@catbuddy/shared'
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
  fetchMcpSettingsIpc,
  updateMcpServersIpc,
  fetchMcpMarketplaceIpc,
  addMcpFromMarketplaceIpc,
  fetchSkillMarketplaceIpc,
  installSkillFromMarketplaceIpc,
  listSkillsIpc,
  toggleSkillIpc,
  listSlashCommandsIpc,
} from './ipc-api'

export { ApiError } from './ipc-api'
export { loadSavedSecret, saveSecret, clearSavedSecret } from './secrets'

export function hasCatbuddyIpc(): boolean {
  return typeof window !== 'undefined' && !!window.catbuddy
}

export interface PlatformApi {
  fetchBootstrap(baseUrl?: string, secret?: string): Promise<BootstrapResponse>
  deriveWsUrl(wsPath: string, token: string): string
  listSessions(token: string, base?: string): Promise<ChatSummary[]>
  createSession(token: string, base?: string, chatId?: string, workspaceFolderId?: string | null): Promise<ChatSummary>
  fetchWebuiThread(token: string, key: string, base?: string): Promise<WebuiThreadPersistedPayload | null>
  deleteSession(token: string, key: string, base?: string): Promise<boolean>
  fetchSettings(token: string, base?: string): Promise<SettingsPayload>
  updateSettings(token: string, update: SettingsUpdate, base?: string): Promise<SettingsPayload>
  updateProviderSettings(token: string, update: ProviderSettingsUpdate, base?: string): Promise<SettingsPayload>
  updateWebSearchSettings(token: string, update: WebSearchSettingsUpdate, base?: string): Promise<SettingsPayload>
  fetchMcpSettings(token: string, base?: string): Promise<import('@catbuddy/shared').McpSettingsPayload>
  updateMcpServers(token: string, servers: Record<string, import('@catbuddy/shared').McpServerConfig>, base?: string): Promise<import('@catbuddy/shared').McpSettingsUpdateResult>
  fetchMcpMarketplace(token: string, base?: string): Promise<import('@catbuddy/shared').McpMarketplaceEntry[]>
  addMcpFromMarketplace(token: string, id: string, base?: string): Promise<import('@catbuddy/shared').McpSettingsUpdateResult>
  listSkills(token: string, base?: string): Promise<SkillInfo[]>
  toggleSkill(token: string, name: string, enabled: boolean, base?: string): Promise<void>
  fetchSkillMarketplace(token: string, base?: string): Promise<import('@catbuddy/shared').SkillMarketplaceEntry[]>
  installSkillFromMarketplace(token: string, id: string, base?: string): Promise<import('@catbuddy/shared').SkillInstallResult>
  listSlashCommands(token: string, base?: string): Promise<SlashCommand[]>
  readonly mode: 'desktop' | 'web'
}

export function createPlatformApi(): PlatformApi {
  if (hasCatbuddyIpc()) {
    return {
      mode: 'desktop',
      fetchBootstrap: fetchBootstrapIpc,
      deriveWsUrl: deriveWsUrlIpc,
      listSessions: listSessionsIpc,
      createSession: async (_token, _base, chatId?, workspaceFolderId?) => {
        if (window.catbuddy?.newSession) {
          const created = await window.catbuddy.newSession(workspaceFolderId ?? null)
          const key = created.key
          const id = key.replace(/^desktop:/, '')
          const now = new Date().toISOString()
          const actualWorkspaceFolderId = created.workspaceFolderId ?? workspaceFolderId ?? null
          return {
            key,
            channel: 'desktop',
            chatId: id,
            createdAt: now,
            updatedAt: now,
            title: '',
            preview: '',
            workspaceFolderId: actualWorkspaceFolderId,
          }
        }
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
          workspaceFolderId: workspaceFolderId ?? null,
        }
      },
      fetchWebuiThread: fetchWebuiThreadIpc,
      deleteSession: deleteSessionIpc,
      fetchSettings: fetchSettingsIpc,
      updateSettings: updateSettingsIpc,
      updateProviderSettings: updateProviderSettingsIpc,
      updateWebSearchSettings: updateWebSearchSettingsIpc,
      fetchMcpSettings: fetchMcpSettingsIpc,
      updateMcpServers: updateMcpServersIpc,
      fetchMcpMarketplace: fetchMcpMarketplaceIpc,
      addMcpFromMarketplace: addMcpFromMarketplaceIpc,
      listSkills: listSkillsIpc,
      toggleSkill: toggleSkillIpc,
      fetchSkillMarketplace: fetchSkillMarketplaceIpc,
      installSkillFromMarketplace: installSkillFromMarketplaceIpc,
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
    fetchMcpSettings: async () => {
      throw new Error('MCP settings are desktop-only')
    },
    updateMcpServers: async () => {
      throw new Error('MCP settings are desktop-only')
    },
    fetchMcpMarketplace: async () => {
      throw new Error('MCP settings are desktop-only')
    },
    addMcpFromMarketplace: async () => {
      throw new Error('MCP settings are desktop-only')
    },
    listSkills: async () => {
      throw new Error('Skills are desktop-only')
    },
    toggleSkill: async () => {
      throw new Error('Skills are desktop-only')
    },
    fetchSkillMarketplace: async () => {
      throw new Error('Skill marketplace is desktop-only')
    },
    installSkillFromMarketplace: async () => {
      throw new Error('Skill marketplace is desktop-only')
    },
    listSlashCommands: listSlashCommandsHttp,
  }
}

/** @deprecated Use createPlatformApi().fetchBootstrap */
export async function fetchBootstrap(baseUrl?: string, secret?: string) {
  return createPlatformApi().fetchBootstrap(baseUrl, secret)
}
