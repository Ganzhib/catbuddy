/// <reference types="vite/client" />

interface NanobotAPI {
  sendMessage(chatId: string, content: string, media?: string[]): Promise<void>
  stopAgent(sessionKey: string): Promise<void>
  getStatus(): Promise<AgentStatus>

  onStreamDelta(cb: (data: { content: string; streamId: string }) => void): () => void
  onStreamEnd(cb: (data: { streamId: string; resuming: boolean }) => void): () => void
  onReasoningDelta(cb: (data: { content: string }) => void): () => void
  onReasoningEnd(cb: () => void): () => void
  onToolProgress(cb: (data: ToolEvent) => void): () => void
  onRetryWait(cb: (data: { message: string }) => void): () => void
  onTurnComplete(cb: (data: TurnCompleteData) => void): () => void
  onSystemMessage(cb: (data: { text: string }) => void): () => void

  listSessions(): Promise<SessionInfo[]>
  getSession(key: string): Promise<SessionDetail | null>
  deleteSession(key: string): Promise<boolean>
  clearSession(key: string): Promise<void>
  newSession(): Promise<{ key: string }>

  getConfig(): Promise<NanobotConfig>
  updateConfig(path: string, value: unknown): Promise<void>
  listModels(): Promise<ModelPresetConfig[]>
  setModel(presetName: string): Promise<void>

  selectWorkspace(): Promise<string>
  getWorkspace(): Promise<string>

  listSkills(): Promise<SkillInfo[]>
  toggleSkill(name: string, enabled: boolean): Promise<void>

  restartApp(): Promise<void>

  getChannelsStatus(): Promise<Record<string, ChannelStatus>>
}

interface Window {
  nanobot: NanobotAPI
}
