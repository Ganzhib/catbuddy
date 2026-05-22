/**
 * Web-side helpers for cross-device gateway (no Electron required).
 * See docs/CROSS_DEVICE_GATEWAY.md.
 */
import type {
  GatewayHttpPairResponse,
  GatewayHttpSendResponse,
  GatewaySessionServerMessage,
} from '@learnbuddy/shared'
import type { InboundEvent } from '@learnbuddy/shared'

export interface GatewayWebConfig {
  httpBase: string
  wsUrl: string
  webToken: string
  deviceId?: string
}

function httpBaseToWs(base: string): string {
  const trimmed = base.replace(/\/$/, '')
  return `${trimmed.replace(/^http/, 'ws')}/ws`
}

/** True when the gateway-web page is served by Vite dev (use same-origin proxy). */
export function shouldUseGatewayDevProxy(): boolean {
  if (typeof window === 'undefined') return false
  const port = window.location.port
  return import.meta.env.DEV === true && (port === '5173' || port === '4173')
}

/** Prefer Vite `/gateway-api` proxy in dev to avoid CORS. */
export function resolveGatewayHttpBase(stored?: string): string {
  const raw = stored?.trim()
  if (shouldUseGatewayDevProxy()) {
    const direct =
      !raw
      || /^https?:\/\/(127\.0\.0\.1|localhost):18765\/?$/i.test(raw)
    if (direct) return `${window.location.origin}/gateway-api`
  }
  return raw || 'http://127.0.0.1:18765'
}

export function gatewayWsUrlFromHttp(httpBase: string): string {
  if (typeof window !== 'undefined') {
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    if (httpBase.includes('/gateway-api')) {
      return `${proto}//${window.location.host}/gateway-ws/ws`
    }
  }
  return httpBaseToWs(httpBase)
}

export function gatewayWebConfigFromEnv(): GatewayWebConfig | null {
  const base = import.meta.env.VITE_GATEWAY_HTTP_BASE as string | undefined
  const token = import.meta.env.VITE_GATEWAY_WEB_TOKEN as string | undefined
  if (!base?.trim() || !token?.trim()) return null
  const httpBase = base.replace(/\/$/, '')
  const wsUrl =
    (import.meta.env.VITE_GATEWAY_WS_URL as string | undefined)?.trim()
    || httpBaseToWs(httpBase)
  return {
    httpBase,
    wsUrl,
    webToken: token.trim(),
    deviceId:
      (import.meta.env.VITE_GATEWAY_DEVICE_ID as string | undefined)?.trim()
      || `web-${crypto.randomUUID().slice(0, 8)}`,
  }
}

export async function pairGatewayWeb(
  httpBase: string,
  pairingCode: string,
  webToken: string,
): Promise<GatewayHttpPairResponse> {
  const res = await fetch(`${httpBase.replace(/\/$/, '')}/api/pair`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pairingCode, token: webToken }),
  })
  return res.json() as Promise<GatewayHttpPairResponse>
}

export async function sendGatewayMessage(
  httpBase: string,
  sessionKey: string,
  webToken: string,
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

export type GatewayWebCallbacks = {
  onEvent: (ev: InboundEvent) => void
  onOpen?: () => void
  onClose?: () => void
  onError?: (message: string) => void
}

/** Subscribe to ui_event stream for a session (Web UI). */
export function connectGatewayWeb(
  config: GatewayWebConfig,
  sessionKey: string,
  callbacks: GatewayWebCallbacks,
): () => void {
  const ws = new WebSocket(config.wsUrl)

  ws.onopen = () => {
    ws.send(
      JSON.stringify({
        type: 'register',
        role: 'web',
        deviceId: config.deviceId ?? 'web-client',
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
      ws.send(JSON.stringify({ type: 'subscribe', sessionKey }))
      callbacks.onOpen?.()
      return
    }
    if (msg.type === 'error') {
      callbacks.onError?.(msg.message)
      return
    }
    if (msg.type === 'ui_event') {
      callbacks.onEvent(msg.event as InboundEvent)
    }
  }

  ws.onclose = () => {
    callbacks.onClose?.()
  }

  ws.onerror = () => {
    callbacks.onError?.('websocket_error')
  }

  return () => {
    ws.onopen = null
    ws.onmessage = null
    ws.onclose = null
    ws.onerror = null
    ws.close()
  }
}
