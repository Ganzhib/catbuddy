import type { MessageHandler, WsMessage } from './types.js'
import { handleSubscribe, handleUnsubscribe } from './subscribe-handler.js'
import { handleUiEvent } from './ui-event-handler.js'
import { handleSessionsSync } from './sessions-sync-handler.js'
import { handleThreadResponse, handleThreadSnapshot } from './thread-handler.js'
import { handleSessionDelete } from './session-delete-handler.js'

export function createHandlerRegistry(): Map<string, MessageHandler> {
  const handlers = new Map<string, MessageHandler>()

  handlers.set('subscribe', handleSubscribe)
  handlers.set('unsubscribe', handleUnsubscribe)
  handlers.set('ui_event', handleUiEvent)
  handlers.set('sessions_sync', handleSessionsSync)
  handlers.set('thread_response', handleThreadResponse)
  handlers.set('thread_snapshot', handleThreadSnapshot)
  handlers.set('session_delete', handleSessionDelete)

  return handlers
}

export function findHandler(
  registry: Map<string, MessageHandler>,
  msg: WsMessage,
): MessageHandler | undefined {
  return registry.get(String(msg.type || ''))
}
