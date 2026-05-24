/**
 * Unified learnbuddy Gateway wire protocol.
 *
 * Session WebSocket (`register` / `ui_event` / `inbound_message` …): Web ↔ Gateway ↔ Desktop.
 */

// ─── Session WebSocket (production) ─────────────────────────────────────────

export type GatewaySessionRole = 'web' | 'desktop'

export type GatewaySessionClientMessage =
  | {
      type: 'register'
      role: GatewaySessionRole
      deviceId: string
      token: string
      /** Desktop only: same email as Web JWT login (multi-tenant routing). */
      accountEmail?: string
    }
  | { type: 'subscribe'; sessionKey: string }
  | { type: 'unsubscribe'; sessionKey: string }
  | { type: 'ping' }
  | {
      type: 'sessions_sync'
      requestId?: string
      sessions: GatewaySessionRow[]
    }
  | {
      type: 'thread_response'
      requestId: string
      payload: Record<string, unknown> | null
    }
  | {
      type: 'thread_snapshot'
      sessionKey: string
      payload: Record<string, unknown> | null
    }
  | {
      type: 'ui_event'
      sessionKey: string
      chatId: string
      event: Record<string, unknown>
    }

export type GatewaySessionServerMessage =
  | {
      type: 'registered'
      deviceId: string
      role: GatewaySessionRole
    }
  | {
      type: 'inbound_message'
      sessionKey: string
      chatId: string
      content: string
      media?: string[]
      source: 'web' | 'gateway'
    }
  | { type: 'create_session'; sessionKey: string; chatId: string }
  | { type: 'request_sessions'; requestId: string }
  | { type: 'request_thread'; requestId: string; sessionKey: string }
  | {
      type: 'sync_push'
      sessions: GatewaySessionRow[]
      threads?: Record<string, Record<string, unknown> | null>
    }
  | {
      type: 'ui_event'
      sessionKey: string
      chatId: string
      event: Record<string, unknown>
    }
  | { type: 'desktop_status'; online: boolean; deviceId?: string }
  | { type: 'error'; message: string }
  | { type: 'pong' }

export type GatewaySessionEnvelope = GatewaySessionClientMessage | GatewaySessionServerMessage

export interface GatewayHttpSendBody {
  content: string
  media?: string[]
}

export interface GatewayHttpSendResponse {
  ok: boolean
  queued?: boolean
  offline?: boolean
  error?: string
}

export const GATEWAY_DEFAULT_PORT = 18765

export interface GatewaySessionRow {
  key: string
  channel: string
  chatId: string
  createdAt: string
  updatedAt: string
  title?: string
  preview: string
}

// ─── MessageFrame (push / multi-node) ───────────────────────────────────────

export type GatewayConnectionType = 'web' | 'desktop'
export type GatewayConnectionStatus = 'active' | 'idle' | 'reconnecting' | 'closed'

export interface GatewayConnection {
  id: string
  userId: string
  type: GatewayConnectionType
  status: GatewayConnectionStatus
  gatewayId: string
  lastHeartbeat: number
  metadata: Record<string, string>
  send(frame: MessageFrame): Promise<void>
  close(): Promise<void>
}

export interface ConnectionStats {
  total: number
  web: number
  desktop: number
  active: number
  idle: number
}

export type MessageFrameType = 'push' | 'ack' | 'ping' | 'pong' | 'auth'

export interface MessageFrame {
  type: MessageFrameType
  id: string
  from: string
  to: string
  payload?: Record<string, unknown>
  timestamp: number
  ttl?: number
}

export interface AckFrame extends MessageFrame {
  type: 'ack'
  ackMsgId: string
  status: 'ok' | 'failed'
  error?: string
}

export interface PendingMessage {
  msgId: string
  targetId: string
  frame: MessageFrame
  retries: number
  maxRetries: number
  timestamp: number
  nextRetryAt: number
}

export type DeliverStatus = 'delivered' | 'pending' | 'failed' | 'offline_stored'

export interface DeliverResult {
  msgId: string
  status: DeliverStatus
  error?: string
}

export interface GatewayAuthPayload {
  sub: string
  type: GatewayConnectionType
  iat: number
  exp: number
}

export interface GatewayAuthResult {
  ok: boolean
  userId?: string
  sessionId?: string
  error?: string
}

export enum GatewayErrorCode {
  AUTH_EXPIRED = 'AUTH_EXPIRED',
  AUTH_INVALID = 'AUTH_INVALID',
  SESSION_NOT_FOUND = 'SESSION_NOT_FOUND',
  USER_OFFLINE = 'USER_OFFLINE',
  DELIVERY_TIMEOUT = 'DELIVERY_TIMEOUT',
  RATE_LIMITED = 'RATE_LIMITED',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
}

// ─── Unified wire envelope ──────────────────────────────────────────────────

/** Any JSON frame on Gateway WebSocket (discriminate with type guards). */
export type GatewayWireMessage = GatewaySessionEnvelope | MessageFrame

const GATEWAY_SESSION_TYPES = new Set<string>([
  'register',
  'subscribe',
  'unsubscribe',
  'ping',
  'sessions_sync',
  'thread_response',
  'thread_snapshot',
  'registered',
  'inbound_message',
  'create_session',
  'request_sessions',
  'request_thread',
  'sync_push',
  'ui_event',
  'desktop_status',
  'error',
  'pong',
])

const FRAME_TYPES = new Set<string>(['push', 'ack', 'ping', 'pong', 'auth'])

export function isGatewaySessionEnvelope(value: unknown): value is GatewaySessionEnvelope {
  if (!value || typeof value !== 'object') return false
  const t = (value as { type?: string }).type
  return typeof t === 'string' && GATEWAY_SESSION_TYPES.has(t)
}

export function isMessageFrame(value: unknown): value is MessageFrame {
  if (!value || typeof value !== 'object') return false
  const f = value as Record<string, unknown>
  return (
    typeof f.type === 'string'
    && FRAME_TYPES.has(f.type)
    && typeof f.id === 'string'
    && typeof f.from === 'string'
    && typeof f.to === 'string'
    && typeof f.timestamp === 'number'
  )
}

export function isGatewayWireMessage(value: unknown): value is GatewayWireMessage {
  return isGatewaySessionEnvelope(value) || isMessageFrame(value)
}
