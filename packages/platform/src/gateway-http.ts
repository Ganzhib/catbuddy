import {
  LEARNBUDDY_GATEWAY_HTTP_URL,
  LEARNBUDDY_GATEWAY_LOCAL_HTTP_URL,
  resolveBuiltinGatewayHttpUrl,
} from '@learnbuddy/shared'

/** Resolve learnbuddy gateway HTTP base for browser + Vite dev proxy. */
export function resolveGatewayHttpBase(stored?: string): string {
  const fromEnv = import.meta.env.VITE_GATEWAY_HTTP_URL?.trim() ?? ''
  const raw = (stored?.trim() || fromEnv).replace(/\/$/, '')
  if (typeof window !== 'undefined' && import.meta.env?.DEV) {
    const port = window.location.port
    const devPorts = new Set(['5173', '5174', '4173'])
    if (devPorts.has(port)) {
      const direct =
        !raw
        || raw === LEARNBUDDY_GATEWAY_LOCAL_HTTP_URL
        || /^https?:\/\/(127\.0\.0\.1|localhost):18765\/?$/i.test(raw)
      if (direct) return `${window.location.origin}/gateway-api`
    }
  }
  if (raw) return raw
  return import.meta.env?.DEV
    ? LEARNBUDDY_GATEWAY_LOCAL_HTTP_URL
    : LEARNBUDDY_GATEWAY_HTTP_URL
}

export function useLearnbuddyGateway(): boolean {
  const env = import.meta.env
  if (env.VITE_USE_GATEWAY === 'false') return false
  if (env.VITE_USE_GATEWAY === 'true') return true
  return true
}

/** @internal re-export for tests */
export { resolveBuiltinGatewayHttpUrl }
