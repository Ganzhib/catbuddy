import {
  CATBUDDY_GATEWAY_HTTP_URL,
  CATBUDDY_GATEWAY_LOCAL_HTTP_URL,
} from './gateway-endpoints.js'

export type CatbuddyDevMode = 'local' | 'remote'

export function resolveDevMode(): CatbuddyDevMode {
  const raw = (process.env.CATBUDDY_DEV_MODE || 'local').trim().toLowerCase()
  if (raw === 'remote' || raw === 'production' || raw === 'prod') return 'remote'
  return 'local'
}

/** Dev-only: one switch for Desktop + Web (+ local Gateway defaults). */
export function applyCatbuddyDevMode(): void {
  if (process.env.NODE_ENV === 'production') return

  const mode = resolveDevMode()
  process.env.CATBUDDY_DEV_MODE = mode

  if (mode === 'remote') {
    process.env.CATBUDDY_GATEWAY_USE_LOCAL = 'false'
    process.env.VITE_USE_GATEWAY = 'true'
    process.env.VITE_GATEWAY_HTTP_URL = CATBUDDY_GATEWAY_HTTP_URL
    delete process.env.GATEWAY_URL
    return
  }

  process.env.CATBUDDY_GATEWAY_USE_LOCAL = 'true'
  process.env.VITE_USE_GATEWAY = 'true'
  delete process.env.VITE_GATEWAY_HTTP_URL
  delete process.env.GATEWAY_URL
  if (!process.env.GATEWAY_SECRET?.trim()) {
    process.env.GATEWAY_SECRET = 'dev-secret'
  }
}

export function viteGatewayProxyTarget(): string {
  return resolveDevMode() === 'remote'
    ? CATBUDDY_GATEWAY_HTTP_URL
    : CATBUDDY_GATEWAY_LOCAL_HTTP_URL
}
