/**
 * AgentLoop — 核心状态机引擎
 * 对应原版 catbuddy/agent/loop.py
 */
import { nanoid } from "nanoid";
import { ContextBuilder } from "./context";
import { AgentRunner } from "./runner";
import { ToolRegistry } from "./tools";
import { SessionManager } from "../session/session-manager";
import { Consolidator } from "./memory";
import { LLMProvider } from "../providers";
import { type Logger, logger, trace as newTrace } from "../utils/logger";
import type {
  InboundMessage,
  LLMMessage,
  OutboundMessage,
  SkillInfo,
  FileEditEvent,
  ToolEvent,
  TurnCompleteData,
} from "@catbuddy/shared";
import {
  CommandRouter,
  type CommandContext,
  registerBuiltinCommands,
} from "../command";
import type { MessageBus } from "../bus";
import {
  applySkillToggle,
  listDiscoverableSkills,
} from "./skill";

// ══════════════════════════════
// 状态机
// ══════════════════════════════
enum State {
  RESTORE,
  COMPACT,
  COMMAND,
  BUILD,
  RUN,
  SAVE,
  RESPOND,
  DONE,
}

const TRANSITIONS: Record<string, State> = {
  "RESTORE:ok": State.COMPACT,
  "COMPACT:ok": State.COMMAND,
  "COMMAND:dispatch": State.BUILD,
  "COMMAND:shortcut": State.DONE,
  "BUILD:ok": State.RUN,
  "RUN:ok": State.SAVE,
  "SAVE:ok": State.RESPOND,
  "RESPOND:ok": State.DONE,
};

// ══════════════════════════════
// 流式回调
// ══════════════════════════════
export interface StreamCallbacks {
  onStreamDelta?: (delta: string, streamId: string) => void;
  onStreamEnd?: (streamId: string, resuming: boolean) => void;
  onReasoningDelta?: (content: string) => void;
  onReasoningEnd?: () => void;
  onToolProgress?: (event: ToolEvent) => void;
  onFileEdit?: (edit: FileEditEvent) => void;
  onRetryWait?: (message: string) => void;
  onTurnComplete?: (data: TurnCompleteData) => void;
  onSystemMessage?: (text: string) => void;
  /** 非流式完整回复（命令/无 delta 的 turn），走 assistant 气泡而非 progress */
  onAssistantMessage?: (text: string) => void;
}

// ══════════════════════════════
// Turn 上下文
// ══════════════════════════════
interface TurnCtx {
  msg: InboundMessage;
  sessionKey: string;
  state: State;
  turnId: string;
  finalContent: string | null;
  toolsUsed: string[];
  allMessages: LLMMessage[];
  /** Index into ``allMessages`` where this turn's new rows start (for SAVE). */
  persistFromIndex: number;
  stopReason: string;
  outbound: OutboundMessage | null;
  startedAt: number;
  onToolProgress?: (ev: ToolEvent) => Promise<void>;
  onFileEdit?: (edit: FileEditEvent) => Promise<void>;
  onRetryWait?: (msg: string) => Promise<void>;
  onSystemMessage?: (text: string) => Promise<void>;
  onAssistantMessage?: (text: string) => Promise<void>;
}

// ══════════════════════════════
// AgentLoop
// ══════════════════════════════
export class AgentLoop {
  readonly workspace: string;
  readonly sessions: SessionManager;
  readonly tools: ToolRegistry;
  readonly commands: CommandRouter;
  model: string;
  modelPresets: Record<string, string> = {};

  private provider: LLMProvider;
  private context: ContextBuilder;
  private runner: AgentRunner;
  readonly consolidator: Consolidator;
  private _running = false;
  private _startTime = Date.now();
  private maxIterations: number;
  private contextWindowTokens: number;
  private maxToolResultChars: number;
  private maxMessages: number;
  private providerRetryMode: "standard" | "persistent";
  private _activeTasks = new Map<string, AbortController[]>();

  readonly bus: MessageBus | null;

  constructor(opts: {
    provider: LLMProvider;
    workspace: string;
    model?: string;
    maxIterations?: number;
    contextWindowTokens?: number;
    maxToolResultChars?: number;
    maxMessages?: number;
    timezone?: string;
    disabledSkills?: string[];
    restrictToWorkspace?: boolean;
    consolidationRatio?: number;
    sessionManager?: SessionManager;
    bus?: MessageBus;
  }) {
    this.provider = opts.provider;
    this.workspace = opts.workspace;
    this.model = opts.model ?? opts.provider.defaultModel;
    this.maxIterations = opts.maxIterations ?? 50;
    this.contextWindowTokens = opts.contextWindowTokens ?? 128_000;
    this.maxToolResultChars = opts.maxToolResultChars ?? 8000;
    this.maxMessages = opts.maxMessages ?? 120;
    this.providerRetryMode = "standard";

    this.sessions = opts.sessionManager ?? new SessionManager(opts.workspace);
    this.context = new ContextBuilder(opts.workspace, {
      timezone: opts.timezone,
      disabledSkills: opts.disabledSkills,
    });
    // 首次运行时创建 workspace 引导文件
    this.context.ensureBootstrapFiles();
    this.tools = new ToolRegistry();
    this.tools.setWorkspace(opts.workspace, opts.restrictToWorkspace ?? false);
    this.tools.registerBuiltinTools();
    this.runner = new AgentRunner(opts.provider);

    this.consolidator = new Consolidator({
      provider: opts.provider,
      model: this.model,
      sessions: this.sessions,
      workspace: opts.workspace,
      contextWindowTokens: this.contextWindowTokens,
      consolidationRatio: opts.consolidationRatio ?? 0.5,
    });

    this.bus = opts.bus ?? null;

    this.commands = new CommandRouter();
    registerBuiltinCommands(this.commands);
  }

  // ═══ 公开属性 ═══
  get uptime() {
    return Math.floor((Date.now() - this._startTime) / 1000);
  }
  get activeSessionCount() {
    return this._activeTasks.size;
  }

  // ═══ Bus 模式：后台消费循环（参考 catbuddy/agent/loop.py run()） ═══
  async run(): Promise<void> {
    if (!this.bus) throw new Error("AgentLoop.run() requires a MessageBus");
    this._running = true;
    logger.init("agent").info("Bus-driven loop started");
    while (this._running) {
      const msg = await this.bus.consumeInbound();
      if (!msg) continue;

      const raw = msg.content.trim();
      const traceId = `turn:${nanoid(8)}`;
      const log = newTrace(traceId).step("inbound");

      // Priority 命令在锁外处理（/stop 必须立即响应）
      if (this.commands.isPriority(raw)) {
        // log.step("priority_cmd");
        const cmdCtx: CommandContext = {
          msg, sessionKey: msg.sessionKeyOverride ?? `${msg.channel}:${msg.chatId}`,
          raw, args: "", loop: this,
        };
        const result = await this.commands.dispatchPriority(cmdCtx);
        if (result) await this.bus.publishOutbound(result);
        continue;
      }

      // 普通消息 → _dispatch (per-session lock + stream → bus.outbound)
      // 传递 trace logger，让 _dispatch 复用同一个 turn id
      this._dispatch(msg, log).catch((err) =>
        console.error("[agent] _dispatch crashed:", err),
      );
    }
  }

  /**
   * _dispatch — 处理单条消息。
   * 参考 catbuddy/agent/loop.py _dispatch()
   * stream callback 直接发布到 bus.outbound（而不是 IPC），由 ChannelManager 路由。
   */
  private async _dispatch(msg: InboundMessage, log?: Logger): Promise<void> {
    const key = msg.sessionKeyOverride ?? `${msg.channel}:${msg.chatId}`;
    const turnLog = (log ?? newTrace(`turn:${nanoid(8)}`)).step("dispatch");
    const turnStartedAt = performance.now();
    const streamBase = `${key}:${Date.now()}`;
    let segment = 0;
    const streamId = (): string => `${streamBase}:${segment}`;

    let streamChunks = 0;
    /** 本 turn 是否已通过 delta 推送过正文（跨 stream segment 累计，不在 segment 结束时清零） */
    let hadStreamedContent = false;

    const cbs: StreamCallbacks = {
      onStreamDelta: (delta) => {
        hadStreamedContent = true;
        streamChunks++;
        this.bus!.publishOutbound({
          channel: msg.channel, chatId: msg.chatId,
          content: delta, media: [], buttons: [],
          metadata: { _stream_delta: true, _stream_id: streamId() },
        });
      },
      onStreamEnd: () => {
        turnLog.debug(`stream segment ended`, { chunks: streamChunks });
        this.bus!.publishOutbound({
          channel: msg.channel, chatId: msg.chatId,
          content: "", media: [], buttons: [],
          metadata: { _stream_end: true, _stream_id: streamId() },
        });
        segment++;
        streamChunks = 0;
      },
      onReasoningDelta: (content) => {
        this.bus!.publishOutbound({
          channel: msg.channel, chatId: msg.chatId,
          content, media: [], buttons: [],
          metadata: { _reasoning_delta: true },
        });
      },
      onReasoningEnd: () => {
        this.bus!.publishOutbound({
          channel: msg.channel, chatId: msg.chatId,
          content: "", media: [], buttons: [],
          metadata: { _reasoning_end: true },
        });
      },
      onToolProgress: (ev) => {
        this.bus!.publishOutbound({
          channel: msg.channel, chatId: msg.chatId,
          content: "",
          media: [], buttons: [],
          metadata: { _tool_progress: true, _tool_event: ev },
        });
      },
      onFileEdit: (edit) => {
        this.bus!.publishOutbound({
          channel: msg.channel, chatId: msg.chatId,
          content: "",
          media: [], buttons: [],
          metadata: { _file_edit: true, _file_edit_event: edit },
        });
      },
      onTurnComplete: (data) => {
        this.bus!.publishOutbound({
          channel: msg.channel, chatId: msg.chatId,
          content: "",
          media: [], buttons: [],
          metadata: { _turn_complete: true, _turn_data: data },
        });
      },
      onSystemMessage: (text) => {
        this.bus!.publishOutbound({
          channel: msg.channel, chatId: msg.chatId,
          content: text, media: [], buttons: [],
          metadata: { _progress: true },
        });
      },
      onAssistantMessage: (text) => {
        this.bus!.publishOutbound({
          channel: msg.channel, chatId: msg.chatId,
          content: text, media: [], buttons: [],
          metadata: { _assistant_complete: true },
        });
      },
      onRetryWait: (message) => {
        this.bus!.publishOutbound({
          channel: msg.channel, chatId: msg.chatId,
          content: message, media: [], buttons: [],
          metadata: { _progress: true },
        });
      },
    };

    try {
      turnLog.step("process");
      const response = await this.process(msg, cbs);
      if (response?.content?.trim()) {
        if (hadStreamedContent) {
          turnLog.debug("skip duplicate outbound (already streamed)");
        } else {
          await this.bus!.publishOutbound({
            ...response,
            metadata: { ...response.metadata, _assistant_complete: true },
          });
          turnLog.step("outbound").debug("assistant complete published", {
            len: response.content.length,
          });
        }
      } else {
        turnLog.debug("no response");
      }
      turnLog.end("turn completed");
    } catch (err: unknown) {
      const detail = err instanceof Error ? err.message : String(err);
      turnLog.error("dispatch error", err);
      console.error("[agent] dispatch error:", detail);

      const errorText = detail
        ? `Sorry, I encountered an error: ${detail}`
        : "Sorry, I encountered an error.";

      const sid = streamId();
      try {
        cbs.onStreamDelta?.(errorText, sid);
        cbs.onStreamEnd?.(sid, false);
        cbs.onTurnComplete?.({
          content: errorText,
          toolsUsed: [],
          usage: { inputTokens: 0, outputTokens: 0 },
          latencyMs: Math.round(performance.now() - turnStartedAt),
        });
      } catch (notifyErr) {
        console.error("[agent] failed to notify UI of error:", notifyErr);
        this.bus!.publishOutbound({
          channel: msg.channel, chatId: msg.chatId,
          content: errorText,
          media: [], buttons: [],
          metadata: { _turn_complete: true, _turn_data: {
            content: errorText,
            toolsUsed: [],
            usage: { inputTokens: 0, outputTokens: 0 },
            latencyMs: 0,
          }},
        });
      }
    }
  }

  // ═══ process：直接调用（cron / heartbeat / bus 内 _dispatch） ═══
  async process(
    msg: InboundMessage,
    streamCallbacks?: StreamCallbacks,
  ): Promise<OutboundMessage | null> {
    const sessionKey =
      msg.sessionKeyOverride ?? `${msg.channel}:${msg.chatId}`;

    const turn: TurnCtx = {
      msg,
      sessionKey,
      state: State.RESTORE,
      turnId: nanoid(),
      finalContent: null,
      toolsUsed: [],
      allMessages: [],
      persistFromIndex: 0,
      stopReason: "",
      outbound: null,
      startedAt: performance.now(),
    };

    if (streamCallbacks) {
      turn.onToolProgress = async (event) =>
        streamCallbacks.onToolProgress?.(event);
      turn.onFileEdit = async (edit) =>
        streamCallbacks.onFileEdit?.(edit);
      turn.onRetryWait = async (message) =>
        streamCallbacks.onRetryWait?.(message);
      turn.onSystemMessage = async (text) =>
        streamCallbacks.onSystemMessage?.(text);
      turn.onAssistantMessage = async (text) =>
        streamCallbacks.onAssistantMessage?.(text);
    }

    const trace = newTrace(`sm:${turn.turnId.slice(0, 6)}`);

    while (turn.state !== State.DONE) {
      const fromState = turn.state;
      let event: string;

      switch (fromState) {
        case State.RESTORE:
          event = await this._state_restore(turn);
          break;
        case State.COMPACT:
          event = await this._state_compact(turn);
          break;
        case State.COMMAND:
          event = await this._state_command(turn);
          break;
        case State.BUILD:
          event = await this._state_build(turn);
          break;
        case State.RUN:
          event = await this._state_run(turn, streamCallbacks);
          break;
        case State.SAVE:
          event = await this._state_save(turn);
          break;
        case State.RESPOND:
          event = await this._state_respond(turn);
          break;
        default:
          throw new Error(`Unhandled turn state: ${State[fromState]}`);
      }

      const transitionKey = `${State[fromState]}:${event}`;
      const toState = TRANSITIONS[transitionKey];
      if (toState === undefined) {
        throw new Error(
          `Invalid transition: ${State[fromState]} --[${event}]--> (not in TRANSITIONS)`,
        );
      }

      trace
        .step(State[toState].toLowerCase())
        .transition(
          State[fromState].toLowerCase(),
          State[toState].toLowerCase(),
          event,
        );

      turn.state = toState;
    }

    streamCallbacks?.onTurnComplete?.({
      content: turn.finalContent ?? "",
      toolsUsed: turn.toolsUsed,
      usage: { inputTokens: 0, outputTokens: 0 },
      latencyMs: Math.round(performance.now() - turn.startedAt),
    });

    return turn.outbound;
  }

  // ═══ 状态处理器 ═══

  private async _state_restore(ctx: TurnCtx): Promise<string> {
    this.sessions.getOrCreate(ctx.sessionKey);
    return "ok";
  }

  private async _state_compact(ctx: TurnCtx): Promise<string> {
    const allMessages = this.sessions.getHistory(ctx.sessionKey, {
      maxMessages: 9999,
    });

    const compactCfg = (this as any)._compactConfig;
    const enabled = compactCfg?.enabled !== false;
    const threshold = compactCfg?.threshold || 50;

    if (enabled && allMessages.length >= threshold) {
      const keepRecent = Math.max(2, Math.floor(threshold / 2));
      const archived = allMessages.length - keepRecent;
      ctx.onToolProgress?.({
        name: "consolidator",
        status: "started",
        callId: "consolidator",
      });
      ctx.onSystemMessage?.(`🔄 上下文压缩中（${archived} 条历史消息）...`);

      // 同步等待压缩完成，再回答用户
      const summary = await this.consolidator.compactIdleSession(
        ctx.sessionKey,
        keepRecent,
      );
      ctx.onToolProgress?.({
        name: "consolidator",
        status: "completed",
        callId: "consolidator",
      });
      ctx.onSystemMessage?.(
        summary
          ? `✅ 已压缩 ${archived} 条历史消息\n> ${summary.slice(0, 120)}${
            summary.length > 120 ? "..." : ""
          }`
          : `✅ 已压缩 ${archived} 条消息`,
      );
    }
    return "ok";
  }

  /** 从 config update 同步压缩配置 */
  setCompactConfig(cfg: { enabled: boolean; threshold: number }) {
    (this as any)._compactConfig = cfg;
  }

  private async _state_command(ctx: TurnCtx): Promise<string> {
    const raw = ctx.msg.content.trim();

    const cmdCtx: CommandContext = {
      msg: ctx.msg,
      sessionKey: ctx.sessionKey,
      raw,
      args: "",
      loop: this,
    };

    const result = await this.commands.dispatch(cmdCtx);

    if (result !== null) {
      ctx.outbound = result;
      if (result.content) {
        await ctx.onAssistantMessage?.(result.content);
      }
      return "shortcut";
    }

    return "dispatch";
  }

  private async _state_build(ctx: TurnCtx): Promise<string> {
    const history = this.sessions.getHistory(ctx.sessionKey, {
      maxMessages: this.maxMessages,
    });

    // 提取归档摘要（由 Consolidator 写入 session metadata）
    const session = this.sessions.getOrCreate(ctx.sessionKey);
    let sessionSummary: string | null = null;
    const lastSummary = session.metadata?._last_summary as {
      text?: string;
      last_active?: string;
    } | undefined;
    if (lastSummary?.text) {
      sessionSummary = `Previous conversation summary (last active ${
        lastSummary.last_active ?? "unknown"
      }):\n${lastSummary.text}`;
    }

    ctx.allMessages = this.context.buildMessages({
      history,
      currentMessage: ctx.msg.content,
      media: ctx.msg.media,
      channel: ctx.msg.channel,
      chatId: ctx.msg.chatId,
      senderId: ctx.msg.senderId,
      sessionSummary,
    });

    return "ok";
  }

  private async _state_run(
    ctx: TurnCtx,
    cbs?: StreamCallbacks,
  ): Promise<string> {
    // 持久化用户消息
    this.sessions.addMessage(ctx.sessionKey, {
      role: "user",
      content: ctx.msg.content,
      media: ctx.msg.media,
      timestamp: new Date().toISOString(),
    });

    const streamId = `${ctx.sessionKey}:${Date.now()}`;

    this.tools.setFileEditCallback(
      cbs?.onFileEdit
        ? async (edit) => { await cbs.onFileEdit!(edit) }
        : undefined,
    );
    const persistFromIndex = ctx.allMessages.length
    let result;
    try {
      result = await this.runner.run({
        initialMessages: ctx.allMessages,
        tools: this.tools,
        model: this.model,
        maxIterations: this.maxIterations,
        maxToolResultChars: this.maxToolResultChars,
        concurrentTools: true,
        workspace: this.workspace,
        sessionKey: ctx.sessionKey,
        contextWindowTokens: this.contextWindowTokens,
        providerRetryMode: this.providerRetryMode,
        progressCallback: async (ev) => cbs?.onToolProgress?.(ev),
        retryWaitCallback: async (msg) => cbs?.onRetryWait?.(msg),
        onStream: async (delta) => cbs?.onStreamDelta?.(delta, streamId),
        onReasoning: async (delta) => cbs?.onReasoningDelta?.(delta),
      });
    } finally {
      this.tools.setFileEditCallback(undefined);
    }

    ctx.finalContent = result.finalContent;
    ctx.toolsUsed = result.toolsUsed;
    ctx.allMessages = result.messages;
    ctx.persistFromIndex = persistFromIndex;
    ctx.stopReason = result.stopReason;

    // 通知流结束
    cbs?.onStreamEnd?.(streamId, false);

    return "ok";
  }

  private async _state_save(ctx: TurnCtx): Promise<string> {
    const now = new Date().toISOString()

    for (const msg of ctx.allMessages.slice(ctx.persistFromIndex)) {
      if (msg.role === "assistant" && msg.toolCalls?.length) {
        this.sessions.addMessage(ctx.sessionKey, {
          role: "assistant",
          content: typeof msg.content === "string" ? msg.content : "",
          toolCalls: msg.toolCalls,
          reasoningContent: msg.reasoningContent ?? "",
          timestamp: now,
        });
      }
      if (msg.role === "tool") {
        this.sessions.addMessage(ctx.sessionKey, {
          role: "tool",
          content: typeof msg.content === "string"
            ? msg.content
            : JSON.stringify(msg.content),
          toolCallId: msg.toolCallId,
          name: msg.name,
          timestamp: now,
        });
      }
    }

    if (ctx.finalContent && ctx.stopReason !== "empty_final_response") {
      this.sessions.addMessage(ctx.sessionKey, {
        role: "assistant",
        content: ctx.finalContent,
        timestamp: now,
      });
    }

    return "ok";
  }

  private async _state_respond(ctx: TurnCtx): Promise<string> {
    const content = ctx.finalContent ?? "";
    ctx.outbound = {
      channel: ctx.msg.channel,
      chatId: ctx.msg.chatId,
      content,
      media: [],
      metadata: {},
      buttons: [],
    };
    return "ok";
  }

  // ═══ 命令 ═══

  async cancelSession(sessionKey: string): Promise<number> {
    const controllers = this._activeTasks.get(sessionKey);
    if (!controllers) return 0;
    let cancelled = 0;
    for (const ctrl of controllers) {
      if (!ctrl.signal.aborted) {
        ctrl.abort();
        cancelled++;
      }
    }
    this._activeTasks.delete(sessionKey);
    return cancelled;
  }

  setModelPreset(name: string) {
    console.log(`Model preset set to: ${name}`);
  }

  setModel(model: string) {
    console.log(`[agent] Model switched: ${this.model} → ${model}`);
    this.model = model;
    this.runner = new AgentRunner(this.provider);
    this.consolidator.setProvider(
      this.provider,
      model,
      this.contextWindowTokens,
    );
  }

  setProvider(provider: LLMProvider) {
    console.log(`[agent] Provider reloaded`);
    this.provider = provider;
    this.runner = new AgentRunner(provider);
    this.consolidator.setProvider(
      provider,
      this.model,
      this.contextWindowTokens,
    );
  }

  listSkills(): SkillInfo[] {
    return listDiscoverableSkills(
      this.workspace,
      this.context.disabledSkills,
    );
  }

  /** Returns updated disabled skill names (persist by caller). */
  toggleSkill(name: string, enabled: boolean): string[] {
    const next = applySkillToggle(this.context.disabledSkills, name, enabled);
    this.context.setDisabledSkills(next);
    return next;
  }

  setDisabledSkills(names: string[]): void {
    this.context.setDisabledSkills(names);
  }
}
