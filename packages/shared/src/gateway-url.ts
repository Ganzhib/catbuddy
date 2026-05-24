/** Resolve web client WebSocket URL from HTTP base (incl. Vite ``/gateway-api`` proxy). */
export function gatewayWsUrl(httpBase: string): string {
  const trimmed = httpBase.replace(/\/$/, '')
  if (typeof window !== 'undefined' && trimmed.includes('/gateway-api')) {
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    return `${proto}//${window.location.host}/gateway-ws/ws`
  }
  return `${trimmed.replace(/^http/, 'ws')}/ws`
}
