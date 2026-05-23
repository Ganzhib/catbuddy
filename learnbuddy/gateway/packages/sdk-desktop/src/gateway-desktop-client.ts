/**
 * Desktop Gateway session WebSocket client (Node `ws`).
 * Mirrors {@link @learnbuddy/gateway-sdk-web} session protocol for role=`desktop`.
 */
import { randomUUID } from 'node:crypto'
import WebSocket from 'ws'
import type {
  GatewaySessionClientMessage,
  GatewaySessionServerMessage,
  GatewaySessionRow,
  InboundMessage,
  SessionDetail,
  SessionInfo,
  WebuiThreadPersistedPayload,
} from '@learnbuddy/shared'
import { bareChatId } from '@learnbuddy/shared'
import {
  buildFocusSessionEvent,
  buildUiEventMessage,
  channelFromSessionKey,
  GATEWAY_DESKTOP_RECONNECT_MS,
  sessionRowFromKey,
  type GatewayInboundMessage,
} from './gateway-desktop-session.js'

export interface GatewaySessionProvider {
  list(): SessionInfo[]
  getDetail(key: string): SessionDetail | null
  getOrCreate(key: string): SessionInfo
  importWebuiThread(sessionKey: string, payload: Record<string, unknown>): void
}

export type ThreadSnapshotBuilder = (
  detail: SessionDetail | null,
) => WebuiThreadPersistedPayload | Record<string, unknown> | null

export interface GatewayDesktopClientConfig {
  url: string
  secret: string
  deviceId?: string
  /** Same email as Web JWT login (Gateway routes by account). */
  accountEmail?: string
  /** Auto-subscribe these session keys after connect. */
  sessionKeys?: string[]
}

export interface GatewayDesktopClientStatus {
  connected: boolean
  deviceId: string
  accountEmail?: string
  lastError?: string
}

export type GatewayInboundHandler = (msg: GatewayInboundMessage) => void

export type GatewayCreateSessionHandler = (sessionKey: string, chatId: string) => void

export interface GatewayDesktopClientOptions {
  sessionProvider?: GatewaySessionProvider
  buildThreadSnapshot?: ThreadSnapshotBuilder
  /** When set, overrides default bus publish for inbound_message. */
  onInboundMessage?: GatewayInboundHandler
  /** Publish to agent bus (used when onInboundMessage is not set). */
  publishInbound?: (msg: InboundMessage) => void
  onCreateSession?: GatewayCreateSessionHandler
  onConnected?: (deviceId: string) => void
  onDisconnected?: () => void
  onError?: (message: string) => void
}

export class GatewayDesktopClient {
  private ws: WebSocket | null = null
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private readonly deviceId: string
  private _connected = false
  private _lastError?: string
  private _reconnectEnabled = true
  private sessionProvider: GatewaySessionProvider | null = null
  private readonly subscribedSessions = new Set<string>()
  private readonly options: GatewayDesktopClientOptions

  constructor(
    private readonly config: GatewayDesktopClientConfig,
    options: GatewayDesktopClientOptions = {},
  ) {
    this.deviceId = config.deviceId ?? `desktop-${randomUUID().slice(0, 8)}`
    this.options = options
    if (options.sessionProvider) {
      this.sessionProvider = options.sessionProvider
    }
  }

  get status(): GatewayDesktopClientStatus {
    return {
      connected: this._connected,
      deviceId: this.deviceId,
      accountEmail: this.config.accountEmail,
      lastError: this._lastError,
    }
  }

  setSessionProvider(provider: GatewaySessionProvider): void {
    this.sessionProvider = provider
  }

  start(): void {
    this._reconnectEnabled = true
    this.connect()
  }

  stop(): void {
    this._reconnectEnabled = false
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    if (this.ws) {
      disposeWebSocket(this.ws)
      this.ws = null
    }
    this._connected = false
  }

  publishUiEvent(
    sessionKey: string,
    chatId: string,
    event: Record<string, unknown>,
  ): void {
    this.send(buildUiEventMessage(sessionKey, chatId, event))
  }

  subscribeSession(sessionKey: string): void {
    const key = sessionKey.trim()
    if (!key || this.subscribedSessions.has(key)) return
    this.subscribedSessions.add(key)
    if (this._connected) {
      this.send({ type: 'subscribe', sessionKey: key })
    }
  }

  focusSession(sessionKey: string): void {
    const key = sessionKey.trim()
    if (!key) return
    this.sessionProvider?.getOrCreate(key)
    this.subscribeSession(key)
    this.publishUiEvent(key, bareChatId(key), buildFocusSessionEvent(key))
    this.publishSessionsSync()
  }

  syncSessions(sessionKeys: string[]): void {
    for (const key of sessionKeys) {
      this.subscribeSession(key)
    }
  }

  get subscribedSessionKeys(): string[] {
    return [...this.subscribedSessions]
  }

  publishThreadSnapshot(sessionKey: string): void {
    if (!this._connected || !this.sessionProvider) return
    const build = this.options.buildThreadSnapshot
    if (!build) return
    const detail = this.sessionProvider.getDetail(sessionKey)
    const built = build(detail)
    if (!built || !('messages' in built) || !Array.isArray(built.messages)) return
    if (built.messages.length === 0) return
    this.send({
      type: 'thread_snapshot',
      sessionKey,
      payload: built as Record<string, unknown>,
    })
  }

  publishSessionsSync(requestId?: string): void {
    if (!this._connected || !this.sessionProvider) return
    this.send({
      type: 'sessions_sync',
      requestId,
      sessions: this.buildSessionRows(),
    })
  }

  private connect(): void {
    // Prevent overlapping connections
    if (this.ws) {
      disposeWebSocket(this.ws)
      this.ws = null
    }

    let ws: WebSocket
    try {
      ws = new WebSocket(this.config.url)
    } catch (err) {
      this._lastError = err instanceof Error ? err.message : String(err)
      this.options.onError?.(this._lastError)
      this.scheduleReconnect()
      return
    }
    this.ws = ws

    // Attach error listener FIRST — ws may emit 'error' synchronously in edge cases
    ws.on('error', (err) => {
      if (ws !== this.ws) return  // already disposed, ignore stale events
      this._lastError = err instanceof Error ? err.message : 'websocket_error'
      console.warn('[gateway] error:', this._lastError)
      this.options.onError?.(this._lastError)
    })

    ws.on('open', () => {
      if (ws !== this.ws) return
      this.send({
        type: 'register',
        role: 'desktop',
        deviceId: this.deviceId,
        token: this.config.secret,
        accountEmail: this.config.accountEmail?.trim() || undefined,
      })
    })

    ws.on('message', (data) => {
      if (ws !== this.ws) return
      let msg: GatewaySessionServerMessage
      try {
        msg = JSON.parse(data.toString()) as GatewaySessionServerMessage
      } catch { return }
      this.handleServerMessage(msg)
    })

    ws.on('close', () => {
      if (ws !== this.ws) return
      this._connected = false
      console.log('[gateway] disconnected')
      this.options.onDisconnected?.()
      this.scheduleReconnect()
    })
  }

  private handleServerMessage(msg: GatewaySessionServerMessage): void {
    try {
      this._handleServerMessageImpl(msg)
    } catch (err) {
      console.error('[gateway] handleServerMessage error:', err instanceof Error ? err.message : String(err))
    }
  }

  private _handleServerMessageImpl(msg: GatewaySessionServerMessage): void {
    if (msg.type === 'registered') {
      this._connected = true
      this._lastError = undefined
      console.log(
        `[gateway] connected deviceId=${msg.deviceId} account=${this.config.accountEmail ?? 'n/a'}`,
      )
      this.options.onConnected?.(msg.deviceId)
      if (this.config.sessionKeys?.length) {
        this.syncSessions(this.config.sessionKeys)
      }
      for (const key of this.subscribedSessions) {
        this.send({ type: 'subscribe', sessionKey: key })
      }
      this.publishSessionsSync()
      return
    }

    if (msg.type === 'sync_push') {
      this.applySyncPush(msg)
      return
    }

    if (msg.type === 'request_sessions') {
      this.publishSessionsSync(msg.requestId)
      return
    }

    if (msg.type === 'request_thread') {
      const sessionKey = msg.sessionKey.trim()
      const build = this.options.buildThreadSnapshot
      const detail = sessionKey ? this.sessionProvider?.getDetail(sessionKey) ?? null : null
      const payload = build ? build(detail) : null
      this.send({
        type: 'thread_response',
        requestId: msg.requestId,
        payload: payload as Record<string, unknown> | null,
      })
      return
    }

    if (msg.type === 'error') {
      this._lastError = msg.message
      console.warn('[gateway] error:', msg.message)
      this.options.onError?.(msg.message)
      if (msg.message === 'account_email_required' || msg.message === 'unauthorized') {
        this._reconnectEnabled = false
      }
      return
    }

    if (msg.type === 'create_session') {
      const sessionKey = msg.sessionKey.trim()
      const chatId = msg.chatId.trim()
      if (sessionKey) {
        this.subscribeSession(sessionKey)
        this.options.onCreateSession?.(
          sessionKey,
          chatId || bareChatId(sessionKey),
        )
        this.publishSessionsSync()
      }
      return
    }

    if (msg.type === 'inbound_message') {
      const sk = msg.sessionKey.trim()
      if (sk) this.subscribeSession(sk)
      if (this.options.onInboundMessage) {
        this.options.onInboundMessage(msg)
        return
      }
      this.publishInboundDefault(msg)
    }
  }

  private publishInboundDefault(msg: GatewayInboundMessage): void {
    const publish = this.options.publishInbound
    if (!publish) return
    publish({
      channel: channelFromSessionKey(msg.sessionKey),
      senderId: 'gateway-web',
      chatId: msg.chatId,
      content: msg.content,
      media: msg.media ?? [],
      timestamp: Date.now(),
      metadata: { _gateway_source: msg.source },
      sessionKeyOverride: msg.sessionKey,
    })
  }

  private applySyncPush(
    msg: Extract<GatewaySessionServerMessage, { type: 'sync_push' }>,
  ): void {
    if (!this.sessionProvider) return
    const rows = Array.isArray(msg.sessions) ? msg.sessions : []
    for (const row of rows) {
      if (row?.key) this.sessionProvider.getOrCreate(row.key)
    }
    const threads = msg.threads ?? {}
    for (const [sessionKey, payload] of Object.entries(threads)) {
      if (!sessionKey || !payload) continue
      this.sessionProvider.importWebuiThread(sessionKey, payload)
      this.subscribeSession(sessionKey)
    }
    console.log(
      `[gateway] sync_push applied sessions=${rows.length} threads=${Object.keys(threads).length}`,
    )
    this.publishSessionsSync()
  }

  private buildSessionRows(): GatewaySessionRow[] {
    if (!this.sessionProvider) return []
    return this.sessionProvider.list().map((s) =>
      sessionRowFromKey(s.key, {
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
        title: s.title,
        preview: s.preview,
      }),
    )
  }

  private send(msg: GatewaySessionClientMessage): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return
    try {
      this.ws.send(JSON.stringify(msg))
    } catch {
      // socket in bad state — close will trigger reconnect
      try { this.ws.terminate() } catch { /* ignore */ }
    }
  }

  private scheduleReconnect(): void {
    if (!this._reconnectEnabled || this.reconnectTimer || !this.ws) return
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      // Re-check: stop() may have been called, or a new connect() succeeded in between
      if (this._reconnectEnabled && !this._connected) {
        this.connect()
      }
    }, GATEWAY_DESKTOP_RECONNECT_MS)
  }
}

import {
  resolveBuiltinGatewaySecret,
  resolveBuiltinGatewayWsUrl,
} from '@learnbuddy/shared'

export function loadGatewayConfigFromSources(
  stored?: { url?: string; secret?: string },
  options?: { useLocalDefaults?: boolean },
): GatewayDesktopClientConfig | null {
  const envFlag = process.env.GATEWAY_ENABLED?.trim()
  if (envFlag === 'false' || envFlag === '0') return null

  const useLocal = options?.useLocalDefaults === true
  const url =
    process.env.GATEWAY_URL?.trim()
    || stored?.url?.trim()
    || resolveBuiltinGatewayWsUrl(useLocal)
  const secret =
    process.env.GATEWAY_SECRET?.trim()
    || stored?.secret?.trim()
    || resolveBuiltinGatewaySecret(useLocal)
  if (!url || !secret) return null

  const sessions = process.env.GATEWAY_DEFAULT_SESSIONS?.trim()
  const accountEmail = process.env.GATEWAY_ACCOUNT_EMAIL?.trim() || undefined
  return {
    url,
    secret,
    deviceId: process.env.GATEWAY_DEVICE_ID?.trim() || undefined,
    accountEmail,
    sessionKeys: sessions
      ? sessions.split(',').map((s) => s.trim()).filter(Boolean)
      : undefined,
  }
}

export function loadGatewayConfigFromEnv(): GatewayDesktopClientConfig | null {
  return loadGatewayConfigFromSources()
}

/** Safely dispose a WebSocket — never throw, even on CONNECTING / CLOSING states.
 *  The `ws` library throws "WebSocket was closed before the connection was established"
 *  when terminate/close is called on a socket whose TCP handshake hasn't completed. */
function disposeWebSocket(ws: WebSocket): void {
  try { ws.removeAllListeners() } catch { /* ignore */ }
  try {
    const state = ws.readyState
    if (state === WebSocket.CLOSED || state === WebSocket.CLOSING) return
    if (state === WebSocket.CONNECTING) {
      ws.terminate()
      return
    }
    ws.close()
  } catch {
    try { ws.terminate() } catch { /* final fallback */ }
  }
}
