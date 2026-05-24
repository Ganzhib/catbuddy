/**
 * Official catbuddy production hosts (Web ↔ Gateway relay).
 * Self-hosters may override via env or desktop config; end users use these defaults.
 */

/** Web SPA — 用户浏览器打开的站点 */
export const CATBUDDY_WEB_HOST = 'catbuddy.ganzhibin.icu'
export const CATBUDDY_WEB_URL = `https://${CATBUDDY_WEB_HOST}`

/** Gateway API + WebSocket — Web 与 Desktop 客户端连接 */
export const CATBUDDY_GATEWAY_HOST = 'gateway.ganzhibin.icu'
export const CATBUDDY_GATEWAY_HTTP_URL = `https://${CATBUDDY_GATEWAY_HOST}`
export const CATBUDDY_GATEWAY_WS_URL = `wss://${CATBUDDY_GATEWAY_HOST}/ws`

/** Local dev gateway (`pnpm gateway:dev`). */
export const CATBUDDY_GATEWAY_LOCAL_HTTP_URL = 'http://127.0.0.1:18765'
export const CATBUDDY_GATEWAY_LOCAL_WS_URL = 'ws://127.0.0.1:18765/ws'

/**
 * Desktop WS `register` token — must match `GATEWAY_SECRET` on the server deployment.
 * (Not end-user configurable; routing is by login email.)
 */
export const CATBUDDY_GATEWAY_DESKTOP_SECRET = 'catbuddy-desktop-pair-v1'
/** Live gateway.ganzhibin.icu still uses pre-rename secret until server redeploy. */
export const CATBUDDY_GATEWAY_PROD_DESKTOP_SECRET = 'learnbuddy-desktop-pair-v1'
export const CATBUDDY_GATEWAY_LOCAL_SECRET = 'dev-secret'

export function resolveBuiltinGatewayHttpUrl(useLocal: boolean): string {
  return useLocal ? CATBUDDY_GATEWAY_LOCAL_HTTP_URL : CATBUDDY_GATEWAY_HTTP_URL
}

export function resolveBuiltinGatewayWsUrl(useLocal: boolean): string {
  return useLocal ? CATBUDDY_GATEWAY_LOCAL_WS_URL : CATBUDDY_GATEWAY_WS_URL
}

export function resolveBuiltinGatewaySecret(useLocal: boolean): string {
  return useLocal ? CATBUDDY_GATEWAY_LOCAL_SECRET : CATBUDDY_GATEWAY_PROD_DESKTOP_SECRET
}
