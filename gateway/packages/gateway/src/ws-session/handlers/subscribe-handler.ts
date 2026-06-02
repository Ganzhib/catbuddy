import type { WsMessage, SessionClient, WsSessionContext } from './types.js'

export function handleSubscribe(
  msg: WsMessage,
  client: SessionClient,
  ctx: WsSessionContext,
): void {
  void ctx.state.subscribe(
    client.ws,
    String(msg.sessionKey || ''),
    client.clientKey,
  )
}

export function handleUnsubscribe(
  msg: WsMessage,
  client: SessionClient,
  ctx: WsSessionContext,
): void {
  ctx.state.unsubscribe(
    client.ws,
    String(msg.sessionKey || ''),
    client.clientKey,
  )
}
