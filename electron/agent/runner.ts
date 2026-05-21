/**
 * AgentRunner — LLM + Tool 执行循环 + 上下文治理
 * 对应原版 learnbuddy/agent/runner.py
 */
import { LLMProvider } from '../providers'
import { ToolRegistry } from './tool-registry'
import type {
  LLMMessage, ToolCallRequest, ToolEvent,
  AgentRunResult, TokenUsage,
} from '../../shared/types'

export interface RunSpec {
  initialMessages: LLMMessage[]
  tools: ToolRegistry
  model: string
  maxIterations: number
  maxToolResultChars: number
  temperature?: number
  maxTokens?: number
  concurrentTools: boolean
  workspace: string
  sessionKey?: string
  contextWindowTokens: number
  contextBlockLimit?: number
  providerRetryMode: 'standard' | 'persistent'
  progressCallback?: (ev: ToolEvent) => Promise<void>
  retryWaitCallback?: (msg: string) => Promise<void>
  onStream?: (delta: string) => Promise<void>
  onReasoning?: (delta: string) => Promise<void>
  llmTimeoutS?: number
}

// ═══ 常量 ═══
const MAX_EMPTY_RETRIES = 2
const MAX_LENGTH_RECOVERIES = 3
const SNIP_SAFETY_BUFFER = 1024
const MICROCOMPACT_KEEP_RECENT = 10
const COMPACTABLE_TOOLS = new Set(['read_file', 'exec', 'grep', 'web_search', 'web_fetch', 'list_dir'])
const MAX_EXTERNAL_LOOKUPS = 2

/** 粗略估算 message 的 token 数 */
function estimateTokens(content: unknown): number {
  if (typeof content === 'string') return Math.ceil(content.length / 3)
  return 0
}

function estimateMessageTokens(msg: LLMMessage): number {
  let t = estimateTokens(msg.content)
  if (msg.toolCalls) {
    for (const tc of msg.toolCalls) {
      t += estimateTokens(JSON.stringify(tc.arguments))
    }
  }
  return t
}

export class AgentRunner {
  constructor(private provider: LLMProvider) {}

  async run(spec: RunSpec): Promise<AgentRunResult> {
    const messages: LLMMessage[] = [...spec.initialMessages]
    const toolsUsed: string[] = []
    const toolEvents: ToolEvent[] = []
    const usage: TokenUsage = { inputTokens: 0, outputTokens: 0 }
    let finalContent: string | null = null
    let stopReason = 'completed'
    let emptyRetries = 0
    let lengthRecoveries = 0
    // 重复外部查询计数
    const externalLookupCounts = new Map<string, number>()

    for (let iteration = 0; iteration < spec.maxIterations; iteration++) {
      // ── 上下文治理：每轮前清理 ──
      this._governContext(messages, spec)

      // 1. 调用 LLM
      const response = await this.provider.chatStreamWithRetry({
        messages,
        tools: spec.tools.getDefinitions(),
        model: spec.model,
        maxTokens: spec.maxTokens ?? 4096,
        temperature: spec.temperature ?? 0.7,
        retryMode: spec.providerRetryMode,
        onContentDelta: spec.onStream,
        onThinkingDelta: spec.onReasoning,
        onRetryWait: spec.retryWaitCallback,
        timeout: spec.llmTimeoutS,
      })

      // 2. 累加 usage
      usage.inputTokens += response.usage.inputTokens
      usage.outputTokens += response.usage.outputTokens

      // 3. 工具调用
      if (response.toolCalls.length > 0 && response.finishReason !== 'error') {
        // ── 重复外部搜索限制 ──
        const blockedTools: string[] = []
        for (const tc of response.toolCalls) {
          if (tc.name === 'web_fetch' || tc.name === 'web_search') {
            const sig = `${tc.name}:${JSON.stringify(tc.arguments)}`
            const count = (externalLookupCounts.get(sig) || 0) + 1
            externalLookupCounts.set(sig, count)
            if (count > MAX_EXTERNAL_LOOKUPS) {
              blockedTools.push(tc.name)
              messages.push({
                role: 'tool' as const,
                toolCallId: tc.id,
                name: tc.name,
                content: 'Error: repeated external lookup blocked. Use existing results to answer.',
              })
            }
          }
        }

        const activeCalls = response.toolCalls.filter(tc => !blockedTools.includes(tc.name))
        if (activeCalls.length === 0) continue

        toolsUsed.push(...activeCalls.map(tc => tc.name))

        for (const toolCall of activeCalls) {
          const t0 = Date.now()
          const base = {
            name: toolCall.name,
            callId: toolCall.id,
            arguments: toolCall.arguments,
          }
          spec.progressCallback?.({ ...base, status: 'started' })

          let result: string
          let failed = false
          try {
            result = await spec.tools.execute(toolCall)
          } catch (err: any) {
            failed = true
            result = `Error: ${err.message}`
            toolEvents.push({ ...base, status: 'error', detail: result })
            spec.progressCallback?.({ ...base, status: 'error', detail: result })
          }

          const truncated = result.length > spec.maxToolResultChars
            ? result.slice(0, spec.maxToolResultChars) + '\n...[truncated]'
            : result || `(${toolCall.name} completed)`

          const durationMs = Date.now() - t0
          if (!failed) {
            toolEvents.push({ ...base, status: 'completed', durationMs })
            spec.progressCallback?.({
              ...base,
              status: 'completed',
              detail: truncated.slice(0, 200),
              durationMs,
            })
          }

          // 注入 tool call + result
          messages.push({
            role: 'assistant',
            content: null,
            toolCalls: [toolCall],
          })
          messages.push({
            role: 'tool',
            toolCallId: toolCall.id,
            name: toolCall.name,
            content: truncated,
          })
        }
        emptyRetries = 0
        lengthRecoveries = 0
        continue
      }

      // 4. 最终回复
      finalContent = response.content ?? ''

      // 空回复重试
      if (!finalContent.trim() && emptyRetries < MAX_EMPTY_RETRIES) {
        emptyRetries++
        messages.push({
          role: 'user',
          content: 'Please provide your response to the user based on the conversation above.',
        })
        continue
      }

      // max_tokens 截断恢复
      if (response.finishReason === 'max_tokens' && lengthRecoveries < MAX_LENGTH_RECOVERIES) {
        lengthRecoveries++
        messages.push({
          role: 'user',
          content: 'Output limit reached. Continue exactly where you left off — no recap, no apology.',
        })
        continue
      }

      stopReason = response.finishReason
      break
    }

    return {
      finalContent,
      messages,
      toolsUsed: [...new Set(toolsUsed)],
      usage,
      stopReason,
      toolEvents,
      hadInjections: false,
    }
  }

  // ═══════════════════════════════════════════════
  //  上下文治理
  // ═══════════════════════════════════════════════

  private _governContext(messages: LLMMessage[], spec: RunSpec) {
    this._dropOrphanToolResults(messages)
    this._backfillMissingToolResults(messages)
    this._microcompact(messages)
    this._snipHistory(messages, spec)
  }

  /** 删除没有对应 assistant tool_call 的 tool result */
  private _dropOrphanToolResults(messages: LLMMessage[]) {
    const toolCallIds = new Set<string>()
    for (const m of messages) {
      if (m.toolCalls) {
        for (const tc of m.toolCalls) toolCallIds.add(tc.id)
      }
    }
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i]
      if (m.role === 'tool' && m.toolCallId && !toolCallIds.has(m.toolCallId)) {
        messages.splice(i, 1)
      }
    }
  }

  /** 为没有对应 tool result 的 tool_call 插入合成错误 */
  private _backfillMissingToolResults(messages: LLMMessage[]) {
    const results = new Map<string, boolean>()
    for (const m of messages) {
      if (m.role === 'tool' && m.toolCallId) results.set(m.toolCallId, true)
    }
    const toInsert: { idx: number; tc: ToolCallRequest }[] = []
    for (let i = 0; i < messages.length; i++) {
      const m = messages[i]
      if (m.toolCalls) {
        for (const tc of m.toolCalls) {
          if (!results.has(tc.id)) {
            toInsert.push({ idx: i + 1, tc })
          }
        }
      }
    }
    for (let j = toInsert.length - 1; j >= 0; j--) {
      const { idx, tc } = toInsert[j]
      messages.splice(idx, 0, {
        role: 'tool',
        toolCallId: tc.id,
        name: tc.name,
        content: '[Tool result unavailable — call was interrupted or lost]',
      })
    }
  }

  /** 微压缩：把旧的可压缩工具结果替换为摘要 */
  private _microcompact(messages: LLMMessage[]) {
    const compactable: number[] = []
    for (let i = 0; i < messages.length; i++) {
      const m = messages[i]
      if (m.role === 'tool' && m.name && COMPACTABLE_TOOLS.has(m.name)) {
        compactable.push(i)
      }
    }
    if (compactable.length <= MICROCOMPACT_KEEP_RECENT) return

    const keepFrom = compactable[compactable.length - MICROCOMPACT_KEEP_RECENT]
    for (const idx of compactable) {
      if (idx >= keepFrom) break
      const m = messages[idx]
      const preview = typeof m.content === 'string' ? m.content.slice(0, 80) : ''
      messages[idx] = { ...m, content: `[${m.name} result: ${preview}...]` }
    }
  }

  /** Token 预算截断：从最早的消息开始删除，保持 system → user/assistant 交替 */
  private _snipHistory(messages: LLMMessage[], spec: RunSpec) {
    const budget = spec.contextWindowTokens - (spec.maxTokens ?? 4096) - SNIP_SAFETY_BUFFER
    if (budget <= 0) return

    let total = 0
    for (let i = messages.length - 1; i >= 0; i--) {
      total += estimateMessageTokens(messages[i])
      if (total > budget) {
        // 从 i+1 截断，但保持从 user 消息开始
        let start = i + 1
        for (let j = start; j < messages.length; j++) {
          if (messages[j].role === 'user') {
            start = j
            // 如果前一条是 assistant（被截断的），保留它
            if (j > start && messages[j - 1]?.role === 'assistant' && messages[j - 1]?.toolCalls?.length) {
              start = j - 1
            }
            break
          }
        }
        messages.splice(0, start)
        return
      }
    }
  }
}
