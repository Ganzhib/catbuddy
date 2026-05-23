/**
 * Shared Web ⇄ Gateway session protocol (WS subscribe + HTTP send).
 * Used by {@link GatewayTransport} and UI helpers in `@learnbuddy/ui`.
 */
import type {
  GatewayHttpSendResponse,
  GatewaySessionServerMessage,
  InboundEvent,
} from '@learnbuddy/shared'
import { bareChatId, toSessionKey } from '@learnbuddy/shared'
import type { SessionUpdateScope } from '@learnbuddy/shared'

export function isInboundEvent(value: unknown): value is InboundEvent {
  return (
    !!value
    && typeof value === 'object'
    && 'event' in value
    && typeof (value as InboundEvent).event === 'string'
  )
}

export function normalizeInboundEvent(ev: InboundEvent): InboundEvent {
  if (!('chat_id' in ev) || typeof ev.chat_id !== 'string') return ev
  const bare = bareChatId(ev.chat_id)
  return bare === ev.chat_id ? ev : ({ ...ev, chat_id: bare } as InboundEvent)
}

export type GatewayUiDispatch = {
  getActiveSessionKey: () => string
  setActiveSessionKey?: (sessionKey: string) => void
  subscribe: (sessionKey: string) => void
  onEvent: (ev: InboundEvent) => void
  onSessionFocus?: (sessionKey: string) => void
  onSessionUpdate?: (chatId: string, scope?: SessionUpdateScope) => void
}

/** Route a server `ui_event` to callbacks (session filter + focus handling). */
export function dispatchGatewayUiEvent(
  msg: Extract<GatewaySessionServerMessage, { type: 'ui_event' }>,
  dispatch: GatewayUiDispatch,
): void {
  const raw = msg.event
  if (!isInboundEvent(raw)) return

  const ev = normalizeInboundEvent(raw)
  const wireKey = msg.sessionKey.trim()

  if (ev.event === 'session_updated' && ev.scope === 'focus' && wireKey) {
    dispatch.setActiveSessionKey?.(wireKey)
    dispatch.subscribe(wireKey)
    dispatch.onSessionFocus?.(wireKey)
    const focusId = bareChatId(ev.chat_id) || bareChatId(wireKey)
    if (focusId) dispatch.onSessionUpdate?.(focusId, 'focus')
    return
  }

  if (ev.event === 'session_updated' && 'chat_id' in ev) {
    dispatch.onSessionUpdate?.(ev.chat_id, ev.scope)
    return
  }

  const activeKey = dispatch.getActiveSessionKey().trim()
  if (wireKey && activeKey && wireKey !== activeKey) return
  dispatch.onEvent(ev)
}

export type GatewayWebSocketConfig = {
  wsUrl: string
  webToken: string
  deviceId?: string
  initialSessionKey: string
  onOpen?: () => void
  onClose?: () => void
  onError?: (message: string) => void
  dispatch: GatewayUiDispatch
}

export type GatewayWebSocketHandle = {
  close: () => void
  subscribe: (sessionKey: string) => void
}

/** Open session WebSocket. Caller owns reconnect policy. */
export function openGatewayWebSocket(
  config: GatewayWebSocketConfig,
): GatewayWebSocketHandle {
  const ws = new WebSocket(config.wsUrl)
  let activeKey = config.initialSessionKey.trim()

  const sendSubscribe = (key: string) => {
    const sk = key.trim()
    if (!sk || ws.readyState !== WebSocket.OPEN) return
    ws.send(JSON.stringify({ type: 'subscribe', sessionKey: sk }))
  }

  const dispatchBridge: GatewayUiDispatch = {
    getActiveSessionKey: () => activeKey,
    setActiveSessionKey: (key) => {
      activeKey = key.trim()
    },
    subscribe: sendSubscribe,
    onEvent: config.dispatch.onEvent,
    onSessionFocus: config.dispatch.onSessionFocus,
    onSessionUpdate: config.dispatch.onSessionUpdate,
  }

  ws.onopen = () => {
    ws.send(
      JSON.stringify({
        type: 'register',
        role: 'web',
        deviceId: config.deviceId ?? `web-${crypto.randomUUID().slice(0, 8)}`,
        token: config.webToken,
      }),
    )
  }

  ws.onmessage = (raw) => {
    let msg: GatewaySessionServerMessage
    try {
      msg = JSON.parse(String(raw.data)) as GatewaySessionServerMessage
    } catch {
      return
    }
    if (msg.type === 'registered') {
      sendSubscribe(activeKey)
      config.onOpen?.()
      return
    }
    if (msg.type === 'error') {
      config.onError?.(msg.message)
      return
    }
    if (msg.type === 'ui_event') {
      dispatchGatewayUiEvent(msg, dispatchBridge)
    }
  }

  ws.onclose = () => config.onClose?.()
  ws.onerror = () => config.onError?.('websocket_error')

  return {
    subscribe: sendSubscribe,
    close: () => {
      ws.onopen = null
      ws.onmessage = null
      ws.onclose = null
      ws.onerror = null
      ws.close()
    },
  }
}

const registeredSessions = new WeakMap<object, Set<string>>()

function sessionRegistry(owner: object): Set<string> {
  let set = registeredSessions.get(owner)
  if (!set) {
    set = new Set()
    registeredSessions.set(owner, set)
  }
  return set
}

/** Ensure session exists on gateway before first message (fire-and-forget). */
export function ensureGatewaySessionOnHttp(
  owner: object,
  httpBase: string,
  webToken: string,
  sessionKey: string,
): void {
  const sk = sessionKey.trim()
  if (!sk) return
  const reg = sessionRegistry(owner)
  if (reg.has(sk)) return
  reg.add(sk)
  const base = httpBase.replace(/\/$/, '')
  const chatId = bareChatId(sk)
  void fetch(`${base}/api/sessions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${webToken}`,
    },
    body: JSON.stringify({ chatId }),
  }).catch(() => {})
}

export async function postGatewayUserMessage(
  httpBase: string,
  webToken: string,
  sessionKey: string,
  content: string,
  media?: string[],
): Promise<GatewayHttpSendResponse> {
  const encoded = encodeURIComponent(sessionKey)
  const res = await fetch(
    `${httpBase.replace(/\/$/, '')}/api/sessions/${encoded}/messages`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${webToken}`,
      },
      body: JSON.stringify({ content, media }),
    },
  )
  return res.json() as Promise<GatewayHttpSendResponse>
}

export function resolveGatewayWebToken(configured: string): string {
  const fromConfig = configured.trim()
  if (fromConfig) return fromConfig
  if (typeof window === 'undefined') return ''
  try {
    return window.localStorage.getItem('learnbuddy-webui.auth-token')?.trim() || ''
  } catch {
    return ''
  }
}

export function activeSessionKeyFromChatId(chatId: string): string {
  const id = bareChatId(chatId)
  return id ? toSessionKey(id) : ''
}
