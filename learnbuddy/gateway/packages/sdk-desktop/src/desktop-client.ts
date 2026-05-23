/**
 * Desktop Gateway session WebSocket client.
 * Mirrors apps/desktop/electron/sync/gateway-ws-client.ts.
 */
import { randomUUID } from 'node:crypto'
import WebSocket from 'ws'

export interface DesktopGatewayConfig {
  url: string
  secret: string
  deviceId?: string
  accountEmail?: string
}

export interface DesktopGatewayStatus {
  connected: boolean
  deviceId: string
  accountEmail?: string
  lastError?: string
}

export type DesktopInboundMessage = {
  type: 'inbound_message'
  sessionKey: string
  chatId: string
  content: string
  media?: unknown[]
  source?: string
}

export class DesktopGatewayClient {
  private ws: WebSocket | null = null
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  readonly deviceId: string
  private _connected = false
  private _lastError?: string

  onInbound: ((msg: DesktopInboundMessage) => void) | null = null
  onCreateSession: ((sessionKey: string, chatId: string) => void) | null = null

  constructor(private readonly config: DesktopGatewayConfig) {
    this.deviceId = config.deviceId ?? `desktop-${randomUUID().slice(0, 8)}`
  }

  get status(): DesktopGatewayStatus {
    return {
      connected: this._connected,
      deviceId: this.deviceId,
      accountEmail: this.config.accountEmail,
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
          role: 'desktop',
          deviceId: this.deviceId,
          token: this.config.secret,
          accountEmail: this.config.accountEmail,
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
      return
    }
    if (msg.type === 'inbound_message') {
      this.onInbound?.(msg as unknown as DesktopInboundMessage)
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
