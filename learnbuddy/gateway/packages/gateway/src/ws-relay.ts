import { randomBytes } from 'node:crypto'
import type { WebSocket } from 'ws'
import type { GatewayStateService } from './relay/gateway-state.js'

/** Legacy Web ⇄ Desktop relay protocol (register / subscribe / ui_event). */
export function attachRelayWebSocket(
  server: import('ws').WebSocketServer,
  state: GatewayStateService,
  log: (msg: string) => void,
): void {
  server.on('connection', (ws: WebSocket) => {
    let clientKey = ''

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
        const token = String(msg.token || '')
        const role = msg.role === 'executor' ? 'executor' : 'viewer'
        const deviceId = String(msg.deviceId || randomBytes(8).toString('hex'))

        if (role === 'executor') {
          const result = state.registerExecutor(ws, deviceId, token)
          if (!result.ok) {
            ws.send(JSON.stringify({ type: 'error', message: result.error }))
            ws.close()
            return
          }
          clientKey = `executor:${deviceId}`
          ws.send(
            JSON.stringify({
              type: 'registered',
              deviceId,
              role,
              pairingCode: result.pairingCode,
            }),
          )
          log(`executor registered deviceId=${deviceId} pairing=${result.pairingCode}`)
        } else {
          const result = state.registerViewer(ws, deviceId, token)
          if (!result.ok) {
            ws.send(JSON.stringify({ type: 'error', message: result.error }))
            ws.close()
            return
          }
          clientKey = `viewer:${token}:${deviceId}`
          ws.send(JSON.stringify({ type: 'registered', deviceId, role }))
        }
        return
      }

      if (!clientKey) {
        ws.send(JSON.stringify({ type: 'error', message: 'not_registered' }))
        return
      }

      if (msg.type === 'subscribe') {
        void state.subscribe(ws, String(msg.sessionKey || ''), clientKey)
        return
      }

      if (msg.type === 'unsubscribe') {
        state.unsubscribe(ws, String(msg.sessionKey || ''), clientKey)
        return
      }

      if (msg.type === 'ui_event') {
        state.publishUiEventFromExecutor(
          clientKey,
          String(msg.sessionKey || ''),
          String(msg.chatId || ''),
          (msg.event as Record<string, unknown>) ?? {},
        )
        return
      }

      if (msg.type === 'sessions_sync' && clientKey.startsWith('executor:')) {
        const deviceId = clientKey.slice('executor:'.length)
        const sessions = (msg.sessions as Array<Record<string, unknown>>) ?? []
        const rows = sessions.map((s) => ({
          key: String(s.key || ''),
          channel: String(s.channel || 'desktop'),
          chatId: String(s.chatId || ''),
          createdAt: String(s.createdAt || new Date().toISOString()),
          updatedAt: String(s.updatedAt || new Date().toISOString()),
          title: s.title != null ? String(s.title) : '',
          preview: String(s.preview || ''),
        }))
        const requestId = msg.requestId ? String(msg.requestId) : ''
        void state.applySessionsSync(deviceId, rows, { notifyViewers: !requestId })
        if (requestId) state.resolveSessionsRpc(requestId, rows)
        return
      }

      if (msg.type === 'thread_response' && clientKey.startsWith('executor:')) {
        state.resolveThreadRpc(
          String(msg.requestId || ''),
          (msg.payload as Record<string, unknown> | null) ?? null,
        )
        return
      }

      if (msg.type === 'thread_snapshot' && clientKey.startsWith('executor:')) {
        const sessionKey = String(msg.sessionKey || '')
        const payload = (msg.payload as Record<string, unknown> | null) ?? null
        void state.persistThreadSnapshot(sessionKey, payload)
      }
    })

    ws.on('close', () => {
      if (!clientKey) return
      const parts = clientKey.split(':')
      const role = parts[0]
      const deviceId = parts[1]
      state.disconnect(clientKey)
      log(`disconnect ${role} ${deviceId}`)
    })
  })
}
