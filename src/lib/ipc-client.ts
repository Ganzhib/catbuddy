/**
 * IPC Client — 替代原版 WebSocket learnbuddyClient
 * 保持与原版相同的 API 签名，方便后续迁移 webui 组件
 */
import type { FileEditEvent, ToolEvent, TurnCompleteData, SessionInfo, SessionDetail } from '../../shared/types'

interface StreamDeltaData { content: string; streamId: string }
interface StreamEndData { streamId: string; resuming: boolean }
interface ReasoningDeltaData { content: string }
interface RetryWaitData { message: string }

export class IpcClient {
  // ── Agent ──
  async sendMessage(content: string, media?: string[]) {
    await window.learnbuddy.sendMessage('desktop:local', content, media)
  }

  async stopAgent(sessionKey: string = 'desktop:local') {
    await window.learnbuddy.stopAgent(sessionKey)
  }

  onStreamDelta(cb: (data: StreamDeltaData) => void): () => void {
    return window.learnbuddy.onStreamDelta(cb)
  }

  onStreamEnd(cb: (data: StreamEndData) => void): () => void {
    return window.learnbuddy.onStreamEnd(cb)
  }

  onReasoningDelta(cb: (data: ReasoningDeltaData) => void): () => void {
    return window.learnbuddy.onReasoningDelta(cb)
  }

  onReasoningEnd(cb: () => void): () => void {
    return window.learnbuddy.onReasoningEnd(cb)
  }

  onToolProgress(cb: (data: ToolEvent) => void): () => void {
    return window.learnbuddy.onToolProgress(cb)
  }

  onFileEdit(cb: (data: FileEditEvent) => void): () => void {
    return window.learnbuddy.onFileEdit(cb)
  }

  onRetryWait(cb: (data: RetryWaitData) => void): () => void {
    return window.learnbuddy.onRetryWait(cb)
  }

  onTurnComplete(cb: (data: TurnCompleteData) => void): () => void {
    return window.learnbuddy.onTurnComplete(cb)
  }

  // ── Session ──
  async listSessions(): Promise<SessionInfo[]> {
    return window.learnbuddy.listSessions()
  }

  async getSession(key: string): Promise<SessionDetail | null> {
    return window.learnbuddy.getSession(key)
  }

  async deleteSession(key: string): Promise<boolean> {
    return window.learnbuddy.deleteSession(key)
  }

  async clearSession(key: string) {
    await window.learnbuddy.clearSession(key)
  }

  async newSession(): Promise<{ key: string }> {
    return window.learnbuddy.newSession()
  }
}

/** 全局单例 */
export const ipcClient = new IpcClient()
