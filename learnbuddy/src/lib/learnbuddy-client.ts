/**
 * IPC-based learnbuddyClient — 保持与原版 WebSocket 客户端相同的公开 API
 * 内部使用 window.learnbuddy IPC bridge，替代 WebSocket 通信
 */
import type {
  ConnectionStatus, InboundEvent, Outbound,
  OutboundMedia, OutboundImageGeneration,
} from './types'

type Unsubscribe = () => void
type EventHandler = (ev: InboundEvent) => void
type StatusHandler = (status: ConnectionStatus) => void
type RuntimeModelHandler = (modelName: string | null, modelPreset?: string | null) => void
type SessionUpdateScope = 'metadata' | 'thread' | string
type SessionUpdateHandler = (chatId: string, scope?: SessionUpdateScope) => void
type GoHomeHandler = () => void

export type StreamError =
  | { kind: 'message_too_big' }

type ErrorHandler = (error: StreamError) => void

const DEFAULT_CHAT_ID = `desktop:${Date.now()}_main`

export class learnbuddyClient {
  // ── 公开状态（与原版相同） ──
  status_: ConnectionStatus = 'idle'
  socket = null  // 不再使用 WebSocket，保持 null 兼容旧代码
  readyChatId: string = DEFAULT_CHAT_ID

  private knownChats = new Set<string>()
  private chatHandlers = new Map<string, Set<EventHandler>>()
  private statusHandlers = new Set<StatusHandler>()
  private runtimeModelHandlers = new Set<RuntimeModelHandler>()
  private sessionUpdateHandlers = new Set<SessionUpdateHandler>()
  private errorHandlers = new Set<ErrorHandler>()
  private _unsubs: Unsubscribe[] = []

  /** 当前活跃的 streamId / chatId */
  private _currentStreamId: string | null = null
  private _activeChatId: string = DEFAULT_CHAT_ID
  private _latencyMs: number | null = null
  private _goHomeHandlers = new Set<GoHomeHandler>()

  constructor(private token: string, private wsPath: string) {
    // token / wsPath 保留兼容，实际通过 IPC 通信
  }

  // ═══ 公开属性（兼容原版） ═══

  get status(): ConnectionStatus { return this.status_ }
  get defaultChatId(): string | null { return DEFAULT_CHAT_ID }

  /** 兼容原版 WebSocket URL 切换（IPC 下无操作） */
  updateUrl(_url: string): void {}

  /** IPC 下暂无 goal_status 追踪，始终返回 null */
  getRunStartedAt(_chatId: string): number | null { return null }

  /** IPC 下暂无 goal_state */
  getGoalState(_chatId: string) { return undefined }

  // ═══ 公开 API（签名与原版完全一致） ═══

  /** 连接 —— IPC 下即注册所有事件监听 */
  connect(): void {
    this.setStatus('connecting')

    const api = window.learnbuddy
    if (!api) {
      this.setStatus('error')
      return
    }

    this._unsubs = [
      api.onStreamDelta(({ content, streamId }) => {
        this._currentStreamId = streamId
        this._dispatch(this._activeChatId, {
          event: 'delta',
          chat_id: this._activeChatId,
          text: content,
          stream_id: streamId,
        })
      }),

      api.onStreamEnd(({ streamId, resuming: _resuming }) => {
        this._dispatch(this._activeChatId, {
          event: 'stream_end',
          chat_id: this._activeChatId,
          stream_id: streamId,
        })
      }),

      api.onTurnComplete((data) => {
        this._latencyMs = data.latencyMs
        this._dispatch(this._activeChatId, {
          event: 'turn_end',
          chat_id: this._activeChatId,
          latency_ms: data.latencyMs,
        })
        this._dispatch(this._activeChatId, {
          event: 'goal_status',
          chat_id: this._activeChatId,
          status: 'idle',
        })
      }),

      api.onReasoningDelta(({ content }) => {
        this._dispatch(this._activeChatId, {
          event: 'reasoning_delta',
          chat_id: this._activeChatId,
          text: content,
        })
      }),

      api.onReasoningEnd(() => {
        this._dispatch(this._activeChatId, {
          event: 'reasoning_end',
          chat_id: this._activeChatId,
        })
      }),

      api.onToolProgress((data) => {
        this._dispatch(this._activeChatId, {
          event: 'message',
          chat_id: this._activeChatId,
          text: `${data.status === 'started' ? '🔧' : '✅'} ${data.name}${data.detail ? `: ${data.detail}` : ''}`,
          kind: 'tool_hint',
          tool_events: [{
            version: 1,
            phase: data.status === 'started' ? 'start' : data.status === 'completed' ? 'end' : 'error',
            name: data.name,
          }],
        })
      }),

      api.onSystemMessage(({ text }) => {
        this._dispatch(this._activeChatId, {
          event: 'message',
          chat_id: this._activeChatId,
          text,
          kind: 'progress',
        })
        // /new 清空了后端 session → 刷新前端 + 回到首页
        if (text === 'Started a new conversation.') {
          for (const h of this.sessionUpdateHandlers) {
            try { h(this._activeChatId, 'thread') } catch { /* 隔离 */ }
          }
          for (const h of this._goHomeHandlers) {
            try { h() } catch { /* 隔离 */ }
          }
        }
      }),
    ]

    // IPC 立即就绪，模拟 "open"
    this.knownChats.add(DEFAULT_CHAT_ID)
    this.setStatus('open')

    // 发送 ready 事件
    this._dispatch(DEFAULT_CHAT_ID, {
      event: 'ready',
      chat_id: DEFAULT_CHAT_ID,
      client_id: 'desktop',
    })

    // 发送 attached
    this._dispatch(DEFAULT_CHAT_ID, {
      event: 'attached',
      chat_id: DEFAULT_CHAT_ID,
    })
  }

  close(): void {
    this._unsubs.forEach(fn => fn())
    this._unsubs = []
    this.chatHandlers.clear()
    this.setStatus('closed')
  }

  // ═══ 事件订阅 ═══

  onStatus(handler: StatusHandler): Unsubscribe {
    this.statusHandlers.add(handler)
    // 立即通知当前状态
    handler(this.status_)
    return () => this.statusHandlers.delete(handler)
  }

  onSessionUpdate(handler: SessionUpdateHandler): Unsubscribe {
    this.sessionUpdateHandlers.add(handler)
    return () => this.sessionUpdateHandlers.delete(handler)
  }

  onRuntimeModelUpdate(handler: RuntimeModelHandler): Unsubscribe {
    this.runtimeModelHandlers.add(handler)
    return () => this.runtimeModelHandlers.delete(handler)
  }

  onError(handler: ErrorHandler): Unsubscribe {
    this.errorHandlers.add(handler)
    return () => this.errorHandlers.delete(handler)
  }

  onGoHomeRequest(handler: GoHomeHandler): Unsubscribe {
    this._goHomeHandlers.add(handler)
    return () => this._goHomeHandlers.delete(handler)
  }

  onChat(chatId: string, handler: EventHandler): Unsubscribe {
    let handlers = this.chatHandlers.get(chatId)
    if (!handlers) {
      handlers = new Set()
      this.chatHandlers.set(chatId, handlers)
    }
    handlers.add(handler)
    return () => {
      handlers?.delete(handler)
      if (handlers?.size === 0) this.chatHandlers.delete(chatId)
    }
  }

  // ═══ 发送 ═══

  newChat(_timeoutMs: number = 5000): Promise<string> {
    // chatId 不含前缀（由 useSessions.splitKey 解析 channel:chatId）
    const newId = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    this.knownChats.add(newId)
    return Promise.resolve(newId)
  }

  attach(chatId: string): void {
    this.knownChats.add(chatId)
  }

  sendMessage(
    chatId: string,
    content: string,
    media?: OutboundMedia[],
    _options?: { imageGeneration?: OutboundImageGeneration },
  ): void {
    this.knownChats.add(chatId)
    this._activeChatId = chatId  // 记住当前活跃 chat，stream 事件路由到此

    // 提取 base64 图片 URLs
    const mediaUrls = media?.map(m => m.data_url) ?? []

    // 通过 IPC 发送，携带 chatId 用于多对话隔离
    window.learnbuddy.sendMessage(chatId, content, mediaUrls)
  }

  // ═══ 内部方法 ═══

  private _dispatch(chatId: string, ev: InboundEvent): void {
    const handlers = this.chatHandlers.get(chatId)
    if (handlers) {
      for (const h of handlers) {
        try { h(ev) } catch { /* 错误隔离 */ }
      }
    }
  }

  private setStatus(status: ConnectionStatus): void {
    if (this.status_ === status) return
    this.status_ = status
    for (const h of this.statusHandlers) h(status)
  }
}
