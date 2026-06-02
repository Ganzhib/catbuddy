import type { WsMessage, SessionClient, WsSessionContext } from './types.js'

export function handleThreadResponse(
  msg: WsMessage,
  client: SessionClient,
  ctx: WsSessionContext,
): void {
  if (!client.clientKey.startsWith('desktop:')) return
  ctx.state.resolveThreadRpc(
    String(msg.requestId || ''),
    (msg.payload as Record<string, unknown> | null) ?? null,
    String(msg.sessionKey || ''),
  )
}

export function handleThreadSnapshot(
  msg: WsMessage,
  client: SessionClient,
  ctx: WsSessionContext,
): void {
  if (!client.clientKey.startsWith('desktop:')) return
  const sessionKey = String(msg.sessionKey || '')
  const payload = (msg.payload as Record<string, unknown> | null) ?? null
  const deviceId = client.clientKey.slice('desktop:'.length)
  void ctx.state.persistThreadSnapshot(sessionKey, payload, deviceId)
}
