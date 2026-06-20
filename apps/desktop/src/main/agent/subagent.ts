/**
 * Subagent manager for background task execution.
 * 对应 example/agent/subagent.py
 */
import * as path from 'node:path'
import { nanoid } from 'nanoid'
import type { LLMProvider } from '../providers/base-provider'
import type { MessageBus } from '../bus'
import type { InboundMessage, ToolEvent } from '@catbuddy/shared'
import { AgentRunner, type RunSpec } from './runner'
import type { Context } from './context'
import { AgentHook, type AgentHookContext, CompositeHook } from './hook'
import { ToolRegistry } from './tools'
import { builtinToolFactories } from './tools/builtin'
import { FileStates, runWithFileStates } from './tools/file_state'
import type { TemplateLoader } from './context/template-loader.js'
import type { LangfuseClient } from './langfuse-client'
import { LangfuseAgentHook } from './langfuse-hook'

export interface SubagentStatus {
  taskId: string
  label: string
  taskDescription: string
  startedAt: number
  phase: string
  iteration: number
  toolEvents: ToolEvent[]
  stopReason: string | null
  error: string | null
}

class SubagentHook extends AgentHook {
  constructor(
    private readonly status: SubagentStatus,
  ) {
    super()
  }

  override async beforeExecuteTools(context: AgentHookContext): Promise<void> {
    for (const tc of context.toolCalls) {
      console.debug(`[Subagent ${this.status.taskId}] tool: ${tc.name}`)
    }
  }

  override async afterIteration(context: AgentHookContext): Promise<void> {
    this.status.iteration = context.iteration
    this.status.toolEvents = [...context.toolEvents]
    if (context.error) this.status.error = context.error
  }
}

export class SubagentManager {
  readonly runner: AgentRunner
  private readonly _running = new Map<string, Promise<void>>()
  private readonly _statuses = new Map<string, SubagentStatus>()
  private readonly _sessionTasks = new Map<string, Set<string>>()
  maxConcurrentSubagents = 3

  private _workspace: string
  private _projectRoot: string
  private _catbuddyDir: string
  private _restrictToWorkspace: boolean
  private templates: TemplateLoader
  private _langfuseClient: LangfuseClient | null = null

  constructor(
    private provider: LLMProvider,
    workspace: string,
    private readonly bus: MessageBus,
    private model: string,
    private readonly maxToolResultChars: number,
    private readonly maxIterations: number,
    restrictToWorkspace: boolean,
    templates: TemplateLoader,
    projectRoot?: string,
    catbuddyDir?: string,
  ) {
    this._workspace = workspace
    this._projectRoot =
      projectRoot ?? path.dirname(path.dirname(path.resolve(workspace)))
    this._catbuddyDir =
      catbuddyDir ?? path.join(this._projectRoot, '.catbuddy')
    this._restrictToWorkspace = restrictToWorkspace
    this.templates = templates
    this.runner = new AgentRunner(provider)
  }

  get workspace(): string {
    return this._workspace
  }

  setWorkArea(opts: {
    workspace: string
    projectRoot: string
    catbuddyDir: string
    restrictToWorkspace: boolean
  }): void {
    this._workspace = opts.workspace
    this._projectRoot = opts.projectRoot
    this._catbuddyDir = opts.catbuddyDir
    this._restrictToWorkspace = opts.restrictToWorkspace
  }

  setProvider(provider: LLMProvider, model: string): void {
    this.provider = provider
    this.model = model
    this.runner.setProvider(provider)
  }

  /** 注入 Langfuse 客户端，为子代理启用 LLM 调用追踪 */
  setLangfuseClient(client: LangfuseClient | null): void {
    this._langfuseClient = client
  }

  private _buildTools(): ToolRegistry {
    const registry = new ToolRegistry()
    registry.setWorkspace(this._workspace, this._restrictToWorkspace)
    registry.setProjectRoot(this._projectRoot, this._catbuddyDir)
    const ctx = registry.createToolContext()
    for (const factory of builtinToolFactories) {
      const tool = factory(ctx)
      if (tool.name === 'generate_image') continue
      registry.register(tool)
    }
    return registry
  }

  getRunningCount(): number {
    return this._running.size
  }

  async spawn(opts: {
    task: string
    label?: string | null
    originChannel: string
    originChatId: string
    sessionKey?: string | null
    temperature?: number
  }): Promise<string> {
    if (this.getRunningCount() >= this.maxConcurrentSubagents) {
      return (
        `Cannot spawn subagent: concurrency limit reached `
        + `(${this.getRunningCount()}/${this.maxConcurrentSubagents} running).`
      )
    }

    const taskId = nanoid(8)
    const displayLabel = opts.label || (
      opts.task.length > 30 ? `${opts.task.slice(0, 30)}...` : opts.task
    )
    const status: SubagentStatus = {
      taskId,
      label: displayLabel,
      taskDescription: opts.task,
      startedAt: performance.now(),
      phase: 'initializing',
      iteration: 0,
      toolEvents: [],
      stopReason: null,
      error: null,
    }
    this._statuses.set(taskId, status)

    const origin = {
      channel: opts.originChannel,
      chatId: opts.originChatId,
      sessionKey: opts.sessionKey ?? `${opts.originChannel}:${opts.originChatId}`,
    }

    const runPromise = this._runSubagent(taskId, opts.task, displayLabel, origin, status, opts.temperature)
    this._running.set(taskId, runPromise)
    if (opts.sessionKey) {
      const set = this._sessionTasks.get(opts.sessionKey) ?? new Set()
      set.add(taskId)
      this._sessionTasks.set(opts.sessionKey, set)
    }

    void runPromise.finally(() => {
      this._running.delete(taskId)
      this._statuses.delete(taskId)
      if (opts.sessionKey) {
        const ids = this._sessionTasks.get(opts.sessionKey)
        ids?.delete(taskId)
        if (ids && ids.size === 0) this._sessionTasks.delete(opts.sessionKey)
      }
    })

    return `Subagent [${displayLabel}] started (id: ${taskId}). I'll notify you when it completes.`
  }

  private async _runSubagent(
    taskId: string,
    task: string,
    label: string,
    origin: { channel: string; chatId: string; sessionKey: string },
    status: SubagentStatus,
    temperature?: number,
  ): Promise<void> {
    // ── Langfuse Hook（子代理 LLM 调用追踪）──
    const langfuseHook =
      this._langfuseClient?.enabled
        ? new LangfuseAgentHook({
            client: this._langfuseClient,
            sessionKey: origin.sessionKey,
            workspace: this.workspace,
            model: this.model,
            temperature,
            userMessage: task,
          })
        : undefined

    const statusHook = new SubagentHook(status)
    const hook =
      langfuseHook
        ? new CompositeHook([statusHook, langfuseHook])
        : statusHook

    try {
      const tools = this._buildTools()
      const fileStates = new FileStates()
      const subagentSystem = this.templates.renderSubagentSystem({
        timeCtx: `Current time: ${new Date().toISOString()}`,
        workspace: this._projectRoot,
      })
      const context: Context = {
        system: subagentSystem,
        messages: [{ role: 'user', content: task }],
        metadata: {},
      }

      const result = await runWithFileStates(fileStates, () =>
        this.runner.run({
          context,
          tools,
          model: this.model,
          maxIterations: this.maxIterations,
          maxToolResultChars: this.maxToolResultChars,
          concurrentTools: true,
          workspace: this.workspace,
          sessionKey: origin.sessionKey,
          contextWindowTokens: 128_000,
          providerRetryMode: 'standard',
          temperature,
          hook,
          maxIterationsMessage: this.templates.renderMaxIterationsMessage(this.maxIterations),
        }),
      )

      // ── Langfuse Score 上报 ──
      if (langfuseHook && this._langfuseClient?.enabled) {
        const metrics = langfuseHook.getMetrics()
        const trace = langfuseHook.getTrace()
        if (trace?.traceId) {
          const toolEvents = result.toolEvents ?? []
          const succeeded = toolEvents.filter((e) => e.status === 'completed').length
          const total = toolEvents.length
          this._langfuseClient.createScore({
            traceId: trace.traceId,
            name: 'tool-success-rate',
            value: total > 0 ? succeeded / total : 1,
            dataType: 'NUMERIC',
            comment: `subagent: ${label}`,
          }).catch(() => {})
          this._langfuseClient.createScore({
            traceId: trace.traceId,
            name: 'iterations',
            value: metrics.iterations,
            dataType: 'NUMERIC',
            comment: `subagent: ${label}`,
          }).catch(() => {})
        }
        this._langfuseClient.flush().catch(() => {})
      }

      status.phase = 'done'
      status.stopReason = result.stopReason
      const text = result.finalContent?.trim()
        || 'Task completed but no final response was generated.'
      await this._announceResult(taskId, label, task, text, origin, 'ok')
    } catch (err: unknown) {
      // ── Langfuse 错误 Trace ──
      if (this._langfuseClient?.enabled) {
        this._langfuseClient.createErrorTrace({
          name: `subagent:${label}`,
          sessionId: origin.sessionKey,
          error: err instanceof Error ? err.message : String(err),
          metadata: { taskId, label },
        })
        this._langfuseClient.flush().catch(() => {})
      }

      status.phase = 'error'
      status.error = err instanceof Error ? err.message : String(err)
      await this._announceResult(
        taskId,
        label,
        task,
        `Error: ${status.error}`,
        origin,
        'error',
      )
    }
  }

  private async _announceResult(
    taskId: string,
    label: string,
    task: string,
    result: string,
    origin: { channel: string; chatId: string; sessionKey: string },
    status: 'ok' | 'error',
  ): Promise<void> {
    const statusText = status === 'ok' ? 'completed successfully' : 'failed'
    const content = this.templates.renderSubagentAnnounce({
      label,
      statusText,
      task,
      result,
    })

    const msg: InboundMessage = {
      channel: 'system',
      senderId: 'subagent',
      chatId: `${origin.channel}:${origin.chatId}`,
      content,
      timestamp: Date.now(),
      media: [],
      sessionKeyOverride: origin.sessionKey,
      metadata: {
        injected_event: 'subagent_result',
        subagent_task_id: taskId,
      },
    }
    this.bus.publishInbound(msg)
  }

  cancelBySession(sessionKey: string): number {
    const ids = this._sessionTasks.get(sessionKey)
    if (!ids) return 0
    let n = 0
    for (const id of ids) {
      if (this._running.has(id)) n += 1
    }
    return n
  }
}
