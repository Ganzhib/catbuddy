import type { WebSocket } from 'ws'
import type { AuthService } from './session/auth/auth.service.js'
import type { GatewayStateService } from './session/gateway-state.js'
import { createHandlerRegistry, handleRegister } from './ws-session/handlers/index.js'
import type { WsSessionContext, SessionClient } from './ws-session/handlers/types.js'

/** Web ⇄ Desktop session WebSocket (register / subscribe / ui_event). */
export function attachGatewaySessionWebSocket(
  server: import('ws').WebSocketServer,
  state: GatewayStateService,
  auth: AuthService,
  log: (msg: string) => void,
): void {
  const ctx: WsSessionContext = { state, auth, log }
  const handlerRegistry = createHandlerRegistry()

  server.on('connection', (ws: WebSocket) => {
    let client: SessionClient | null = null

    ws.on('message', (raw) => {
      let msg: Record<string, unknown>
      try {
        msg = JSON.parse(String(raw)) as Record<string, unknown>
      } catch {
        ws.send(JSON.stringify({ type: 'error', message: 'invalid_json' }))
        return
      }

      if (msg.type === 'ping') {
        ws.send(JSON.stringify({ type: 'pong' }))
        return
      }

      if (msg.type === 'register') {
        handleRegister(msg, ws, ctx)
          .then((result) => {
            if (result) client = result
          })
          .catch((err) => {
            log(`web register error: ${err instanceof Error ? err.message : String(err)}`)
            ws.close()
          })
        return
      }

      if (!client) {
        ws.send(JSON.stringify({ type: 'error', message: 'not_registered' }))
        return
      }

      const handler = handlerRegistry.get(String(msg.type || ''))
      if (handler) {
        try {
          handler(msg, client, ctx)
        } catch (err) {
          log(
            `handler error [${String(msg.type)}]: ${err instanceof Error ? err.message : String(err)}`,
          )
        }
      }
    })

    ws.on('close', () => {
      if (!client) return
      const parts = client.clientKey.split(':')
      const role = parts[0]
      const deviceId = parts[1]
      state.disconnect(client.clientKey)
      log(`disconnect ${role} ${deviceId}`)
    })
  })
}
