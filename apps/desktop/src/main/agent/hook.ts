/**
 * Shared lifecycle hook primitives for agent runs.
 * 对应 example/agent/hook.py
 */
import type { LLMMessage, ToolCallRequest, ToolEvent, TokenUsage } from '@catbuddy/shared'

export interface AgentHookContext {
  iteration: number
  messages: LLMMessage[]
  response?: {
    content: string | null
    toolCalls: ToolCallRequest[]
    finishReason: string
    reasoningContent?: string
    usage: TokenUsage
  }
  usage: TokenUsage
  toolCalls: ToolCallRequest[]
  toolResults: string[]
  toolEvents: ToolEvent[]
  streamedContent: boolean
  streamedReasoning: boolean
  finalContent: string | null
  stopReason: string | null
  error: string | null
}

export class AgentHook {
  constructor(readonly reraise = false) {}

  wantsStreaming(): boolean {
    return false
  }

  async beforeIteration(_context: AgentHookContext): Promise<void> {}

  async onStream(_context: AgentHookContext, _delta: string): Promise<void> {}

  async onStreamEnd(_context: AgentHookContext, _opts: { resuming: boolean }): Promise<void> {}

  async beforeExecuteTools(_context: AgentHookContext): Promise<void> {}

  async emitReasoning(_reasoningContent: string | null): Promise<void> {}

  async emitReasoningEnd(): Promise<void> {}

  async afterIteration(_context: AgentHookContext): Promise<void> {}

  finalizeContent(_context: AgentHookContext, content: string | null): string | null {
    return content
  }
}

export class CompositeHook extends AgentHook {
  constructor(private readonly _hooks: AgentHook[]) {
    super()
  }

  wantsStreaming(): boolean {
    return this._hooks.some((h) => h.wantsStreaming())
  }

  private async forEachHookSafe(
    method: keyof AgentHook,
    ...args: unknown[]
  ): Promise<void> {
    for (const hook of this._hooks) {
      const fn = hook[method] as (...a: unknown[]) => Promise<void> | string | null
      if (typeof fn !== 'function') continue
      try {
        await (fn as (...a: unknown[]) => Promise<void>).apply(hook, args)
      } catch (err) {
        if (hook.reraise) throw err
        console.error(`[AgentHook] ${String(method)} error in`, hook.constructor.name, err)
      }
    }
  }

  override async beforeIteration(context: AgentHookContext): Promise<void> {
    await this.forEachHookSafe('beforeIteration', context)
  }

  override async onStream(context: AgentHookContext, delta: string): Promise<void> {
    await this.forEachHookSafe('onStream', context, delta)
  }

  override async onStreamEnd(
    context: AgentHookContext,
    opts: { resuming: boolean },
  ): Promise<void> {
    await this.forEachHookSafe('onStreamEnd', context, opts)
  }

  override async beforeExecuteTools(context: AgentHookContext): Promise<void> {
    await this.forEachHookSafe('beforeExecuteTools', context)
  }

  override async emitReasoning(reasoning: string | null): Promise<void> {
    await this.forEachHookSafe('emitReasoning', reasoning)
  }

  override async emitReasoningEnd(): Promise<void> {
    await this.forEachHookSafe('emitReasoningEnd')
  }

  override async afterIteration(context: AgentHookContext): Promise<void> {
    await this.forEachHookSafe('afterIteration', context)
  }

  override finalizeContent(context: AgentHookContext, content: string | null): string | null {
    let result = content
    for (const hook of this._hooks) {
      result = hook.finalizeContent(context, result)
    }
    return result
  }
}
