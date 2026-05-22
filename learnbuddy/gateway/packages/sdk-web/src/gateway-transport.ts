import type {
  AgentTransport,
  InboundEvent,
  GatewaySessionServerMessage,
  TransportCallbacks,
} from '@learnbuddy/shared'
import { bareChatId, gatewayWsUrl, toSessionKey } from '@learnbuddy/shared'

export interface GatewayTransportConfig {
  httpBase: string
  webToken: string
  deviceId?: string
}

function isInboundEvent(value: unknown): value is InboundEvent {
  return (
    !!value
    && typeof value === 'object'
    && 'event' in value
    && typeof (value as InboundEvent).event === 'string'
  )
}

/**
 * Browser transport: Gateway web WS + HTTP send (desktop agent host).
 * Implements {@link AgentTransport} for {@link @learnbuddy/client}.
 */
export class GatewayTransport implements AgentTransport {
  readonly kind = 'websocket' as const

  private ws: WebSocket | null = null
  private readonly wsUrl: string
  private readonly subscribed = new Set<string>()
  private readonly registeredOnGateway = new Set<string>()
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private callbacks: TransportCallbacks | null = null

  constructor(private readonly config: GatewayTransportConfig) {
    this.wsUrl = gatewayWsUrl(config.httpBase)
  }

  attach(callbacks: TransportCallbacks): () => void {
    this.callbacks = callbacks
    callbacks.onStatus('connecting')
    this.openSocket(callbacks)
    return () => this.teardown()
  }

  ensureSession(chatId: string): void {
    const id = bareChatId(chatId)
    if (!id) return
    this.ensureSubscribed(toSessionKey(id))
  }

  sendMessage(chatId: string, content: string, _mediaUrls?: string[]): void {
    const id = bareChatId(chatId)
    if (!id) return
    const sessionKey = toSessionKey(id)
    this.ensureSubscribed(sessionKey)
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'subscribe', sessionKey }))
    }
    const base = this.config.httpBase.replace(/\/$/, '')
    if (!this.registeredOnGateway.has(sessionKey)) {
      this.registeredOnGateway.add(sessionKey)
      void fetch(`${base}/api/sessions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.config.webToken}`,
        },
        body: JSON.stringify({ chatId: id }),
      }).catch(() => {})
    }
    const encoded = encodeURIComponent(sessionKey)
    void fetch(`${base}/api/sessions/${encoded}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.config.webToken}`,
      },
      body: JSON.stringify({ content }),
    })
      .then(async (res) => {
        if (res.ok) return
        let code = `http_${res.status}`
        try {
          const body = (await res.json()) as { error?: string }
          if (body.error) code = body.error
        } catch { /* ignore */ }
        this.callbacks?.onSendError?.(code)
      })
      .catch(() => {
        this.callbacks?.onSendError?.('network_error')
      })
  }

  private ensureSubscribed(sessionKey: string): void {
    if (!bareChatId(sessionKey)) return
    if (this.subscribed.has(sessionKey)) return
    this.subscribed.add(sessionKey)
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'subscribe', sessionKey }))
    }
  }

  private openSocket(callbacks: TransportCallbacks): void {
    this.teardown(false)
    try {
      this.ws = new WebSocket(this.wsUrl)
    } catch {
      callbacks.onStatus('error')
      return
    }

    this.ws.onopen = () => {
      this.ws?.send(
        JSON.stringify({
          type: 'register',
          role: 'web',
          deviceId: this.config.deviceId ?? `web-${crypto.randomUUID().slice(0, 8)}`,
          token: this.config.webToken,
        }),
      )
    }

    this.ws.onmessage = (raw) => {
      let msg: GatewaySessionServerMessage
      try {
        msg = JSON.parse(String(raw.data)) as GatewaySessionServerMessage
      } catch {
        return
      }
      if (msg.type === 'registered') {
        callbacks.onStatus('open')
        const activeId = bareChatId(callbacks.getActiveChatId())
        const activeKey = activeId ? toSessionKey(activeId) : ''
        if (activeKey) this.ensureSubscribed(activeKey)
        for (const sk of this.subscribed) {
          if (sk !== activeKey) {
            this.ws?.send(JSON.stringify({ type: 'subscribe', sessionKey: sk }))
          }
        }
        return
      }
      if (msg.type === 'error') {
        const code = msg.message === 'forbidden' ? 'forbidden' : 'ws_error'
        callbacks.onStatus('error')
        this.callbacks?.onSendError?.(code)
        return
      }
      if (msg.type === 'ui_event') {
        const raw = msg.event
        if (!isInboundEvent(raw)) return
        let ev: InboundEvent = raw
        if ('chat_id' in ev && typeof ev.chat_id === 'string') {
          const bare = bareChatId(ev.chat_id)
          if (bare !== ev.chat_id) ev = { ...ev, chat_id: bare } as InboundEvent
        }
        callbacks.onEvent(ev)
        if (ev.event === 'session_updated' && 'chat_id' in ev) {
          callbacks.onSessionUpdate?.(ev.chat_id, ev.scope)
        }
      }
    }

    this.ws.onerror = () => {
      callbacks.onStatus('error')
    }

    this.ws.onclose = () => {
      callbacks.onStatus('closed')
      this.scheduleReconnect(callbacks)
    }
  }

  private scheduleReconnect(callbacks: TransportCallbacks): void {
    if (this.reconnectTimer) return
    callbacks.onStatus('reconnecting')
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      this.openSocket(callbacks)
    }, 2000)
  }

  private teardown(clearSubscribed = true): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    if (this.ws) {
      this.ws.onopen = null
      this.ws.onmessage = null
      this.ws.onclose = null
      this.ws.onerror = null
      this.ws.close()
      this.ws = null
    }
    if (clearSubscribed) {
      this.subscribed.clear()
      this.registeredOnGateway.clear()
    }
    this.callbacks = null
  }
}
