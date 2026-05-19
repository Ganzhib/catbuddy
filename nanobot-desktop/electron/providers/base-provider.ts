/**
 * LLM Provider 抽象基类
 */
import type {
  LLMMessage, LLMResponse, ToolCallRequest,
  ToolDefinition, GenerationSettings,
} from '../../shared/types'

// ═══ 流式聊天参数 ═══
export interface ChatStreamOpts {
  messages: LLMMessage[]
  tools?: ToolDefinition[]
  model?: string
  maxTokens?: number
  temperature?: number
  reasoningEffort?: string
  toolChoice?: 'auto' | 'required' | 'none'
  onContentDelta?: (delta: string) => Promise<void>
  onThinkingDelta?: (delta: string) => Promise<void>
}

export interface ChatStreamWithRetryOpts extends ChatStreamOpts {
  retryMode?: 'standard' | 'persistent'
  onRetryWait?: (msg: string) => Promise<void>
  timeout?: number
}

// ═══ 抽象基类 ═══
export abstract class LLMProvider {
  abstract readonly name: string
  defaultModel: string = ''

  generation: GenerationSettings = { temperature: 0.7, maxTokens: 4096 }

  /** 非流式聊天 */
  abstract chat(opts: ChatStreamOpts): Promise<LLMResponse>

  /** 流式聊天 — 子类必须实现 */
  abstract chatStream(opts: ChatStreamOpts): Promise<LLMResponse>

  /** 带重试的流式调用 */
  async chatStreamWithRetry(opts: ChatStreamWithRetryOpts): Promise<LLMResponse> {
    const maxAttempts = opts.retryMode === 'persistent' ? Infinity : 3
    const baseDelays = [1, 2, 4]
    let lastError: Error | null = null

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const response = await this.chatStream({
          messages: opts.messages,
          tools: opts.tools,
          model: opts.model,
          maxTokens: opts.maxTokens,
          temperature: opts.temperature,
          onContentDelta: opts.onContentDelta,
          onThinkingDelta: opts.onThinkingDelta,
        })

        if (response.finishReason !== 'error') return response
        if (!this.isTransientError(response)) return response

        const delay = response.retryAfter ?? baseDelays[Math.min(attempt, baseDelays.length - 1)]
        await opts.onRetryWait?.(
          `Model error, retrying in ${Math.ceil(delay)}s (attempt ${attempt + 1})`,
        )
        await sleep(delay * 1000)
      } catch (err: any) {
        lastError = err
        if (err.name === 'AbortError') throw err
        const delay = baseDelays[Math.min(attempt, baseDelays.length - 1)]
        await sleep(delay * 1000)
      }
    }

    return {
      content: lastError?.message ?? 'Error: max retries exceeded',
      toolCalls: [],
      finishReason: 'error',
      usage: { inputTokens: 0, outputTokens: 0 },
    }
  }

  protected isTransientError(response: LLMResponse): boolean {
    if (response.errorShouldRetry !== undefined) return response.errorShouldRetry
    if (response.errorStatusCode === 429) return true
    if (response.errorStatusCode && response.errorStatusCode >= 500) return true
    if (response.errorKind === 'timeout' || response.errorKind === 'connection') return true
    return false
  }

  /** 强制角色交替（部分 provider 要求） */
  protected enforceRoleAlternation(messages: LLMMessage[]): LLMMessage[] {
    const merged: LLMMessage[] = []
    for (const msg of messages) {
      const prev = merged[merged.length - 1]
      if (
        prev &&
        msg.role !== 'system' &&
        msg.role !== 'tool' &&
        prev.role === msg.role &&
        msg.role === 'user'
      ) {
        const pc = typeof prev.content === 'string' ? prev.content : ''
        const mc = typeof msg.content === 'string' ? msg.content : ''
        merged[merged.length - 1] = { ...prev, content: `${pc}\n\n${mc}` }
      } else {
        merged.push({ ...msg })
      }
    }
    // 移除末尾的 assistant 消息（大部分 provider 不接受 assistant 收尾）
    while (merged.length > 0 && merged[merged.length - 1].role === 'assistant') {
      merged.pop()
    }
    return merged
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}
