


// ── 消息 ──
export interface InboundMessage {
  channel: string
  senderId: string
  chatId: string
  content: string
  timestamp: number
  media: string[]
  metadata: Record<string, unknown>
  sessionKeyOverride?: string
}

export interface OutboundMessage {
  channel: string
  chatId: string
  content: string
  replyTo?: string
  media: string[]
  metadata: Record<string, unknown>
  buttons: string[][]
}

// ── LLM ──
export interface ToolCallRequest {
  id: string
  name: string
  arguments: Record<string, unknown>
}

export interface LLMResponse {
  content: string | null
  toolCalls: ToolCallRequest[]
  finishReason: string
  usage: TokenUsage
  retryAfter?: number
  reasoningContent?: string
  thinkingBlocks?: Record<string, unknown>[]
  errorStatusCode?: number
  errorKind?: string
  errorType?: string
  errorCode?: string
  errorRetryAfterS?: number
  errorShouldRetry?: boolean
}

export interface TokenUsage {
  inputTokens: number
  outputTokens: number
}

export interface GenerationSettings {
  temperature: number
  maxTokens: number
  reasoningEffort?: string
}

// ── 消息格式 ──
export type LLMMessage = {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string | ContentBlock[] | null
  toolCalls?: ToolCallRequest[]
  toolCallId?: string
  name?: string
  reasoningContent?: string
  thinkingBlocks?: Record<string, unknown>[]
}

export type ContentBlock =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } }

// ── 工具 ──
export interface ToolDefinition {
  type: 'function'
  function: {
    name: string
    description: string
    parameters: Record<string, unknown>
  }
}

export interface ToolEvent {
  name: string
  status: 'started' | 'completed' | 'error'
  detail?: string
  durationMs?: number
}

// ── Session ──
export interface SessionInfo {
  key: string
  title: string
  preview: string
  createdAt: string
  updatedAt: string
  lastConsolidated: number
  metadata: Record<string, unknown>
}

export interface SessionDetail extends SessionInfo {
  messages: MessageRecord[]
}

export interface MessageRecord {
  id: number
  sessionKey: string
  role: 'user' | 'assistant' | 'tool' | 'system'
  content: string
  toolCalls?: ToolCallRequest[]
  toolCallId?: string
  name?: string
  media?: string[]
  timestamp: string
}

// ── Agent ──
export interface AgentRunResult {
  finalContent: string | null
  messages: LLMMessage[]
  toolsUsed: string[]
  usage: TokenUsage
  stopReason: string
  error?: string
  toolEvents: ToolEvent[]
  hadInjections: boolean
}

export interface TurnCompleteData {
  content: string
  toolsUsed: string[]
  usage: TokenUsage
  latencyMs: number
}

export interface AgentStatus {
  running: boolean
  model: string
  uptime: number
  activeSessions: number
}

// ── 配置 ──
export interface NanobotConfig {
  workspace: string
  agents: {
    defaults: {
      model: string
      provider: string
      maxToolIterations: number
      contextWindowTokens: number
      maxToolResultChars: number
      maxMessages: number
      temperature: number
      maxTokens: number
      timezone: string
      sessionTtlMinutes: number
      consolidationRatio: number
      disabledSkills: string[]
      unifiedSession: boolean
      providerRetryMode: 'standard' | 'persistent'
      modelPreset?: string
      fallbackModels: FallbackCandidate[]
    }
  }
  providers: Record<string, ProviderConfig>
  modelPresets?: Record<string, ModelPresetConfig>
  channels: ChannelsConfig
  tools: ToolsConfig
  cron?: CronSchedule[]
}

export interface ProviderConfig {
  apiKey: string
  apiBase?: string
  extraHeaders?: Record<string, string>
  extraBody?: Record<string, unknown>
  region?: string
  profile?: string
}

export type FallbackCandidate = string | InlineFallbackConfig

export interface InlineFallbackConfig {
  model: string
  provider: string
  maxTokens?: number
  temperature?: number
}

export interface ModelPresetConfig {
  model: string
  provider?: string
  maxTokens?: number
  contextWindowTokens?: number
  temperature?: number
  reasoningEffort?: string
}

export interface ChannelsConfig {
  sendProgress: boolean
  sendToolHints: boolean
  showReasoning: boolean
  sendMaxRetries: number
  [channelName: string]: unknown
}

export interface ToolsConfig {
  restrictToWorkspace: boolean
  exec: { enable: boolean; whitelist?: string[] }
  web: { enable: boolean; searchProvider?: string }
  my: { enable: boolean; allowSet: boolean }
  imageGeneration: { enable: boolean; provider?: string }
  mcpServers?: Record<string, { command: string; args: string[] }>
}

export interface CronSchedule {
  kind: 'cron' | 'every'
  expr?: string
  everyMs?: number
  tz?: string
}

// ── 技能 ──
export interface SkillInfo {
  name: string
  description: string
  enabled: boolean
  isBuiltin: boolean
}

// ── Channel ──
export interface ChannelStatus {
  enabled: boolean
  running: boolean
}
