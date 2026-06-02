import { randomBytes } from 'node:crypto'
import type { WebSocket } from 'ws'
import { isWebLoginRequired } from '../../session/auth/auth-policy.js'
import type { WsSessionContext, SessionClient, WsMessage } from './types.js'

export async function handleRegister(
  msg: WsMessage,
  ws: WebSocket,
  ctx: WsSessionContext,
): Promise<SessionClient | null> {
  const token = String(msg.token || '')
  const role = msg.role === 'desktop' ? 'desktop' as const : 'web' as const
  const deviceId = String(msg.deviceId || randomBytes(8).toString('hex'))

  if (role === 'desktop') {
    return handleDesktopRegister(ws, deviceId, token, msg, ctx)
  }
  return handleWebRegister(ws, deviceId, token, msg, ctx)
}

function handleDesktopRegister(
  ws: WebSocket,
  deviceId: string,
  token: string,
  msg: WsMessage,
  ctx: WsSessionContext,
): SessionClient | null {
  const accountEmail = String(msg.accountEmail || '')
  const result = ctx.state.registerDesktop(ws, deviceId, token, accountEmail)

  if (!result.ok) {
    ws.send(JSON.stringify({ type: 'error', message: result.error }))
    ws.close()
    return null
  }

  const clientKey = `desktop:${deviceId}`
  ws.send(JSON.stringify({ type: 'registered', deviceId, role: 'desktop' }))
  ctx.log(`desktop registered deviceId=${deviceId} account=${accountEmail || 'n/a'}`)
  return { clientKey, ws }
}

async function handleWebRegister(
  ws: WebSocket,
  deviceId: string,
  token: string,
  _msg: WsMessage,
  ctx: WsSessionContext,
): Promise<SessionClient | null> {
  if (isWebLoginRequired() && !(await ctx.auth.registerTokenFromJwt(token))) {
    ws.send(JSON.stringify({ type: 'error', message: 'unauthorized' }))
    ws.close()
    return null
  }

  const result = ctx.state.registerWeb(ws, deviceId, token)
  if (!result.ok) {
    ws.send(JSON.stringify({ type: 'error', message: result.error }))
    ws.close()
    return null
  }

  const clientKey = `web:${token}:${deviceId}`
  ws.send(JSON.stringify({ type: 'registered', deviceId, role: 'web' }))

  const desktop = ctx.state.pickDesktopForWebToken(token)
  ctx.state.sendDesktopStatus(!!desktop, {
    ws,
    deviceId: desktop?.deviceId,
  })

  return { clientKey, ws }
}
