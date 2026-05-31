/**
 * AgentLoop — 核心状态机引擎
 * 对应原版 catbuddy/agent/loop.py
 */
import { nanoid } from "nanoid";
import * as path from "node:path";
import { ContextBuilder, type Context } from "./context";
import { AgentRunner } from "./runner";
import { ToolRegistry } from "./tools";
import { SessionManager } from "../session/session-manager";
import { Consolidator } from "./memory";
import { LayeredMemoryStore } from "./layered-memory.js";
import { Dream } from "./dream";
import { getGlobalProfileWorkspace } from "../services/global-profile.js";
import { AutoCompact } from "./autocompact";
import { SubagentManager } from "./subagent";
import {
  buildProviderSnapshot,
  configuredModelPresets,
  normalizePresetName,
  type ProviderSnapshot,
} from "./model_presets";
import { FileStateStore, runWithFileStates } from "./tools/file_state";
import { createMyTool } from "./tools/self";
import { createSpawnTool, type SpawnContext } from "./tools/spawn";
import { McpManager } from "./tools/mcp";
import {
  isHeartbeatMessage,
  shouldSuppressHeartbeatOutbound,
} from "../heartbeat/prompt.js";
import {
  runHeartbeatOnce,
  type HeartbeatRunResult,
} from "../heartbeat/index.js";
import type { RuntimeState } from "./tools/runtime_state";
import { LLMProvider } from "../providers";
import type { catbuddyConfig, TokenUsage } from "@catbuddy/shared";
import { type Logger, logger, trace as newTrace } from "../utils/logger";
import type {
  InboundMessage,
  LLMMessage,
  OutboundMessage,
  SkillInfo,
  FileEditEvent,
  DiagramUiEvent,
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
  onDiagramEvent?: (event: DiagramUiEvent) => void;
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
  context: Context | null;
  usage: TokenUsage | null;
  allMessages: LLMMessage[];
  /** Index into ``allMessages`` where this turn's new rows start (for SAVE). */
  persistFromIndex: number;
  stopReason: string;
  outbound: OutboundMessage | null;
  startedAt: number;
  onToolProgress?: (ev: ToolEvent) => Promise<void>;
  onFileEdit?: (edit: FileEditEvent) => Promise<void>;
  onDiagramEvent?: (event: DiagramUiEvent) => Promise<void>;
  onRetryWait?: (msg: string) => Promise<void>;
  onSystemMessage?: (text: string) => Promise<void>;
  onAssistantMessage?: (text: string) => Promise<void>;
}

// ══════════════════════════════
// AgentLoop
// ══════════════════════════════
export class AgentLoop implements RuntimeState {
  readonly workspace: string;
  readonly projectRoot!: string;
  readonly catbuddyDir!: string;
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
  maxIterations: number;
  contextWindowTokens: number;
  maxToolResultChars: number;
  private maxMessages: number;
  providerRetryMode: "standard" | "persistent";
  private _activeTasks = new Map<string, AbortController[]>();

  readonly bus: MessageBus | null;
  readonly fileStateStore = new FileStateStore();
  private readonly _sessionManagersByKey = new Map<string, SessionManager>();
  memoryStore: LayeredMemoryStore | null = null;
  dream: Dream | null = null;
  autoCompact: AutoCompact | null = null;
  subagents: SubagentManager | null = null;
  mcpManager: McpManager | null = null;

  private _config: catbuddyConfig | null = null;
  private _providerSnapshot: ProviderSnapshot | null = null;
  modelPreset: string | null = null;
  currentIteration = 0;
  private readonly _runtimeVars: Record<string, unknown> = {};
  private _lastUsage: TokenUsage | null = null;
  private _spawnContext: SpawnContext = {
    originChannel: "desktop",
    originChatId: "main",
    sessionKey: "desktop:main",
  };

  constructor(opts: {
    provider: LLMProvider;
    workspace: string;
    projectRoot?: string;
    catbuddyDir?: string;
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
    config?: catbuddyConfig;
    sessionTtlMinutes?: number;
  }) {
    this.provider = opts.provider;
    this.workspace = opts.workspace;
    const projectRoot =
      opts.projectRoot ?? path.resolve(opts.workspace);
    const catbuddyDir =
      opts.catbuddyDir ?? path.join(projectRoot, ".catbuddy");
    const restrict = opts.restrictToWorkspace ?? false;
    const projectWorkspace = restrict ? opts.workspace : catbuddyDir;
    (this as { projectRoot: string }).projectRoot = projectRoot;
    (this as { catbuddyDir: string }).catbuddyDir = catbuddyDir;
    this.model = opts.model ?? opts.provider.defaultModel;
    this.maxIterations = opts.maxIterations ?? 50;
    this.contextWindowTokens = opts.contextWindowTokens ?? 128_000;
    this.maxToolResultChars = opts.maxToolResultChars ?? 8000;
    this.maxMessages = opts.maxMessages ?? 120;
    this.providerRetryMode = "standard";

    this.sessions = opts.sessionManager ?? new SessionManager(opts.workspace);
    const globalWorkspace = getGlobalProfileWorkspace();
    this.context = new ContextBuilder(projectWorkspace, {
      timezone: opts.timezone,
      disabledSkills: opts.disabledSkills,
      workRoot: restrict ? projectWorkspace : projectRoot,
      fileAccessMode: restrict ? 'internal' : 'project',
      globalWorkspace,
    });
    // 首次运行时创建 workspace 引导文件
    this.context.ensureBootstrapFiles();
    this.tools = new ToolRegistry();
    this.tools.setWorkspace(projectWorkspace, restrict);
    this.tools.setProjectRoot(projectRoot, catbuddyDir);
    this.tools.registerBuiltinTools();
    this.runner = new AgentRunner(opts.provider);

    this.consolidator = new Consolidator({
      provider: opts.provider,
      model: this.model,
      sessions: this.sessions,
      workspace: projectWorkspace,
      globalWorkspace,
      contextWindowTokens: this.contextWindowTokens,
      consolidationRatio: opts.consolidationRatio ?? 0.5,
      templates: this.context.templateLoader,
    });

    if (opts.config) {
      this._config = opts.config;
      this.memoryStore = new LayeredMemoryStore(projectWorkspace, globalWorkspace);
      this.autoCompact = new AutoCompact(
        this.sessions,
        this.consolidator,
        opts.sessionTtlMinutes ?? 0,
      );
      this.dream = new Dream(this.memoryStore, opts.provider, this.model, this.context.templateLoader);
      if (opts.bus) {
        this.subagents = new SubagentManager(
          opts.provider,
          projectWorkspace,
          opts.bus,
          this.model,
          this.maxToolResultChars,
          this.maxIterations,
          restrict,
          this.context.templateLoader,
          projectRoot,
          catbuddyDir,
        );
      }
      this.mcpManager = new McpManager(opts.config.tools?.mcpServers);
      const allowSet = opts.config.tools?.my?.allowSet ?? false;
      this.tools.register(createMyTool(this, { modifyAllowed: allowSet }));
      if (this.subagents) {
        this.tools.register(
          createSpawnTool(this.subagents, () => this._spawnContext),
        );
      }
      this._refreshProviderSnapshot();
    }

    this.bus = opts.bus ?? null;

    this.commands = new CommandRouter();
    registerBuiltinCommands(this.commands);
  }

  /** Switch the folder the agent operates on; app config/session/channel remain stable. */
  reanchorProject(opts: {
    workspace: string;
    projectRoot: string;
    catbuddyDir: string;
    restrictToWorkspace?: boolean;
  }): void {
    const workspace = path.resolve(opts.workspace);
    const projectRoot = path.resolve(opts.projectRoot);
    const catbuddyDir = path.resolve(opts.catbuddyDir);
    const restrict = opts.restrictToWorkspace ?? false;
    const projectWorkspace = restrict ? path.join(catbuddyDir, "workspace") : catbuddyDir;

    (this as { workspace: string }).workspace = workspace;
    (this as { projectRoot: string }).projectRoot = projectRoot;
    (this as { catbuddyDir: string }).catbuddyDir = catbuddyDir;

    const globalWorkspace = getGlobalProfileWorkspace();
    this.context = new ContextBuilder(projectWorkspace, {
      timezone: this._config?.agents?.defaults?.timezone,
      disabledSkills: this._config?.agents?.defaults?.disabledSkills,
      workRoot: restrict ? projectWorkspace : projectRoot,
      fileAccessMode: restrict ? 'internal' : 'project',
      globalWorkspace,
    });
    this.context.ensureBootstrapFiles();

    this.tools.setWorkspace(projectWorkspace, restrict);
    this.tools.setProjectRoot(projectRoot, catbuddyDir);

    this.subagents?.setWorkArea({
      workspace: projectWorkspace,
      projectRoot,
      catbuddyDir,
      restrictToWorkspace: restrict,
    });

    this.memoryStore = new LayeredMemoryStore(projectWorkspace, globalWorkspace);
    if (this.provider) {
      this.dream = new Dream(this.memoryStore, this.provider, this.model, this.context.templateLoader);
    }

    (this as { consolidator: Consolidator }).consolidator = new Consolidator({
      provider: this.provider,
      model: this.model,
      sessions: this.sessions,
      workspace: projectWorkspace,
      globalWorkspace,
      contextWindowTokens: this.contextWindowTokens,
      consolidationRatio: this._config?.agents?.defaults?.consolidationRatio ?? 0.5,
      templates: this.context.templateLoader,
    });

    if (this.autoCompact) {
      const ttl = this._config?.agents?.defaults?.sessionTtlMinutes ?? 0;
      this.autoCompact = new AutoCompact(this.sessions, this.consolidator, ttl);
    }
  }

  /** Connect MCP servers from config (call after construction). */
  async connectMcp(): Promise<void> {
    if (!this.mcpManager) return;
    const names = await this.mcpManager.registerTools(this.tools);
    console.info(
      "[McpManager] tools:",
      names.filter((n) => n.startsWith("mcp_")).join(", ") || "(none)",
    );
  }

  /** Update MCP server config, persist, and reconnect without restart. */
  async setMcpServers(
    servers: Record<string, import("@catbuddy/shared").McpServerConfig> | undefined,
  ): Promise<string> {
    if (!this.mcpManager) return "MCP manager not initialized";
    if (this._config) {
      if (!this._config.tools) {
        this._config.tools = {
          restrictToWorkspace: false,
          exec: { enable: true },
          web: { enable: true },
          my: { enable: false, allowSet: false },
          imageGeneration: { enable: false },
        };
      }
      this._config.tools.mcpServers = servers;
    }
    this.mcpManager.updateServers(servers);
    return this.mcpManager.reload(this.tools);
  }

  getMcpServerStatus() {
    return this.mcpManager?.getServerStatus() ?? [];
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
      this.autoCompact?.checkExpired(
        (task) => { void task(); },
        [...this._activeTasks.keys()],
      );
      const turnLog = (log ?? newTrace(`turn:${nanoid(8)}`)).step("dispatch");
    const turnStartedAt = performance.now();
    const streamBase = `${key}:${Date.now()}`;
    let segment = 0;
    const streamId = (): string => `${streamBase}:${segment}`;

    let streamChunks = 0;
    /** 本 turn 是否已通过 delta 推送过正文（跨 stream segment 累计，不在 segment 结束时清零） */
    let hadStreamedContent = false;

    const heartbeatTurn = isHeartbeatMessage(msg);
    const cbs: StreamCallbacks = heartbeatTurn ? {} : {
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
      onDiagramEvent: (event) => {
        this.bus!.publishOutbound({
          channel: msg.channel, chatId: msg.chatId,
          content: "",
          media: [], buttons: [],
          metadata: { _diagram_event: true, _diagram_event_data: event },
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
      if (
        heartbeatTurn &&
        shouldSuppressHeartbeatOutbound(response?.content)
      ) {
        turnLog.debug("heartbeat suppressed (nothing to notify)");
        return;
      }
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

  bindSessionManager(sessionKey: string, manager: SessionManager): void {
    this._sessionManagersByKey.set(sessionKey, manager);
  }

  private sessionManagerFor(sessionKey: string): SessionManager {
    return this._sessionManagersByKey.get(sessionKey) ?? this.sessions;
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
      context: null,
      usage: null,
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
      turn.onDiagramEvent = async (event) =>
        streamCallbacks.onDiagramEvent?.(event);
      turn.onRetryWait = async (message) =>
        streamCallbacks.onRetryWait?.(message);
      turn.onSystemMessage = async (text) =>
        streamCallbacks.onSystemMessage?.(text);
      turn.onAssistantMessage = async (text) =>
        streamCallbacks.onAssistantMessage?.(text);
    }

    const trace = newTrace(`sm:${turn.turnId.slice(0, 6)}`);

    this._lastUsage = null;

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

    const suppressComplete =
      isHeartbeatMessage(turn.msg) &&
      shouldSuppressHeartbeatOutbound(turn.finalContent);
    if (!suppressComplete) {
      const usage =
        turn.usage
        ?? this._lastUsage
        ?? { inputTokens: 0, outputTokens: 0 };
      streamCallbacks?.onTurnComplete?.({
        content: turn.finalContent ?? "",
        toolsUsed: turn.toolsUsed,
        usage,
        latencyMs: Math.round(performance.now() - turn.startedAt),
      });
    }

    return turn.outbound;
  }

  // ═══ 状态处理器 ═══

  private async _state_restore(ctx: TurnCtx): Promise<string> {
    this.sessionManagerFor(ctx.sessionKey).getOrCreate(ctx.sessionKey);
    return "ok";
  }

  private async _state_compact(ctx: TurnCtx): Promise<string> {
    if (isHeartbeatMessage(ctx.msg)) return "ok";

    const sessionManager = this.sessionManagerFor(ctx.sessionKey);
    const allMessages = sessionManager.getHistory(ctx.sessionKey, {
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
      return "shortcut";
    }

    return "dispatch";
  }

  private async _state_build(ctx: TurnCtx): Promise<string> {
    const sessionManager = this.sessionManagerFor(ctx.sessionKey);
    const history = sessionManager.getHistory(ctx.sessionKey, {
      maxMessages: this.maxMessages,
    });

    const session = sessionManager.getOrCreate(ctx.sessionKey);
    let sessionSummary: string | null =
      this.autoCompact?.prepareSession(ctx.sessionKey).summary ?? null;
    const lastSummary = session.metadata?._last_summary as {
      text?: string;
      last_active?: string;
    } | undefined;
    if (!sessionSummary && lastSummary?.text) {
      sessionSummary = `Previous conversation summary (last active ${
        lastSummary.last_active ?? "unknown"
      }):\n${lastSummary.text}`;
    }

    ctx.context = this.context.build({
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
    const sessionManager = this.sessionManagerFor(ctx.sessionKey);
    if (!isHeartbeatMessage(ctx.msg)) {
      sessionManager.addMessage(ctx.sessionKey, {
        role: "user",
        content: ctx.msg.content,
        media: ctx.msg.media,
        timestamp: new Date().toISOString(),
      });
    }

    const streamId = `${ctx.sessionKey}:${Date.now()}`;

    this._spawnContext = {
      originChannel: ctx.msg.channel,
      originChatId: ctx.msg.chatId,
      sessionKey: ctx.sessionKey,
    };
    this.tools.setFileEditCallback(
      cbs?.onFileEdit
        ? async (edit) => { await cbs.onFileEdit!(edit) }
        : undefined,
    );
    this.tools.setDiagramEventCallback(
      cbs?.onDiagramEvent
        ? async (event) => { await cbs.onDiagramEvent!(event) }
        : undefined,
    );
    if (!ctx.context) {
      throw new Error("RUN called without BUILD context");
    }
    const persistFromIndex =
      (ctx.context.system ? 1 : 0) + ctx.context.messages.length;
    const fileStates = this.fileStateStore.forSession(ctx.sessionKey);
    let result;
    try {
      result = await runWithFileStates(fileStates, async () => {
        this.currentIteration = 0;
        return this.runner.run({
          context: ctx.context!,
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
          maxIterationsMessage: this.context.templateLoader.renderMaxIterationsMessage(this.maxIterations),
        });
      });
    } finally {
      this.tools.setFileEditCallback(undefined);
      this.tools.setDiagramEventCallback(undefined);
    }

    ctx.finalContent = result.finalContent;
    ctx.toolsUsed = result.toolsUsed;
    ctx.allMessages = result.messages;
    ctx.usage = result.usage;
    ctx.persistFromIndex = persistFromIndex;
    ctx.stopReason = result.stopReason;
    this._lastUsage = result.usage;

    // 通知流结束
    cbs?.onStreamEnd?.(streamId, false);

    return "ok";
  }

  private async _state_save(ctx: TurnCtx): Promise<string> {
    if (isHeartbeatMessage(ctx.msg)) return "ok";

    const now = new Date().toISOString()
    const sessionManager = this.sessionManagerFor(ctx.sessionKey);

    for (const msg of ctx.allMessages.slice(ctx.persistFromIndex)) {
      if (msg.role === "assistant" && msg.toolCalls?.length) {
        sessionManager.addMessage(ctx.sessionKey, {
          role: "assistant",
          content: typeof msg.content === "string" ? msg.content : "",
          toolCalls: msg.toolCalls,
          reasoningContent: msg.reasoningContent ?? "",
          timestamp: now,
        });
      }
      if (msg.role === "tool") {
        sessionManager.addMessage(ctx.sessionKey, {
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
      sessionManager.addMessage(ctx.sessionKey, {
        role: "assistant",
        content: ctx.finalContent,
        timestamp: now,
      });
    }

    this._appendTurnHistory(ctx);

    return "ok";
  }

  /** Feed Dream: append completed turn to project history.jsonl. */
  private _appendTurnHistory(ctx: TurnCtx): void {
    if (!this.memoryStore) return;
    const slice = ctx.allMessages.slice(ctx.persistFromIndex);
    const lines: string[] = [];
    for (const msg of slice) {
      if (msg.role !== "user" && msg.role !== "assistant") continue;
      const text =
        typeof msg.content === "string"
          ? msg.content
          : JSON.stringify(msg.content);
      if (!text.trim()) continue;
      lines.push(`[${msg.role}] ${text.slice(0, 2000)}`);
    }
    if (lines.length === 0) return;
    this.memoryStore.project.appendHistory(lines.join("\n"));
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

  // ═══ RuntimeState (MyTool) ═══

  get toolNames(): string[] {
    return this.tools.toolNames;
  }

  get runtimeVars(): Record<string, unknown> {
    return this._runtimeVars;
  }

  get lastUsage(): TokenUsage | null {
    return this._lastUsage;
  }

  setRuntimeValue(key: string, value: unknown): string {
    if (key === "maxIterations") {
      const n = Number(value);
      if (Number.isNaN(n) || n < 1 || n > 100) return "Error: maxIterations out of range (1-100)";
      this.maxIterations = n;
      this.subagents?.setProvider(this.provider, this.model);
      return `maxIterations set to ${n}`;
    }
    if (key === "contextWindowTokens") {
      const n = Number(value);
      if (Number.isNaN(n) || n < 4096 || n > 1_000_000) {
        return "Error: contextWindowTokens out of range";
      }
      this.contextWindowTokens = n;
      return `contextWindowTokens set to ${n}`;
    }
    if (key === "model") {
      const m = String(value).trim();
      if (!m) return "Error: model must be non-empty";
      this.setModel(m);
      return `model set to ${m}`;
    }
    this._runtimeVars[key] = value;
    return `${key} stored in runtime scratchpad`;
  }

  _refreshProviderSnapshot(): void {
    if (!this._config) return;
    try {
      const snapshot = buildProviderSnapshot(
        this._config,
        this.modelPreset ?? undefined,
      );
      this._applyProviderSnapshot(snapshot);
    } catch (err) {
      console.warn("[agent] provider snapshot refresh failed:", err);
    }
  }

  private _applyProviderSnapshot(snapshot: ProviderSnapshot): void {
    const sig = JSON.stringify(snapshot.signature);
    const prev = this._providerSnapshot
      ? JSON.stringify(this._providerSnapshot.signature)
      : null;
    if (sig === prev) return;
    this._providerSnapshot = snapshot;
    this.provider = snapshot.provider;
    this.model = snapshot.model;
    this.contextWindowTokens = snapshot.contextWindowTokens;
    this.runner.setProvider(snapshot.provider);
    this.consolidator.setProvider(
      snapshot.provider,
      snapshot.model,
      snapshot.contextWindowTokens,
    );
    this.dream?.setProvider(snapshot.provider, snapshot.model);
    this.subagents?.setProvider(snapshot.provider, snapshot.model);
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

  setModelPreset(name: string | null, publishUpdate = true): void {
    if (!this._config) {
      console.warn("[agent] setModelPreset: no config");
      return;
    }
    void publishUpdate;
    try {
      const presets = configuredModelPresets(this._config);
      if (name) normalizePresetName(name, presets);
      this.modelPreset = name;
      this._refreshProviderSnapshot();
      console.log(`[agent] Model preset: ${name ?? "(default)"}`);
    } catch (err) {
      console.warn("[agent] setModelPreset failed:", err);
    }
  }

  setModel(model: string) {
    console.log(`[agent] Model switched: ${this.model} → ${model}`);
    this.model = model;
    this.runner.setProvider(this.provider);
    this.consolidator.setProvider(
      this.provider,
      model,
      this.contextWindowTokens,
    );
    this.subagents?.setProvider(this.provider, model);
    this.dream?.setProvider(this.provider, model);
  }

  setProvider(provider: LLMProvider) {
    console.log(`[agent] Provider reloaded`);
    this.provider = provider;
    this.runner.setProvider(provider);
    this.consolidator.setProvider(
      provider,
      this.model,
      this.contextWindowTokens,
    );
    this.subagents?.setProvider(provider, this.model);
    this.dream?.setProvider(provider, this.model);
  }

  /** Background Dream cycle (optional cron). */
  async runDreamOnce(): Promise<string | null> {
    return this.dream?.runOnce() ?? null;
  }

  /** Dispatch a heartbeat check (cron or /heartbeat). */
  runHeartbeatOnce(opts?: { force?: boolean }): HeartbeatRunResult {
    if (!this._config || !this.bus) return "skipped";
    return runHeartbeatOnce(
      {
        agentLoop: this,
        sessions: this.sessions,
        config: this._config,
        configFile: "",
      },
      opts,
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
