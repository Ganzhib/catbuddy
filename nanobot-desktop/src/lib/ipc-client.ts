/**
 * IPC Client — 替代原版 WebSocket NanobotClient
 * 保持与原版相同的 API 签名，方便后续迁移 webui 组件
 */
import type { ToolEvent, TurnCompleteData, SessionInfo, SessionDetail } from '../../shared/types'

interface StreamDeltaData { content: string; streamId: string }
interface StreamEndData { streamId: string; resuming: boolean }
interface ReasoningDeltaData { content: string }
interface RetryWaitData { message: string }

export class IpcClient {
  // ── Agent ──
  async sendMessage(content: string, media?: string[]) {
    await window.nanobot.sendMessage('desktop:local', content, media)
  }

  async stopAgent(sessionKey: string = 'desktop:local') {
    await window.nanobot.stopAgent(sessionKey)
  }

  onStreamDelta(cb: (data: StreamDeltaData) => void): () => void {
    return window.nanobot.onStreamDelta(cb)
  }

  onStreamEnd(cb: (data: StreamEndData) => void): () => void {
    return window.nanobot.onStreamEnd(cb)
  }

  onReasoningDelta(cb: (data: ReasoningDeltaData) => void): () => void {
    return window.nanobot.onReasoningDelta(cb)
  }

  onReasoningEnd(cb: () => void): () => void {
    return window.nanobot.onReasoningEnd(cb)
  }

  onToolProgress(cb: (data: ToolEvent) => void): () => void {
    return window.nanobot.onToolProgress(cb)
  }

  onRetryWait(cb: (data: RetryWaitData) => void): () => void {
    return window.nanobot.onRetryWait(cb)
  }

  onTurnComplete(cb: (data: TurnCompleteData) => void): () => void {
    return window.nanobot.onTurnComplete(cb)
  }

  // ── Session ──
  async listSessions(): Promise<SessionInfo[]> {
    return window.nanobot.listSessions()
  }

  async getSession(key: string): Promise<SessionDetail | null> {
    return window.nanobot.getSession(key)
  }

  async deleteSession(key: string): Promise<boolean> {
    return window.nanobot.deleteSession(key)
  }

  async clearSession(key: string) {
    await window.nanobot.clearSession(key)
  }

  async newSession(): Promise<{ key: string }> {
    return window.nanobot.newSession()
  }
}

/** 全局单例 */
export const ipcClient = new IpcClient()
