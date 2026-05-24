import type {
  GatewaySessionRow,
  MessageRecord,
  SessionDetail,
  SessionInfo,
} from '../session-types.js'

/** Gateway session persistence (MySQL). */
export interface SessionStore {
  getOrCreate(key: string): Promise<SessionInfo>
  get(key: string): Promise<SessionInfo | null>
  getDetail(key: string): Promise<SessionDetail | null>
  hasMessages(key: string): Promise<boolean>
  addUserMessage(sessionKey: string, content: string): Promise<void>
  addAssistantMessage(sessionKey: string, content: string): Promise<void>
  addMessage(
    sessionKey: string,
    msg: Omit<MessageRecord, 'id' | 'sessionKey' | 'timestamp'>,
  ): Promise<void>
  importWebuiPayload(
    sessionKey: string,
    payload: Record<string, unknown> | null,
  ): Promise<void>
  mergeSessionRow(row: GatewaySessionRow): Promise<void>
  mergeSessionRows(rows: GatewaySessionRow[]): Promise<void>
  list(): Promise<SessionInfo[]>
  listRows(): Promise<GatewaySessionRow[]>
  getSessionOwner(sessionKey: string): Promise<string | null>
  setSessionOwner(sessionKey: string, ownerEmail: string): Promise<void>
  isSessionOwnedBy(sessionKey: string, ownerEmail: string): Promise<boolean>
  listRowsForOwner(ownerEmail: string): Promise<GatewaySessionRow[]>
  deleteSession(sessionKey: string): Promise<boolean>
  buildWebuiThread(sessionKey: string): Promise<Record<string, unknown> | null>
  collectSyncThreads(): Promise<Record<string, Record<string, unknown>>>
  collectSyncThreadsForOwner(
    ownerEmail: string,
  ): Promise<Record<string, Record<string, unknown>>>
}
