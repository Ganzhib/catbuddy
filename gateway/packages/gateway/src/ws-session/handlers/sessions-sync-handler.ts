import type { WsMessage, SessionClient, WsSessionContext } from './types.js'

export function handleSessionsSync(
  msg: WsMessage,
  client: SessionClient,
  ctx: WsSessionContext,
): void {
  if (!client.clientKey.startsWith('desktop:')) return

  const deviceId = client.clientKey.slice('desktop:'.length)
  const sessions = (msg.sessions as Array<Record<string, unknown>>) ?? []
  const rows = sessions.map((s) => ({
    key: String(s.key || ''),
    channel: String(s.channel || 'desktop'),
    chatId: String(s.chatId || ''),
    createdAt: String(s.createdAt || new Date().toISOString()),
    updatedAt: String(s.updatedAt || new Date().toISOString()),
    title: s.title != null ? String(s.title) : '',
    preview: String(s.preview || ''),
    workspaceFolderId:
      typeof s.workspaceFolderId === 'string' && s.workspaceFolderId.trim()
        ? s.workspaceFolderId.trim()
        : null,
    workspaceFolderName:
      typeof s.workspaceFolderName === 'string' && s.workspaceFolderName.trim()
        ? s.workspaceFolderName.trim()
        : null,
  }))

  const requestId = msg.requestId ? String(msg.requestId) : ''
  void ctx.state.applySessionsSync(deviceId, rows, { notifyWebClients: !requestId })
  if (requestId) ctx.state.resolveSessionsRpc(requestId, rows)
}
