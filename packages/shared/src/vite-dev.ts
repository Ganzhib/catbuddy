import { loadRepoEnvFiles } from './load-repo-env.js'
import { applyCatbuddyDevMode, resolveDevMode, viteGatewayProxyTarget } from './dev-mode.js'

/** Shared dev env + gateway proxy for apps/web and apps/desktop Vite configs. */
export function setupCatbuddyViteDev(mode: string, label: string) {
  loadRepoEnvFiles({ production: mode === 'production' })
  if (mode !== 'production') applyCatbuddyDevMode()
  const devMode = resolveDevMode()
  const useCatbuddyGateway =
    process.env.VITE_USE_GATEWAY === 'true'
    || (mode === 'development' && process.env.VITE_USE_GATEWAY !== 'false')
  const catbuddyGatewayTarget = viteGatewayProxyTarget()
  const nanobotTarget = process.env.VITE_GATEWAY_URL ?? 'http://127.0.0.1:8765'
  const gatewayTarget = useCatbuddyGateway ? catbuddyGatewayTarget : nanobotTarget
  const wsTarget = gatewayTarget.replace(/^http/, 'ws')

  if (mode === 'development') {
    console.log(
      `[catbuddy/${label}] dev_mode=${devMode} gateway → ${catbuddyGatewayTarget}`,
    )
    if (devMode === 'local') {
      console.log(`[catbuddy/${label}] 需先启动 Gateway: pnpm gateway:dev`)
    }
  }

  let gatewayWsProxyWarned = false
  const onGatewayWsProxyError = (err: NodeJS.ErrnoException) => {
    if (gatewayWsProxyWarned) return
    if (err.code !== 'ECONNREFUSED' && err.code !== 'ECONNRESET') return
    gatewayWsProxyWarned = true
  }

  const proxy: Record<string, object> = {
    '/gateway-api': {
      target: catbuddyGatewayTarget,
      changeOrigin: true,
      rewrite: (p: string) => p.replace(/^\/gateway-api/, ''),
    },
    '/gateway-ws': {
      target: catbuddyGatewayTarget,
      ws: true,
      changeOrigin: true,
      rewrite: (p: string) => p.replace(/^\/gateway-ws/, ''),
      configure: (proxyServer: { on: (event: string, cb: (err: NodeJS.ErrnoException) => void) => void }) => {
        proxyServer.on('error', onGatewayWsProxyError)
      },
    },
    '/webui': { target: gatewayTarget, changeOrigin: true },
    '/api': { target: gatewayTarget, changeOrigin: true },
    '/auth': { target: gatewayTarget, changeOrigin: true },
  }

  if (!useCatbuddyGateway) {
    proxy['/'] = {
      target: wsTarget,
      ws: true,
      changeOrigin: true,
      bypass(req: { headers: { upgrade?: string }; url?: string }) {
        if (req.headers.upgrade?.toLowerCase() === 'websocket') return
        return req.url
      },
    }
  }

  const envDefine = {
    'import.meta.env.VITE_CATBUDDY_DEV_MODE': JSON.stringify(
      process.env.CATBUDDY_DEV_MODE ?? 'local',
    ),
    'import.meta.env.VITE_GATEWAY_HTTP_URL': JSON.stringify(
      process.env.VITE_GATEWAY_HTTP_URL ?? '',
    ),
    'import.meta.env.VITE_USE_GATEWAY': JSON.stringify(
      process.env.VITE_USE_GATEWAY ?? 'true',
    ),
  }

  return {
    devMode,
    useCatbuddyGateway,
    catbuddyGatewayTarget,
    envDefine,
    proxy,
  }
}
