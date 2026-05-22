import { Logger } from '@nestjs/common'
import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets'
import { randomBytes } from 'node:crypto'
import type { Server, WebSocket } from 'ws'
import { GatewayStateService } from './gateway-state.service'

@WebSocketGateway({ path: '/ws' })
export class GatewayWsGateway {
  private readonly log = new Logger(GatewayWsGateway.name)

  @WebSocketServer()
  server!: Server

  constructor(private readonly state: GatewayStateService) {}

  afterInit(): void {
    this.server.on('connection', (ws: WebSocket) => this.onConnection(ws))
  }

  private onConnection(ws: WebSocket): void {
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
          const result = this.state.registerExecutor(ws, deviceId, token)
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
          this.log.log(`executor registered deviceId=${deviceId} pairing=${result.pairingCode}`)
        } else {
          const result = this.state.registerViewer(ws, deviceId, token)
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
        this.state.subscribe(ws, String(msg.sessionKey || ''), clientKey)
        return
      }

      if (msg.type === 'unsubscribe') {
        this.state.unsubscribe(ws, String(msg.sessionKey || ''), clientKey)
        return
      }

      if (msg.type === 'ui_event') {
        this.state.publishUiEventFromExecutor(
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
        this.state.applySessionsSync(deviceId, rows, {
          notifyViewers: !requestId,
        })
        if (requestId) this.state.resolveSessionsRpc(requestId, rows)
        return
      }

      if (msg.type === 'thread_response' && clientKey.startsWith('executor:')) {
        this.state.resolveThreadRpc(
          String(msg.requestId || ''),
          (msg.payload as Record<string, unknown> | null) ?? null,
        )
        return
      }

      if (msg.type === 'thread_snapshot' && clientKey.startsWith('executor:')) {
        const sessionKey = String(msg.sessionKey || '')
        const payload = (msg.payload as Record<string, unknown> | null) ?? null
        this.state.persistThreadSnapshot(sessionKey, payload)
      }
    })

    ws.on('close', () => {
      if (!clientKey) return
      const parts = clientKey.split(':')
      const role = parts[0]
      const deviceId = parts[1]
      this.state.disconnect(clientKey)
      this.log.log(`disconnect ${role} ${deviceId}`)
    })
  }
}
