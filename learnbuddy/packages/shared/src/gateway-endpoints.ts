/**
 * Official learnbuddy production hosts (Web ↔ Gateway relay).
 * Self-hosters may override via env or desktop config; end users use these defaults.
 */

/** Web SPA — 用户浏览器打开的站点 */
export const LEARNBUDDY_WEB_HOST = 'learnbuddy.ganzhibin.icu'
export const LEARNBUDDY_WEB_URL = `https://${LEARNBUDDY_WEB_HOST}`

/** Gateway API + WebSocket — Web 与 Desktop 客户端连接 */
export const LEARNBUDDY_GATEWAY_HOST = 'gateway.ganzhibin.icu'
export const LEARNBUDDY_GATEWAY_HTTP_URL = `https://${LEARNBUDDY_GATEWAY_HOST}`
export const LEARNBUDDY_GATEWAY_WS_URL = `wss://${LEARNBUDDY_GATEWAY_HOST}/ws`

/** Local dev gateway (`pnpm gateway:dev`). */
export const LEARNBUDDY_GATEWAY_LOCAL_HTTP_URL = 'http://127.0.0.1:18765'
export const LEARNBUDDY_GATEWAY_LOCAL_WS_URL = 'ws://127.0.0.1:18765/ws'

/**
 * Desktop WS `register` token — must match `GATEWAY_SECRET` on the server deployment.
 * (Not end-user configurable; routing is by login email.)
 */
export const LEARNBUDDY_GATEWAY_DESKTOP_SECRET = 'learnbuddy-desktop-pair-v1'
export const LEARNBUDDY_GATEWAY_LOCAL_SECRET = 'dev-secret'

export function resolveBuiltinGatewayHttpUrl(useLocal: boolean): string {
  return useLocal ? LEARNBUDDY_GATEWAY_LOCAL_HTTP_URL : LEARNBUDDY_GATEWAY_HTTP_URL
}

export function resolveBuiltinGatewayWsUrl(useLocal: boolean): string {
  return useLocal ? LEARNBUDDY_GATEWAY_LOCAL_WS_URL : LEARNBUDDY_GATEWAY_WS_URL
}

export function resolveBuiltinGatewaySecret(useLocal: boolean): string {
  return useLocal ? LEARNBUDDY_GATEWAY_LOCAL_SECRET : LEARNBUDDY_GATEWAY_DESKTOP_SECRET
}
