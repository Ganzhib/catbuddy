import type { AgentTransport, TransportCallbacks } from '@catbuddy/shared'
import { bareChatId, gatewayWsUrl, toSessionKey } from '@catbuddy/shared'
import {
  activeSessionKeyFromChatId,
  ensureGatewaySessionOnHttp,
  openGatewayWebSocket,
  postGatewayUserMessage,
  resolveGatewayWebToken,
  type GatewayWebSocketHandle,
} from './gateway-web-session.js'

export interface GatewayTransportConfig {
  httpBase: string
  webToken: string
  deviceId?: string
}

const RECONNECT_MS = 2000

/**
 * Browser transport: Gateway session WS + HTTP send (desktop agent host).
 * Implements {@link AgentTransport} for {@link @catbuddy/client}.
 */
export class GatewayTransport implements AgentTransport {
  readonly kind = 'websocket' as const

  private readonly wsUrl: string
  private readonly webToken: string
  private readonly subscribed = new Set<string>()
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private wsHandle: GatewayWebSocketHandle | null = null
  private callbacks: TransportCallbacks | null = null
  private stopped = false

  constructor(private readonly config: GatewayTransportConfig) {
    this.wsUrl = gatewayWsUrl(config.httpBase)
    this.webToken = resolveGatewayWebToken(config.webToken)
  }

  attach(callbacks: TransportCallbacks): () => void {
    this.callbacks = callbacks
    this.stopped = false
    callbacks.onStatus('connecting')
    this.openSocket(callbacks)
    return () => this.detach()
  }

  ensureSession(chatId: string): void {
    const id = bareChatId(chatId)
    if (!id) return
    this.trackSubscription(toSessionKey(id))
  }

  sendMessage(chatId: string, content: string, _mediaUrls?: string[]): void {
    const id = bareChatId(chatId)
    if (!id) return
    const sessionKey = toSessionKey(id)
    this.trackSubscription(sessionKey)
    ensureGatewaySessionOnHttp(this, this.config.httpBase, this.webToken, sessionKey)
    void postGatewayUserMessage(
      this.config.httpBase,
      this.webToken,
      sessionKey,
      content,
    )
      .then((res) => {
        if (res.ok) return
        const code = res.error?.trim() || 'send_failed'
        this.callbacks?.onSendError?.(code)
      })
      .catch(() => {
        this.callbacks?.onSendError?.('network_error')
      })
  }

  private trackSubscription(sessionKey: string): void {
    if (!bareChatId(sessionKey)) return
    this.subscribed.add(sessionKey)
    this.wsHandle?.subscribe(sessionKey)
  }

  private openSocket(callbacks: TransportCallbacks): void {
    this.wsHandle?.close()
    this.wsHandle = null

    const initialKey =
      activeSessionKeyFromChatId(callbacks.getActiveChatId()) || toSessionKey('main')

    this.wsHandle = openGatewayWebSocket({
      wsUrl: this.wsUrl,
      webToken: this.webToken,
      deviceId: this.config.deviceId,
      initialSessionKey: initialKey,
      onOpen: () => {
        callbacks.onStatus('open')
        const activeKey = activeSessionKeyFromChatId(callbacks.getActiveChatId())
        if (activeKey) this.trackSubscription(activeKey)
        for (const sk of this.subscribed) {
          if (sk !== activeKey) this.trackSubscription(sk)
        }
      },
      onClose: () => {
        callbacks.onStatus('closed')
        this.scheduleReconnect(callbacks)
      },
      onError: (message) => {
        const code = message === 'forbidden' ? 'forbidden' : 'ws_error'
        callbacks.onStatus('error')
        this.callbacks?.onSendError?.(code)
      },
      dispatch: {
        getActiveSessionKey: () =>
          activeSessionKeyFromChatId(callbacks.getActiveChatId()),
        subscribe: (key) => this.trackSubscription(key),
        onEvent: (ev) => callbacks.onEvent(ev),
        onSessionUpdate: (chatId, scope) =>
          callbacks.onSessionUpdate?.(chatId, scope),
      },
    })
  }

  private scheduleReconnect(callbacks: TransportCallbacks): void {
    if (this.stopped || this.reconnectTimer) return
    callbacks.onStatus('reconnecting')
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      if (!this.stopped) this.openSocket(callbacks)
    }, RECONNECT_MS)
  }

  private detach(): void {
    this.stopped = true
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    this.wsHandle?.close()
    this.wsHandle = null
    this.subscribed.clear()
    this.callbacks = null
  }
}
