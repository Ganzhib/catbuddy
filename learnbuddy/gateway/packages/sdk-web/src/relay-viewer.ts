/**
 * Browser viewer client for learnbuddy gateway (legacy register/subscribe protocol).
 * Used by @learnbuddy/client RelayTransport — can import from here directly.
 */
import type { InboundEvent } from '@learnbuddy/shared'

export interface RelayViewerConfig {
  httpBase: string
  viewerToken: string
  deviceId?: string
}

export type RelayViewerStatus = 'disconnected' | 'connecting' | 'connected' | 'reconnecting'

function relayWsUrl(httpBase: string): string {
  const trimmed = httpBase.replace(/\/$/, '')
  if (typeof window !== 'undefined' && (trimmed.includes('/gateway-api') || trimmed.includes('/relay-api'))) {
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const wsPath = trimmed.includes('/gateway-api') ? '/gateway-ws/ws' : '/relay-ws/ws'
    return `${proto}//${window.location.host}${wsPath}`
  }
  return `${trimmed.replace(/^http/, 'ws')}/ws`
}

function isInboundEvent(value: unknown): value is InboundEvent {
  return !!value && typeof value === 'object' && 'event' in value
    && typeof (value as InboundEvent).event === 'string'
}

export class RelayViewerClient {
  private ws: WebSocket | null = null
  private readonly wsUrl: string
  private status: RelayViewerStatus = 'disconnected'
  private readonly subscribed = new Set<string>()
  private readonly registeredOnGateway = new Set<string>()
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null

  onEvent: ((ev: InboundEvent) => void) | null = null
  onStatus: ((s: RelayViewerStatus) => void) | null = null
  onSendError: ((code: string) => void) | null = null

  constructor(private readonly config: RelayViewerConfig) {
    this.wsUrl = relayWsUrl(config.httpBase)
  }

  connect(): void {
    if (this.status === 'connecting' || this.status === 'connected') return
    this.status = 'connecting'
    this.onStatus?.('connecting')
    this.ws = new WebSocket(this.wsUrl)
    this.ws.onopen = () => {
      this.ws!.send(
        JSON.stringify({
          type: 'register',
          role: 'viewer',
          token: this.config.viewerToken,
          deviceId: this.config.deviceId ?? `web-${Date.now()}`,
        }),
      )
    }
    this.ws.onmessage = (ev) => this.handleMessage(ev.data)
    this.ws.onclose = () => this.scheduleReconnect()
    this.ws.onerror = () => this.ws?.close()
  }

  disconnect(): void {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer)
    this.reconnectTimer = null
    this.ws?.close()
    this.ws = null
    this.status = 'disconnected'
    this.onStatus?.('disconnected')
  }

  subscribe(sessionKey: string): void {
    if (!sessionKey || this.subscribed.has(sessionKey)) return
    this.subscribed.add(sessionKey)
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'subscribe', sessionKey }))
    }
  }

  async sendMessage(sessionKey: string, content: string): Promise<void> {
    this.subscribe(sessionKey)
    const base = this.config.httpBase.replace(/\/$/, '')
    const chatId = sessionKey.includes(':') ? sessionKey.split(':').slice(1).join(':') : sessionKey
    if (!this.registeredOnGateway.has(sessionKey)) {
      this.registeredOnGateway.add(sessionKey)
      void fetch(`${base}/api/sessions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.config.viewerToken}`,
        },
        body: JSON.stringify({ chatId }),
      }).catch(() => {})
    }
    const res = await fetch(`${base}/api/sessions/${encodeURIComponent(sessionKey)}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.config.viewerToken}`,
      },
      body: JSON.stringify({ content }),
    })
    if (!res.ok) {
      let code = `http_${res.status}`
      try {
        const body = (await res.json()) as { error?: string }
        if (body.error) code = body.error
      } catch { /* ignore */ }
      this.onSendError?.(code)
    }
  }

  private handleMessage(raw: unknown): void {
    let msg: Record<string, unknown>
    try {
      msg = JSON.parse(String(raw)) as Record<string, unknown>
    } catch {
      return
    }
    if (msg.type === 'registered') {
      this.status = 'connected'
      this.onStatus?.('connected')
      for (const sk of this.subscribed) {
        this.ws?.send(JSON.stringify({ type: 'subscribe', sessionKey: sk }))
      }
      return
    }
    if (msg.type === 'ui_event' && isInboundEvent(msg.event)) {
      this.onEvent?.(msg.event as InboundEvent)
    }
  }

  private scheduleReconnect(): void {
    this.status = 'reconnecting'
    this.onStatus?.('reconnecting')
    this.reconnectTimer = setTimeout(() => this.connect(), 3000)
  }
}
