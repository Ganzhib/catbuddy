import type { WsMessage, SessionClient, WsSessionContext } from './types.js'

export function handleSessionDelete(
  msg: WsMessage,
  client: SessionClient,
  ctx: WsSessionContext,
): void {
  if (!client.clientKey.startsWith('desktop:')) return
  const deviceId = client.clientKey.slice('desktop:'.length)
  void ctx.state.deleteSessionFromDesktop(deviceId, String(msg.sessionKey || ''))
}
