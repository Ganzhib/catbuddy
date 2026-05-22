/** Resolve learnbuddy gateway HTTP base for browser + Vite dev proxy. */
export function resolveGatewayHttpBase(stored?: string): string {
  const raw = stored?.trim()
  if (typeof window !== 'undefined' && import.meta.env?.DEV) {
    const port = window.location.port
    // Web + Electron dev servers (Vite) proxy /gateway-api → :18765
    const devPorts = new Set(['5173', '5174', '4173'])
    if (devPorts.has(port)) {
      const direct =
        !raw
        || /^https?:\/\/(127\.0\.0\.1|localhost):18765\/?$/i.test(raw)
      if (direct) return `${window.location.origin}/gateway-api`
    }
  }
  return raw || 'http://127.0.0.1:18765'
}

/** @deprecated Use resolveGatewayHttpBase */
export const resolveRelayHttpBase = resolveGatewayHttpBase

export function useLearnbuddyGateway(): boolean {
  const env = import.meta.env
  if (env.VITE_USE_GATEWAY === 'true') return true
  if (env.VITE_USE_GATEWAY === 'false') return false
  return env.VITE_USE_RELAY_GATEWAY === 'true'
    || (env.DEV && env.VITE_USE_RELAY_GATEWAY !== 'false')
}

/** @deprecated Use useLearnbuddyGateway */
export const useRelayGateway = useLearnbuddyGateway
