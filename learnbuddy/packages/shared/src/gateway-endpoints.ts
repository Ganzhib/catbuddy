/**
 * Official learnbuddy Gateway endpoints (Web ↔ Desktop relay).
 * Self-hosters may override via env or desktop config; end users use these defaults.
 */

/** Public gateway hostname — Web + packaged Desktop connect here in production. */
export const LEARNBUDDY_GATEWAY_HOST = 'learnbuddy.ganzhibin.iuc'

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
