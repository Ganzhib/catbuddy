/**
 * Desktop ⇄ Gateway session protocol helpers (mirrors sdk-web session helpers).
 */
import type {
  GatewayDesktopClientMessage,
  GatewaySessionRow,
  GatewayServerToDesktopMessage,
} from '@catbuddy/shared'
import { bareChatId } from '@catbuddy/shared'

export const GATEWAY_DESKTOP_RECONNECT_MS = 3_000
export const GATEWAY_DESKTOP_RECONNECT_MAX_MS = 60_000

export type GatewayInboundMessage = Extract<
  GatewayServerToDesktopMessage,
  { type: 'inbound_message' }
>

export function sessionRowFromKey(
  key: string,
  meta: {
    createdAt: string
    updatedAt: string
    title?: string
    preview?: string
    workspaceFolderId?: string | null
    workspaceFolderName?: string | null
  },
): GatewaySessionRow {
  const channel = key.includes(':') ? key.slice(0, key.indexOf(':')) : 'desktop'
  const chatId = bareChatId(key)
  return {
    key,
    channel,
    chatId,
    createdAt: meta.createdAt,
    updatedAt: meta.updatedAt,
    title: meta.title ?? '',
    preview: meta.preview ?? '',
    workspaceFolderId: meta.workspaceFolderId ?? null,
    workspaceFolderName: meta.workspaceFolderName ?? null,
  }
}

export function buildUiEventMessage(
  sessionKey: string,
  chatId: string,
  event: Record<string, unknown>,
): GatewayDesktopClientMessage {
  return {
    type: 'ui_event',
    sessionKey,
    chatId,
    event,
  }
}

export function buildFocusSessionEvent(sessionKey: string): Record<string, unknown> {
  const chatId = bareChatId(sessionKey)
  return {
    event: 'session_updated',
    chat_id: chatId,
    scope: 'focus',
  }
}

export function channelFromSessionKey(sessionKey: string): string {
  const idx = sessionKey.indexOf(':')
  return idx === -1 ? 'desktop' : sessionKey.slice(0, idx)
}
