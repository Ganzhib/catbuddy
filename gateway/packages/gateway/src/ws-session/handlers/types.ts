import type { WebSocket } from 'ws'
import type { AuthService } from '../../session/auth/auth.service.js'
import type { GatewayStateService } from '../../session/gateway-state.js'

export interface WsSessionContext {
  state: GatewayStateService
  auth: AuthService
  log: (msg: string) => void
}

export interface SessionClient {
  clientKey: string
  ws: WebSocket
}

export type WsMessage = Record<string, unknown>

export type MessageHandler = (
  msg: WsMessage,
  client: SessionClient,
  ctx: WsSessionContext,
) => void
