import type { WsMessage, SessionClient, WsSessionContext } from './types.js'

export function handleUiEvent(
  msg: WsMessage,
  client: SessionClient,
  ctx: WsSessionContext,
): void {
  ctx.state.publishUiEventFromDesktop(
    client.clientKey,
    String(msg.sessionKey || ''),
    String(msg.chatId || ''),
    (msg.event as Record<string, unknown>) ?? {},
  )
}
