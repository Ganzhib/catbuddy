/** Minimal session types for gateway JSONL (aligned with desktop ``@learnbuddy/shared``). */

export interface SessionInfo {
  key: string
  title: string
  preview: string
  createdAt: string
  updatedAt: string
  lastConsolidated: number
  metadata: Record<string, unknown>
}

export interface MessageRecord {
  id: number
  sessionKey: string
  role: 'user' | 'assistant' | 'tool' | 'system'
  content: string
  toolCalls?: unknown[]
  toolCallId?: string
  name?: string
  media?: string[]
  timestamp: string
}

export interface SessionDetail extends SessionInfo {
  messages: MessageRecord[]
}

export interface GatewaySessionRow {
  key: string
  channel: string
  chatId: string
  createdAt: string
  updatedAt: string
  title?: string
  preview: string
}
