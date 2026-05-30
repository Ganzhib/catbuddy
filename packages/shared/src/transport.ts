import type { ConnectionStatus, InboundEvent } from './ui-types.js'

export type TransportKind = 'ipc' | 'websocket'

export type SessionUpdateScope = 'metadata' | 'thread' | 'focus' | string

/** Callbacks from a transport into catbuddyClient. */
export interface TransportCallbacks {
  getActiveChatId: () => string
  onEvent: (ev: InboundEvent) => void
  onStatus: (status: ConnectionStatus) => void
  onSessionUpdate?: (chatId: string, scope?: SessionUpdateScope) => void
  onGoHome?: () => void
  onSendError?: (code: string) => void
}

/** Pluggable agent event pipe (IPC, gateway session WS, nanobot WS). */
export interface AgentTransport {
  readonly kind: TransportKind
  attach(callbacks: TransportCallbacks): () => void
  sendMessage(chatId: string, content: string, mediaUrls?: string[], workspaceFolderId?: string | null): void
  ensureSession?(chatId: string, workspaceFolderId?: string | null): void
  updateUrl?(url: string): void
}
