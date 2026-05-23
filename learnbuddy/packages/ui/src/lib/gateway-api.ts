/**
 * Web-side helpers for cross-device gateway (no Electron required).
 * Session protocol lives in `@learnbuddy/gateway-sdk-web`; this module adds
 * Vite dev-proxy URL resolution and platform auth token loading.
 *
 * @see docs/CROSS_DEVICE_GATEWAY.md
 */
import {
  openGatewayWebSocket,
  postGatewayUserMessage,
  resolveGatewayWebToken as resolveSdkWebToken,
} from '@learnbuddy/gateway-sdk-web'
import type { GatewayHttpSendResponse } from '@learnbuddy/shared'
import { gatewayWsUrl } from '@learnbuddy/shared'
import { loadAuthToken } from '@learnbuddy/platform'
import type { InboundEvent } from '@learnbuddy/shared'

export interface GatewayWebConfig {
  httpBase: string
  wsUrl: string
  webToken: string
  deviceId?: string
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
  return gatewayWsUrl(httpBase)
}

export function gatewayWebConfigFromEnv(): GatewayWebConfig | null {
  const base = import.meta.env.VITE_GATEWAY_HTTP_BASE as string | undefined
  const token = import.meta.env.VITE_GATEWAY_WEB_TOKEN as string | undefined
  if (!base?.trim() || !token?.trim()) return null
  const httpBase = base.replace(/\/$/, '')
  const wsUrl =
    (import.meta.env.VITE_GATEWAY_WS_URL as string | undefined)?.trim()
    || gatewayWsUrl(httpBase)
  return {
    httpBase,
    wsUrl,
    webToken: token.trim(),
    deviceId:
      (import.meta.env.VITE_GATEWAY_DEVICE_ID as string | undefined)?.trim()
      || `web-${crypto.randomUUID().slice(0, 8)}`,
  }
}

/** JWT from Web login (`learnbuddy-webui.auth-token`) or env dev token. */
export function resolveGatewayWebToken(override?: string): string {
  const fromStore = loadAuthToken()?.trim()
  const raw = override?.trim() || fromStore
  if (raw) return raw
  const env = import.meta.env.VITE_GATEWAY_WEB_TOKEN as string | undefined
  return env?.trim() || resolveSdkWebToken('')
}

export async function sendGatewayMessage(
  httpBase: string,
  sessionKey: string,
  webToken: string,
  content: string,
  media?: string[],
): Promise<GatewayHttpSendResponse> {
  return postGatewayUserMessage(httpBase, webToken, sessionKey, content, media)
}

export type GatewayWebCallbacks = {
  onEvent: (ev: InboundEvent) => void
  onSessionFocus?: (sessionKey: string) => void
  onOpen?: () => void
  onClose?: () => void
  onError?: (message: string) => void
}

/** Subscribe to `ui_event` stream for a session (simple Web UI). */
export function connectGatewayWeb(
  config: GatewayWebConfig,
  sessionKey: string,
  callbacks: GatewayWebCallbacks,
): () => void {
  let activeKey = sessionKey.trim()
  const handle = openGatewayWebSocket({
    wsUrl: config.wsUrl,
    webToken: config.webToken,
    deviceId: config.deviceId,
    initialSessionKey: activeKey,
    onOpen: () => callbacks.onOpen?.(),
    onClose: () => callbacks.onClose?.(),
    onError: (message) => callbacks.onError?.(message),
    dispatch: {
      getActiveSessionKey: () => activeKey,
      setActiveSessionKey: (key) => {
        activeKey = key.trim()
      },
      subscribe: (key) => handle.subscribe(key),
      onEvent: (ev) => callbacks.onEvent(ev),
      onSessionFocus: (key) => callbacks.onSessionFocus?.(key),
    },
  })
  return handle.close
}
