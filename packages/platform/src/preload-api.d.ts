import type {
  AgentStatus,
  ChannelStatus,
  FileEditEvent,
  catbuddyConfig,
  ModelPresetConfig,
  SessionDetail,
  SessionInfo,
  SkillInfo,
  ToolEvent,
  TurnCompleteData,
} from '@catbuddy/shared'

export interface CatbuddyPreloadApi {
  sendMessage(chatId: string, content: string, media?: string[]): Promise<void>
  stopAgent(sessionKey: string): Promise<void>
  getStatus(): Promise<AgentStatus>

  onStreamDelta(cb: (data: { chatId: string; content: string; streamId: string }) => void): () => void
  onStreamEnd(cb: (data: { chatId: string; streamId: string; resuming: boolean }) => void): () => void
  onReasoningDelta(cb: (data: { chatId: string; content: string }) => void): () => void
  onReasoningEnd(cb: (data: { chatId: string }) => void): () => void
  onToolProgress(cb: (data: ToolEvent & { chatId: string }) => void): () => void
  onFileEdit(cb: (data: FileEditEvent & { chatId: string }) => void): () => void
  onRetryWait(cb: (data: { chatId: string; message: string }) => void): () => void
  onTurnComplete(cb: (data: TurnCompleteData & { chatId: string }) => void): () => void
  onSystemMessage(cb: (data: { chatId: string; text: string }) => void): () => void
  onAssistantMessage(cb: (data: { chatId: string; text: string }) => void): () => void
  onGatewayInbound(cb: (data: { chatId: string; sessionKey: string; content: string }) => void): () => void
  onGatewayConnectionChanged?(
    cb: (data: { connected: boolean; deviceId?: string; lastError?: string }) => void,
  ): () => void
  onSessionCreated(cb: (data: { sessionKey: string; chatId: string }) => void): () => void
  onSessionDeleted(cb: (data: { sessionKey: string }) => void): () => void

  listSessions(): Promise<SessionInfo[]>
  getSession(key: string): Promise<SessionDetail | null>
  deleteSession(key: string): Promise<boolean>
  clearSession(key: string): Promise<void>
  newSession(): Promise<{ key: string }>

  getConfig(): Promise<catbuddyConfig>
  getSettingsPayload?(): Promise<import('@catbuddy/shared').SettingsPayload>
  updateConfig(path: string, value: unknown): Promise<void>
  listModels(): Promise<ModelPresetConfig[]>
  setModel(presetName: string): Promise<void>

  selectWorkspace(): Promise<string>
  getWorkspace(): Promise<string>

  listSkills(): Promise<SkillInfo[]>
  toggleSkill(name: string, enabled: boolean): Promise<void>

  restartApp(): Promise<void>

  getChannelsStatus(): Promise<Record<string, ChannelStatus>>

  getGatewayStatus(): Promise<{
    enabled: boolean
    connected: boolean
    deviceId?: string
    accountEmail?: string
    lastError?: string
    subscribedSessions?: string[]
  }>
  gatewaySubscribeSession(payload: {
    sessionKey?: string
    chatId?: string
  }): Promise<{ sessionKey: string; subscribed?: string[] }>
  gatewaySyncAllSessions(): Promise<{ keys: string[]; subscribed?: string[] }>
  setGatewayAccountEmail(payload: {
    email: string
  }): Promise<{ ok: boolean; accountEmail: string | null }>
  postGatewayAuth(payload: {
    path: string
    body: Record<string, unknown>
  }): Promise<
    | { ok: true; data: unknown }
    | { ok: false; status: number; text: string }
  >

  getGatewayRemoteEnabled(): Promise<{
    enabled: boolean
    envConfigured: boolean
    configured?: boolean
    connected: boolean
    lastError?: string
    needsLogin?: boolean
  }>
  setGatewayRemoteEnabled(enabled: boolean): Promise<{
    enabled: boolean
    connected: boolean
  }>
  getGatewayConnectionSettings(): Promise<{
    host: string
    mode: string
    useLocal: boolean
    url: string
    hasSecret: boolean
    configured: boolean
    envOverridesUrl: boolean
    envOverridesSecret: boolean
    selfHostCustom: boolean
  }>
  setGatewayConnectionSettings(payload: {
    url?: string
    secret?: string
    clearCustom?: boolean
  }): Promise<{ ok: boolean; configured: boolean; connected: boolean }>
}

declare global {
  interface Window {
    catbuddy?: CatbuddyPreloadApi
  }
}

export {}
