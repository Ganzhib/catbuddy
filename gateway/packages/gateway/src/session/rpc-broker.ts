import { randomBytes } from 'node:crypto'
import type { GatewaySessionRow } from './storage/session-types.js'

const DESKTOP_RPC_TIMEOUT_MS = 8_000

type PendingRpc<T> = {
  resolve: (value: T) => void
  reject: (err: Error) => void
  timer: ReturnType<typeof setTimeout>
}

export class RpcBroker {
  private readonly pendingSessions = new Map<string, PendingRpc<GatewaySessionRow[]>>()
  private readonly pendingThreads = new Map<
    string,
    PendingRpc<Record<string, unknown> | null>
  >()

  constructor(private readonly timeoutMs: number = DESKTOP_RPC_TIMEOUT_MS) {}

  requestSessions(execWs: import('ws').WebSocket): Promise<GatewaySessionRow[] | null> {
    const requestId = randomBytes(8).toString('hex')
    return new Promise<GatewaySessionRow[]>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingSessions.delete(requestId)
        reject(new Error('sessions_rpc_timeout'))
      }, this.timeoutMs)
      this.pendingSessions.set(requestId, { resolve, reject, timer })
      execWs.send(JSON.stringify({ type: 'request_sessions', requestId }))
    }).catch(() => null)
  }

  resolveSessions(requestId: string, sessions: GatewaySessionRow[]): void {
    const pending = this.pendingSessions.get(requestId)
    if (!pending) return
    clearTimeout(pending.timer)
    this.pendingSessions.delete(requestId)
    pending.resolve(sessions)
  }

  requestThread(
    execWs: import('ws').WebSocket,
    sessionKey: string,
  ): Promise<Record<string, unknown> | null> {
    const requestId = randomBytes(8).toString('hex')
    return new Promise<Record<string, unknown> | null>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingThreads.delete(requestId)
        reject(new Error('thread_rpc_timeout'))
      }, this.timeoutMs)
      this.pendingThreads.set(requestId, { resolve, reject, timer })
      execWs.send(
        JSON.stringify({ type: 'request_thread', requestId, sessionKey }),
      )
    }).catch(() => null)
  }

  resolveThread(
    requestId: string,
    payload: Record<string, unknown> | null,
    sessionKey?: string,
    onResolved?: (sessionKey: string, payload: Record<string, unknown>) => void,
  ): void {
    if (sessionKey && payload && onResolved) {
      onResolved(sessionKey, payload)
    }
    const pending = this.pendingThreads.get(requestId)
    if (!pending) return
    clearTimeout(pending.timer)
    this.pendingThreads.delete(requestId)
    pending.resolve(payload)
  }
}
