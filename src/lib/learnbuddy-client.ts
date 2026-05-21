/**
 * learnbuddyClient — UI-facing agent client (WebSocket-era API, unchanged contract).
 * Transport is injected: Electron IPC today, WebSocket when running in a browser.
 */
import type {
  ConnectionStatus,
  InboundEvent,
  OutboundMedia,
  OutboundImageGeneration,
} from "./types";
import { createAgentTransport } from "./transport/create-transport";
import type {
  AgentTransport,
  CreateTransportOptions,
  SessionUpdateScope,
} from "./transport/types";

type Unsubscribe = () => void;
type EventHandler = (ev: InboundEvent) => void;
type StatusHandler = (status: ConnectionStatus) => void;
type RuntimeModelHandler = (modelName: string | null, modelPreset?: string | null) => void;
type SessionUpdateHandler = (chatId: string, scope?: SessionUpdateScope) => void;
type GoHomeHandler = () => void;

export type StreamError = { kind: "message_too_big" };

type ErrorHandler = (error: StreamError) => void;

const DEFAULT_CHAT_ID = `desktop:${Date.now()}_main`;

export class learnbuddyClient {
  status_: ConnectionStatus = "idle";
  /** @deprecated WebSocket socket; always null under IPC. Kept for UI compat. */
  socket = null;
  readyChatId: string = DEFAULT_CHAT_ID;

  private knownChats = new Set<string>();
  private chatHandlers = new Map<string, Set<EventHandler>>();
  private statusHandlers = new Set<StatusHandler>();
  private runtimeModelHandlers = new Set<RuntimeModelHandler>();
  private sessionUpdateHandlers = new Set<SessionUpdateHandler>();
  private errorHandlers = new Set<ErrorHandler>();
  private _goHomeHandlers = new Set<GoHomeHandler>();
  private _detachTransport: (() => void) | null = null;

  private _currentStreamId: string | null = null;
  private _activeChatId: string = DEFAULT_CHAT_ID;
  private _latencyMs: number | null = null;

  constructor(private readonly transport: AgentTransport) {}

  get status(): ConnectionStatus {
    return this.status_;
  }

  get defaultChatId(): string | null {
    return DEFAULT_CHAT_ID;
  }

  /** WebSocket transports may implement URL switching; IPC is a no-op. */
  updateUrl(url: string): void {
    this.transport.updateUrl?.(url);
  }

  getRunStartedAt(_chatId: string): number | null {
    return null;
  }

  getGoalState(_chatId: string) {
    return undefined;
  }

  connect(): void {
    if (this._detachTransport) {
      this._detachTransport();
      this._detachTransport = null;
    }

    this.knownChats.add(DEFAULT_CHAT_ID);

    this._detachTransport = this.transport.attach({
      getActiveChatId: () => this._activeChatId,
      onEvent: (ev) => {
        if (ev.event === "delta" && ev.stream_id) {
          this._currentStreamId = ev.stream_id;
        }
        const chatId =
          "chat_id" in ev && typeof ev.chat_id === "string"
            ? ev.chat_id
            : this._activeChatId;
        this._dispatch(chatId, ev);
      },
      onStatus: (status) => this.setStatus(status),
      onSessionUpdate: (chatId, scope) => {
        for (const h of this.sessionUpdateHandlers) {
          try {
            h(chatId, scope);
          } catch {
            /* isolated */
          }
        }
      },
      onGoHome: () => {
        for (const h of this._goHomeHandlers) {
          try {
            h();
          } catch {
            /* isolated */
          }
        }
      },
    });
  }

  close(): void {
    this._detachTransport?.();
    this._detachTransport = null;
    this.chatHandlers.clear();
    this.setStatus("closed");
  }

  onStatus(handler: StatusHandler): Unsubscribe {
    this.statusHandlers.add(handler);
    handler(this.status_);
    return () => this.statusHandlers.delete(handler);
  }

  onSessionUpdate(handler: SessionUpdateHandler): Unsubscribe {
    this.sessionUpdateHandlers.add(handler);
    return () => this.sessionUpdateHandlers.delete(handler);
  }

  onRuntimeModelUpdate(handler: RuntimeModelHandler): Unsubscribe {
    this.runtimeModelHandlers.add(handler);
    return () => this.runtimeModelHandlers.delete(handler);
  }

  onError(handler: ErrorHandler): Unsubscribe {
    this.errorHandlers.add(handler);
    return () => this.errorHandlers.delete(handler);
  }

  onGoHomeRequest(handler: GoHomeHandler): Unsubscribe {
    this._goHomeHandlers.add(handler);
    return () => this._goHomeHandlers.delete(handler);
  }

  onChat(chatId: string, handler: EventHandler): Unsubscribe {
    let handlers = this.chatHandlers.get(chatId);
    if (!handlers) {
      handlers = new Set();
      this.chatHandlers.set(chatId, handlers);
    }
    handlers.add(handler);
    return () => {
      handlers?.delete(handler);
      if (handlers?.size === 0) this.chatHandlers.delete(chatId);
    };
  }

  newChat(_timeoutMs: number = 5000): Promise<string> {
    const newId = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    this.knownChats.add(newId);
    return Promise.resolve(newId);
  }

  attach(chatId: string): void {
    this.knownChats.add(chatId);
  }

  sendMessage(
    chatId: string,
    content: string,
    media?: OutboundMedia[],
    _options?: { imageGeneration?: OutboundImageGeneration },
  ): void {
    this.knownChats.add(chatId);
    this._activeChatId = chatId;

    const mediaUrls = media?.map((m) => m.data_url) ?? [];
    this.transport.sendMessage(chatId, content, mediaUrls);
  }

  private _emitSessionHandshake(): void {
    const clientId = this.transport.kind === "ipc" ? "desktop" : "web";
    this._dispatch(DEFAULT_CHAT_ID, {
      event: "ready",
      chat_id: DEFAULT_CHAT_ID,
      client_id: clientId,
    });
    this._dispatch(DEFAULT_CHAT_ID, {
      event: "attached",
      chat_id: DEFAULT_CHAT_ID,
    });
  }

  private _dispatch(chatId: string, ev: InboundEvent): void {
    const handlers = this.chatHandlers.get(chatId);
    if (handlers) {
      for (const h of handlers) {
        try {
          h(ev);
        } catch {
          /* isolated */
        }
      }
    }
  }

  private setStatus(status: ConnectionStatus): void {
    if (this.status_ === status) return;
    const wasOpen = this.status_ === "open";
    this.status_ = status;
    for (const h of this.statusHandlers) h(status);
    if (status === "open" && !wasOpen) {
      this._emitSessionHandshake();
    }
  }
}

export interface CreateLearnbuddyClientOptions {
  token: string;
  wsPath: string;
  /** Override auto-detected transport (desktop IPC vs web WebSocket). */
  transport?: AgentTransport;
  transportMode?: CreateTransportOptions["mode"];
}

/** Bootstrap entry: pluggable transport, same learnbuddyClient API for UI. */
export function createLearnbuddyClient(
  options: CreateLearnbuddyClientOptions,
): learnbuddyClient {
  const transport =
    options.transport
    ?? createAgentTransport({
      mode: options.transportMode ?? "auto",
      token: options.token,
      wsPath: options.wsPath,
    });
  return new learnbuddyClient(transport);
}
