/**
 * Warn when catbuddy gateway is not reachable (apps/web dev).
 */
export async function checkGateway(url = 'http://127.0.0.1:18765/health') {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(2000) })
    if (!res.ok) return { ok: false, reason: `HTTP ${res.status}` }
    const body = await res.json()
    if (!body.gateway_shim && !body.gateway) {
      return { ok: false, reason: 'gateway 进程过旧，请重启: pnpm gateway:dev' }
    }
    return { ok: true }
  } catch {
    return { ok: false, reason: '未监听 127.0.0.1:18765' }
  }
}

export function gatewayPreflightPlugin(enabled) {
  return {
    name: 'catbuddy-gateway-preflight',
    async configureServer() {
      if (!enabled) return
      const result = await checkGateway()
      if (result.ok) return
      console.error(
        '\n[catbuddy/web] gateway 未就绪（' + result.reason + '）。\n'
        + '  请先另开终端运行: pnpm gateway:dev\n'
        + '  或一键启动:       pnpm dev:web:full\n',
      )
    },
  }
}
