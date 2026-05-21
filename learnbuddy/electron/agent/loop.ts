/**
 * AgentLoop — 核心状态机引擎
 * 对应原版 learnbuddy/agent/loop.py
 */
import { nanoid } from "nanoid";
import { ContextBuilder } from "./context";
import { AgentRunner } from "./runner";
import { ToolRegistry } from "./tool-registry";
import { SessionManager } from "../session/session-manager";
import { Consolidator } from "./memory";
import { LLMProvider } from "../providers";
import { type Logger, logger, trace as newTrace } from "../utils/logger";
import type {
  InboundMessage,
  LLMMessage,
  OutboundMessage,
  SkillInfo,
  ToolEvent,
  TurnCompleteData,
} from "../../shared/types";
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
  onRetryWait?: (message: string) => void;
  onTurnComplete?: (data: TurnCompleteData) => void;
  onSystemMessage?: (text: string) => void;
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
  stopReason: string;
  outbound: OutboundMessage | null;
  startedAt: number;
  onToolProgress?: (ev: ToolEvent) => Promise<void>;
  onRetryWait?: (msg: string) => Promise<void>;
  onSystemMessage?: (text: string) => Promise<void>;
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

  // ═══ Bus 模式：后台消费循环（参考 learnbuddy/agent/loop.py run()） ═══
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
   * 参考 learnbuddy/agent/loop.py _dispatch()
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

    const cbs: StreamCallbacks = {
      onStreamDelta: (delta) => {
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
    };

    try {
      turnLog.step("process");
      const response = await this.process(msg, cbs);
      if (response) {
        response.metadata = { ...response.metadata, _streamed: true };
        await this.bus!.publishOutbound(response);
        turnLog.step("outbound").debug("response published", {
          len: response.content.length,
        });
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

  // ═══ process：直接调用模式（cron / heartbeat） ═══
  async process(
    msg: InboundMessage,
    cbs?: StreamCallbacks,
  ): Promise<OutboundMessage | null> {
    const key = msg.sessionKeyOverride ?? `${msg.channel}:${msg.chatId}`;

    const ctx: TurnCtx = {
      msg,
      sessionKey: key,
      state: State.RESTORE,
      turnId: nanoid(),
      finalContent: null,
      toolsUsed: [],
      allMessages: [],
      stopReason: "",
      outbound: null,
      startedAt: performance.now(),
    };

    // 绑定流式回调到 ctx
    if (cbs) {
      ctx.onToolProgress = async (ev) => cbs.onToolProgress?.(ev);
      ctx.onRetryWait = async (msg) => cbs.onRetryWait?.(msg);
      ctx.onSystemMessage = async (text) => cbs.onSystemMessage?.(text);
    }

    // 状态机循环
    const smLog = newTrace(`sm:${ctx.turnId.slice(0, 6)}`);
    while (ctx.state !== State.DONE) {
      const handler = `_state_${State[ctx.state].toLowerCase()}`;
      const fn =
        (this as any)[handler] as ((
          ctx: TurnCtx,
          cbs?: StreamCallbacks,
        ) => Promise<string>);
      if (!fn) throw new Error(`Missing handler: ${handler}`);
      const event = await fn.call(this, ctx, cbs);
      const next = TRANSITIONS[`${State[ctx.state]}:${event}`];
      if (!next) {
        throw new Error(`No transition from ${State[ctx.state]} on "${event}"`);
      }
      console.log(`==============================================State Machine=========================================`);
      smLog.step(State[next].toLowerCase()).transition(
        State[ctx.state].toLowerCase(),
        State[next].toLowerCase(),
        event,
      );
      ctx.state = next;
    }

    // turn_complete
    if (cbs?.onTurnComplete) {
      cbs.onTurnComplete({
        content: ctx.finalContent ?? "",
        toolsUsed: ctx.toolsUsed,
        usage: { inputTokens: 0, outputTokens: 0 },
        latencyMs: Math.round(performance.now() - ctx.startedAt),
      });
    }

    return ctx.outbound;
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
      ctx.onToolProgress?.({ name: "consolidator", status: "started" });
      ctx.onSystemMessage?.(`🔄 上下文压缩中（${archived} 条历史消息）...`);

      // 同步等待压缩完成，再回答用户
      const summary = await this.consolidator.compactIdleSession(
        ctx.sessionKey,
        keepRecent,
      );
      ctx.onToolProgress?.({ name: "consolidator", status: "completed" });
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
        await ctx.onSystemMessage?.(result.content);
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

    const result = await this.runner.run({
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
    });

    ctx.finalContent = result.finalContent;
    ctx.toolsUsed = result.toolsUsed;
    ctx.allMessages = result.messages;
    ctx.stopReason = result.stopReason;

    // 通知流结束
    cbs?.onStreamEnd?.(streamId, false);

    return "ok";
  }

  private async _state_save(ctx: TurnCtx): Promise<string> {
    if (ctx.finalContent && ctx.stopReason !== "empty_final_response") {
      this.sessions.addMessage(ctx.sessionKey, {
        role: "assistant",
        content: ctx.finalContent,
        timestamp: new Date().toISOString(),
      });
    }

    // 持久化 tool results
    for (const msg of ctx.allMessages) {
      if (msg.role === "tool") {
        this.sessions.addMessage(ctx.sessionKey, {
          role: "tool",
          content: typeof msg.content === "string"
            ? msg.content
            : JSON.stringify(msg.content),
          toolCallId: msg.toolCallId,
          name: msg.name,
          timestamp: new Date().toISOString(),
        });
      }
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
