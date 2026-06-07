/**
 * LangfuseAgentHook — 将 Agent 运行过程追踪上报到 Langfuse
 *
 * 追踪结构：
 *   Trace "agent-turn"             ← 一次完整的用户消息处理
 *   ├── Generation "llm-iter-1"    ← 第1轮 LLM 调用
 *   │   ├── Span "tool:read_file"  ← 工具调用
 *   │   └── Span "tool:exec"
 *   ├── Generation "llm-iter-2"    ← 第2轮 LLM 调用
 *   │   └── Span "tool:write_file"
 *   └── Generation "llm-iter-3"    ← 最终回复（无工具调用）
 *
 * 每轮 Generation 记录：
 *   - model, temperature, maxTokens
 *   - input tokens / output tokens
 *   - 耗时
 *   - 是否触发工具调用
 *   - finish_reason
 *
 * 工具 Span 记录：
 *   - 工具名称、参数摘要、结果摘要
 *   - 执行耗时
 *   - 成功/失败状态
 */
import { AgentHook, type AgentHookContext } from './hook'
import type { LangfuseClient } from './langfuse-client'
import type { LangfuseTraceClient, LangfuseGenerationClient, LangfuseSpanClient } from 'langfuse'

export interface LangfuseHookOptions {
  client: LangfuseClient
  sessionKey: string
  workspace: string
  model: string
  temperature?: number
  maxTokens?: number
  /** 用户消息内容（用作 trace input） */
  userMessage?: string
}

interface TimedSpan {
  span: LangfuseSpanClient
  startTime: Date
}

export class LangfuseAgentHook extends AgentHook {
  private trace: LangfuseTraceClient | null = null
  private currentGeneration: LangfuseGenerationClient | null = null
  private generationStartTime: Date | null = null
  private activeSpans: TimedSpan[] = []
  private iterationCount = 0
  private totalInputTokens = 0
  private totalOutputTokens = 0
  private allToolsUsed: Set<string> = new Set()

  constructor(private opts: LangfuseHookOptions) {
    super()
  }

  // ── 创建 Trace ──
  private ensureTrace(): LangfuseTraceClient | null {
    if (this.trace) return this.trace
    if (!this.opts.client.enabled) return null

    const trace = this.opts.client.createTrace({
      name: 'agent-turn',
      sessionId: this.opts.sessionKey,
      userId: this.opts.sessionKey,
      metadata: {
        workspace: this.opts.workspace,
        model: this.opts.model,
        temperature: this.opts.temperature,
        maxTokens: this.opts.maxTokens,
      },
      tags: ['agent', 'catbuddy'],
      input: this.opts.userMessage,
    })

    if (!trace) {
      console.warn('[langfuse-hook] failed to create trace')
      return null
    }

    this.trace = trace
    return trace
  }

  // ── 生命周期 ──

  override async beforeIteration(ctx: AgentHookContext): Promise<void> {
    this.ensureTrace()
    if (!this.trace || !this.opts.client.enabled) return

    this.iterationCount++
    this.generationStartTime = new Date()

    // 为当前迭代创建 Generation
    try {
      this.currentGeneration = this.trace.generation({
        name: `llm-iter-${this.iterationCount}`,
        model: this.opts.model,
        modelParameters: {
          temperature: this.opts.temperature ?? 0.7,
          maxTokens: this.opts.maxTokens ?? 4096,
        },
        input: this._summarizeMessages(ctx.messages),
        startTime: this.generationStartTime,
      })
    } catch (err: any) {
      console.warn(`[langfuse-hook] failed to create generation: ${err.message}`)
      this.currentGeneration = null
    }
  }

  override async beforeExecuteTools(ctx: AgentHookContext): Promise<void> {
    // 工具调用前记录模型响应概要
    if (!this.currentGeneration) return

    if (ctx.response) {
      // 累加 token 用量
      this.totalInputTokens += ctx.response.usage?.inputTokens ?? 0
      this.totalOutputTokens += ctx.response.usage?.outputTokens ?? 0

      // 记录工具调用列表到 generation 元数据
      const toolNames = ctx.response.toolCalls?.map((tc) => tc.name) ?? []
      if (toolNames.length > 0) {
        try {
          this.currentGeneration.update({
            metadata: {
              toolCalls: toolNames,
              totalInputTokens: this.totalInputTokens,
              totalOutputTokens: this.totalOutputTokens,
            },
          })
        } catch { /* 忽略更新错误 */ }
        toolNames.forEach((n) => this.allToolsUsed.add(n))
      }
    }
  }

  override async afterIteration(ctx: AgentHookContext): Promise<void> {
    if (!this.currentGeneration) return

    // 为每个工具调用创建 Span
    this._recordToolSpans(ctx)

    // 结束当前 Generation
    const endTime = new Date()
    const durationMs = this.generationStartTime
      ? endTime.getTime() - this.generationStartTime.getTime()
      : 0

    try {
      this.currentGeneration.end({
        output: ctx.response
          ? {
              content: this._truncate(ctx.response.content ?? '', 2000),
              finishReason: ctx.response.finishReason,
              toolCallCount: ctx.response.toolCalls?.length ?? 0,
              reasoningContent: ctx.response.reasoningContent
                ? this._truncate(ctx.response.reasoningContent, 500)
                : undefined,
            }
          : null,
        usage: ctx.response?.usage
          ? {
              promptTokens: ctx.response.usage.inputTokens,
              completionTokens: ctx.response.usage.outputTokens,
            }
          : undefined,
        metadata: {
          durationMs,
          streamedContent: ctx.streamedContent,
          streamedReasoning: ctx.streamedReasoning,
        },
      })
    } catch (err: any) {
      console.warn(`[langfuse-hook] failed to end generation: ${err.message}`)
    }

    this.currentGeneration = null
    this.generationStartTime = null
    this.activeSpans = []

    // 如果是最终响应（finalContent 已设置），更新 trace 输出
    if (ctx.finalContent) {
      this._finalizeTrace(ctx)
    }
  }

  // ── 流式回调（可选：如果想实时看流内容，在这里处理）──
  override wantsStreaming(): boolean {
    // 如果不需要实时流事件上报到 Langfuse，返回 false
    return false
  }

  // ── 清理 ──
  async cleanup(): Promise<void> {
    // 结束未关闭的 generation
    if (this.currentGeneration) {
      try {
        this.currentGeneration.end({
          output: { error: 'agent hook cleanup - generation not properly ended' },
        })
      } catch { /* 忽略 */ }
      this.currentGeneration = null
    }

    // 结束未关闭的 spans
    for (const { span } of this.activeSpans) {
      try {
        span.end({ output: 'cleanup' })
      } catch { /* 忽略 */ }
    }
    this.activeSpans = []

    this.trace = null
    this.iterationCount = 0
  }

  /** 获取最终 trace 引用，用于在外部设置 score */
  getTrace(): LangfuseTraceClient | null {
    return this.trace
  }

  getMetrics() {
    return {
      iterations: this.iterationCount,
      totalInputTokens: this.totalInputTokens,
      totalOutputTokens: this.totalOutputTokens,
      toolsUsed: [...this.allToolsUsed],
    }
  }

  // ── 内部方法 ──

  /** 为工具调用创建 span */
  private _recordToolSpans(ctx: AgentHookContext): void {
    if (!this.trace || !this.opts.client.enabled) return

    const toolCalls = ctx.toolCalls ?? []
    const toolResults = ctx.toolResults ?? []
    const toolEvents = ctx.toolEvents ?? []

    for (let i = 0; i < toolCalls.length; i++) {
      const tc = toolCalls[i]
      const result = toolResults[i] ?? ''
      const ev = toolEvents.find((e) => e.callId === tc.id)

      try {
        const span = this.trace.span({
          name: `tool:${tc.name}`,
          input: this._summarizeToolArgs(tc.arguments),
        })

        const metadata: Record<string, any> = {}
        if (ev) {
          metadata.status = ev.status
          if (ev.durationMs) metadata.durationMs = ev.durationMs
          if (ev.status === 'error' && ev.detail) {
            metadata.error = this._truncate(ev.detail, 200)
          }
        }

        span.end({
          output: this._truncate(result, 1000),
          metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
          level: ev?.status === 'error' ? 'ERROR' : 'DEFAULT',
        } as any)
      } catch (err: any) {
        // 静默失败，避免影响 agent 主流程
      }
    }
  }

  /** 最终化 trace */
  private _finalizeTrace(ctx: AgentHookContext): void {
    if (!this.trace) return

    try {
      this.trace.update({
        output: {
          finalContent: this._truncate(ctx.finalContent ?? '', 2000),
          stopReason: ctx.stopReason ?? 'unknown',
          iterations: this.iterationCount,
          toolsUsed: [...this.allToolsUsed],
          totalInputTokens: this.totalInputTokens,
          totalOutputTokens: this.totalOutputTokens,
        },
        metadata: {
          ...(this.opts.workspace ? { workspace: this.opts.workspace } : {}),
          iterations: this.iterationCount,
          toolsUsedCount: this.allToolsUsed.size,
          totalTokens: this.totalInputTokens + this.totalOutputTokens,
        },
      })
    } catch (err: any) {
      console.warn(`[langfuse-hook] failed to update trace: ${err.message}`)
    }
  }

  /** 消息列表摘要（避免 input 过大） */
  private _summarizeMessages(messages: any[]): any {
    if (!messages || messages.length === 0) return ''
    // 只保留最近 20 条消息的摘要
    const recent = messages.slice(-20)
    return recent.map((m) => ({
      role: m.role,
      content: typeof m.content === 'string'
        ? this._truncate(m.content, 500)
        : m.content ? '[complex content]' : null,
      ...(m.toolCalls ? { toolCalls: m.toolCalls.map((tc: any) => tc.name) } : {}),
    }))
  }

  private _summarizeToolArgs(args: Record<string, any>): Record<string, any> {
    const summary: Record<string, any> = {}
    for (const [key, value] of Object.entries(args ?? {})) {
      if (typeof value === 'string') {
        summary[key] = this._truncate(value, 200)
      } else if (typeof value === 'object' && value !== null) {
        summary[key] = `[${Array.isArray(value) ? `array(${value.length})` : 'object'}]`
      } else {
        summary[key] = value
      }
    }
    return summary
  }

  private _truncate(s: string, maxLen: number): string {
    if (!s) return ''
    if (s.length <= maxLen) return s
    return s.slice(0, maxLen) + '…'
  }
}
