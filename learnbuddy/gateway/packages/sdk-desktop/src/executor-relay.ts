/**
 * Desktop executor WebSocket client (legacy register protocol).
 * Mirrors apps/desktop/electron/sync/relay-client.ts for use as @learnbuddy/gateway-sdk-desktop.
 */
import { randomUUID } from 'node:crypto'
import WebSocket from 'ws'

export interface ExecutorRelayConfig {
  url: string
  secret: string
  deviceId?: string
}

export interface ExecutorRelayStatus {
  connected: boolean
  deviceId: string
  pairingCode?: string
  lastError?: string
}

export type ExecutorInboundMessage = {
  type: 'inbound_message'
  sessionKey: string
  chatId: string
  content: string
  media?: unknown[]
  source?: string
}

export class ExecutorRelayClient {
  private ws: WebSocket | null = null
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  readonly deviceId: string
  private _pairingCode?: string
  private _connected = false
  private _lastError?: string

  onInbound: ((msg: ExecutorInboundMessage) => void) | null = null
  onCreateSession: ((sessionKey: string, chatId: string) => void) | null = null

  constructor(private readonly config: ExecutorRelayConfig) {
    this.deviceId = config.deviceId ?? `desktop-${randomUUID().slice(0, 8)}`
  }

  get status(): ExecutorRelayStatus {
    return {
      connected: this._connected,
      deviceId: this.deviceId,
      pairingCode: this._pairingCode,
      lastError: this._lastError,
    }
  }

  start(): void {
    this.connect()
  }

  stop(): void {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer)
    this.reconnectTimer = null
    this.ws?.close()
    this.ws = null
    this._connected = false
  }

  send(obj: Record<string, unknown>): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(obj))
    }
  }

  publishUiEvent(sessionKey: string, chatId: string, event: Record<string, unknown>): void {
    this.send({ type: 'ui_event', sessionKey, chatId, event })
  }

  private connect(): void {
    this.ws = new WebSocket(this.config.url)
    this.ws.on('open', () => {
      this.ws!.send(
        JSON.stringify({
          type: 'register',
          role: 'executor',
          deviceId: this.deviceId,
          token: this.config.secret,
        }),
      )
    })
    this.ws.on('message', (raw) => this.handleMessage(raw))
    this.ws.on('close', () => {
      this._connected = false
      this.scheduleReconnect()
    })
    this.ws.on('error', (err) => {
      this._lastError = err instanceof Error ? err.message : String(err)
    })
  }

  private handleMessage(raw: WebSocket.RawData): void {
    let msg: Record<string, unknown>
    try {
      msg = JSON.parse(String(raw)) as Record<string, unknown>
    } catch {
      return
    }
    if (msg.type === 'registered') {
      this._connected = true
      this._pairingCode = msg.pairingCode as string | undefined
      return
    }
    if (msg.type === 'inbound_message') {
      this.onInbound?.(msg as unknown as ExecutorInboundMessage)
      return
    }
    if (msg.type === 'create_session') {
      this.onCreateSession?.(String(msg.sessionKey), String(msg.chatId))
    }
  }

  private scheduleReconnect(): void {
    this.reconnectTimer = setTimeout(() => this.connect(), 3000)
  }
}
