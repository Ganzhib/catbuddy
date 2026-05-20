/**
 * AgentLoop — 核心状态机引擎
 * 对应原版 nanobot/agent/loop.py
 */
import { nanoid } from "nanoid";
import { ContextBuilder } from "./context";
import { AgentRunner } from "./runner";
import { ToolRegistry } from "./tool-registry";
import { SessionManager } from "../session/session-manager";
import { Consolidator } from "./memory";
import { LLMProvider } from "../providers";
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
  // 并发控制
  private _semaphore: { max: number; current: number; queue: (() => void)[] };

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

    this.commands = new CommandRouter();
    registerBuiltinCommands(this.commands);

    this._semaphore = { max: 3, current: 0, queue: [] };
  }

  // ═══ 公开属性 ═══
  get uptime() {
    return Math.floor((Date.now() - this._startTime) / 1000);
  }
  get activeSessionCount() {
    return this._activeTasks.size;
  }

  // ═══ 主入口 ═══
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
    const msg = ctx.msg;
    const preview = msg.content.slice(0, 80) +
      (msg.content.length > 80 ? "..." : "");
    process.stderr.write(`[state] RESTORE ${ctx.sessionKey} msgs=${preview}\n`);

    // 确保 session 存在
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
    process.stderr.write(`[state] COMMAND ${ctx.sessionKey} raw="${raw}"\n`);

    const cmdCtx: CommandContext = {
      msg: ctx.msg,
      sessionKey: ctx.sessionKey,
      raw,
      args: "",
      loop: this,
    };

    const result = await this.commands.dispatch(cmdCtx);
    process.stderr.write(`[state] COMMAND result=${result !== null ? result.content.slice(0, 40) : 'null'}\n`);

    if (result !== null) {
      ctx.outbound = result;
      if (result.content) {
        await ctx.onSystemMessage?.(result.content);
        process.stderr.write(`[state] COMMAND systemMessage sent\n`);
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
    return this.tools.toolNames.map((name) => ({
      name,
      description: this.tools.get(name)?.definition.function.description ?? "",
      enabled: true,
      isBuiltin: true,
    }));
  }

  toggleSkill(_name: string, _enabled: boolean) {
    // 后续实现
  }
}
