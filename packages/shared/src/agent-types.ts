

// ── Semantic type aliases ──
// Replace `Record<string, unknown>` with these where the intent is clear.

/** Arbitrary JSON object (wire protocol / serialization boundary). */
export type JsonObject = Record<string, unknown>;

/** JSON Schema (e.g. OpenAI function parameters). */
export type JsonSchema = Record<string, unknown>;

/** Opaque session/agent metadata bag (reserved for future expansion). */
export type MetadataBag = Record<string, unknown>;

// ── 消息 ──
export interface InboundMessage {
  channel: string
  senderId: string
  chatId: string
  content: string
  timestamp: number
  media: string[]
  metadata: MetadataBag
  sessionKeyOverride?: string
  /** Runtime AbortSignal — not persisted, used by agent loop to cancel in-flight tasks. */
  _abortSignal?: AbortSignal
}

export interface OutboundMessage {
  channel: string
  chatId: string
  content: string
  replyTo?: string
  media: string[]
  metadata: MetadataBag
  buttons: string[][]
}

// ── LLM ──
export interface ToolCallRequest {
  id: string
  name: string
  arguments: JsonObject
}

export interface LLMResponse {
  content: string | null
  toolCalls: ToolCallRequest[]
  finishReason: string
  usage: TokenUsage
  retryAfter?: number
  reasoningContent?: string
  thinkingBlocks?: JsonObject[]
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
  thinkingBlocks?: JsonObject[]
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
    parameters: JsonSchema
  }
}

export interface ToolEvent {
  name: string
  status: 'started' | 'completed' | 'error'
  /** Provider tool call id — used to merge start/end into one UI row. */
  callId?: string
  arguments?: JsonObject
  detail?: string
  durationMs?: number
}

/** File edit progress for write_file / edit_file (desktop UI). */
export interface FileEditEvent {
  version?: number
  call_id: string
  tool: string
  path: string
  absolute_path?: string
  phase?: 'start' | 'end' | 'error' | string
  added: number
  deleted: number
  approximate?: boolean
  status: 'editing' | 'done' | 'error'
  binary?: boolean
  error?: string
  pending?: boolean
}

export interface DiagramUiEvent {
  type: 'display' | 'save' | 'error'
  path: string
  absolutePath?: string
  xml?: string
  title?: string
  callId?: string
  error?: string
}

// ── Session ──
export interface SessionInfo {
  key: string
  title: string
  preview: string
  createdAt: string
  updatedAt: string
  lastConsolidated: number
  metadata: MetadataBag
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
  /** DeepSeek thinking mode: must round-trip on tool-call turns. */
  reasoningContent?: string
  timestamp: string
  /** Token usage for this assistant turn (persisted from turn_end). */
  tokenUsage?: TokenUsage
  /** End-to-end wall time in ms for this assistant turn. */
  latencyMs?: number
}

// ── Agent ──
export interface AgentRunResult {
  finalContent: string | null
  messages: LLMMessage[]
  toolsUsed: string[]
  usage: TokenUsage
  stopReason: string
  /** Last model turn reasoning (DeepSeek thinking mode). */
  lastReasoningContent?: string
  error?: string
  toolEvents: ToolEvent[]
  hadInjections: boolean
  /** Content that was streamed via deltas before the turn was cancelled/interrupted. */
  streamedContent?: string
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
export interface catbuddyConfig {
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
      /** Background Dream interval (minutes). Default 120 when omitted. */
      dreamIntervalMinutes?: number
      /** Periodic HEARTBEAT.md check (minutes). Default 30 when omitted. */
      heartbeatIntervalMinutes?: number
      /** Set false to disable background heartbeat. Default true when omitted. */
      heartbeatEnabled?: boolean
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
  /** Cross-device Gateway remote control (desktop runs Agent for Web). */
  gateway?: {
    remoteEnabled?: boolean
    /** Same email as Web login — used for Gateway desktop register. */
    accountEmail?: string
    /** WebSocket URL, e.g. ws://127.0.0.1:18765/ws — env GATEWAY_URL overrides when set. */
    url?: string
    /** Desktop WS register secret — env GATEWAY_SECRET overrides when set. */
    secret?: string
  }
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
  mcpServers?: Record<string, McpServerConfig>
}

export interface McpServerConfig {
  command: string
  args?: string[]
  env?: Record<string, string>
  cwd?: string
  /** Per-tool call timeout in seconds (default 30). */
  toolTimeout?: number
  /** Raw tool names, wrapped names, or "*" for all. */
  enabledTools?: string[]
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
