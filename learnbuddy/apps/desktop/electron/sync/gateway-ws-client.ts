/**
 * Desktop WebSocket client for learnbuddy Gateway session protocol.
 */
import { BrowserWindow } from "electron";
import WebSocket from "ws";
import { randomUUID } from "node:crypto";
import type {
  GatewaySessionClientMessage,
  GatewaySessionServerMessage,
  GatewaySessionRow,
  SessionDetail,
  SessionInfo,
} from "@learnbuddy/shared";
import type { MessageBus } from "../bus/index.js";
import { buildWebuiThreadFromSession } from "./session-thread.js";

export interface GatewaySessionProvider {
  list(): SessionInfo[];
  getDetail(key: string): SessionDetail | null;
  getOrCreate(key: string): SessionInfo;
  importWebuiThread(
    sessionKey: string,
    payload: Record<string, unknown>,
  ): void;
}

export interface GatewayWsClientConfig {
  url: string;
  secret: string;
  deviceId?: string;
  /** Auto-subscribe these session keys after connect. */
  sessionKeys?: string[];
}

export interface GatewayWsClientStatus {
  connected: boolean;
  deviceId: string;
  pairingCode?: string;
  lastError?: string;
}

type InboundHandler = (msg: Extract<GatewaySessionServerMessage, { type: "inbound_message" }>) => void;
type CreateSessionHandler = (sessionKey: string, chatId: string) => void;

export class GatewayWsClient {
  private ws: WebSocket | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly deviceId: string;
  private _pairingCode?: string;
  private _connected = false;
  private _lastError?: string;
  private onInbound: InboundHandler | null = null;
  private onCreateSession: CreateSessionHandler | null = null;
  private sessionProvider: GatewaySessionProvider | null = null;
  private readonly subscribedSessions = new Set<string>();

  constructor(
    private readonly config: GatewayWsClientConfig,
    private readonly bus?: MessageBus,
  ) {
    this.deviceId = config.deviceId ?? `desktop-${randomUUID().slice(0, 8)}`;
  }

  get status(): GatewayWsClientStatus {
    return {
      connected: this._connected,
      deviceId: this.deviceId,
      pairingCode: this._pairingCode,
      lastError: this._lastError,
    };
  }

  setInboundHandler(handler: InboundHandler): void {
    this.onInbound = handler;
  }

  setCreateSessionHandler(handler: CreateSessionHandler): void {
    this.onCreateSession = handler;
  }

  setSessionProvider(provider: GatewaySessionProvider): void {
    this.sessionProvider = provider;
  }

  publishThreadSnapshot(sessionKey: string): void {
    if (!this._connected || !this.sessionProvider) return;
    const detail = this.sessionProvider.getDetail(sessionKey);
    const built = buildWebuiThreadFromSession(detail);
    if (!built?.messages?.length) return;
    this.send({
      type: "thread_snapshot",
      sessionKey,
      payload: built as unknown as Record<string, unknown>,
    });
  }

  /** Push desktop session list to gateway (Web sidebar sync). */
  publishSessionsSync(requestId?: string): void {
    if (!this._connected || !this.sessionProvider) return;
    const payload: GatewaySessionClientMessage = {
      type: "sessions_sync",
      requestId,
      sessions: this.buildSessionRows(),
    };
    this.send(payload);
  }

  start(): void {
    this.connect();
  }

  stop(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.removeAllListeners();
      this.ws.close();
      this.ws = null;
    }
    this._connected = false;
  }

  publishUiEvent(
    sessionKey: string,
    chatId: string,
    event: Record<string, unknown>,
  ): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(
      JSON.stringify({
        type: "ui_event",
        sessionKey,
        chatId,
        event,
      }),
    );
  }

  subscribeSession(sessionKey: string): void {
    const key = sessionKey.trim();
    if (!key || this.subscribedSessions.has(key)) return;
    this.subscribedSessions.add(key);
    if (this._connected) {
      this.send({ type: "subscribe", sessionKey: key });
    }
  }

  /** Subscribe every known session key (sidebar list). */
  syncSessions(sessionKeys: string[]): void {
    for (const key of sessionKeys) {
      this.subscribeSession(key);
    }
  }

  get subscribedSessionKeys(): string[] {
    return [...this.subscribedSessions];
  }

  private connect(): void {
    try {
      this.ws = new WebSocket(this.config.url);
    } catch (err) {
      this._lastError = err instanceof Error ? err.message : String(err);
      this.scheduleReconnect();
      return;
    }

    this.ws.on("open", () => {
      this.send({
        type: "register",
        role: "desktop",
        deviceId: this.deviceId,
        token: this.config.secret,
      });
    });

    this.ws.on("message", (data) => {
      let msg: GatewaySessionServerMessage;
      try {
        msg = JSON.parse(data.toString()) as GatewaySessionServerMessage;
      } catch {
        return;
      }
      this.handleServerMessage(msg);
    });

    this.ws.on("error", (err) => {
      this._lastError = err instanceof Error ? err.message : "websocket_error";
      console.warn("[gateway] error:", this._lastError);
    });

    this.ws.on("close", () => {
      this._connected = false;
      console.log("[gateway] disconnected");
      this.scheduleReconnect();
    });
  }

  private handleServerMessage(msg: GatewaySessionServerMessage): void {
    if (msg.type === "registered") {
      this._connected = true;
      this._pairingCode = msg.pairingCode;
      this._lastError = undefined;
      console.log(
        `[gateway] connected deviceId=${msg.deviceId} pairing=${msg.pairingCode ?? "n/a"}`,
      );
      if (this.config.sessionKeys?.length) {
        this.syncSessions(this.config.sessionKeys);
      }
      for (const key of this.subscribedSessions) {
        this.send({ type: "subscribe", sessionKey: key });
      }
      this.publishSessionsSync();
      return;
    }

    if (msg.type === "sync_push") {
      this.applySyncPush(msg);
      return;
    }

    if (msg.type === "request_sessions") {
      this.publishSessionsSync(msg.requestId);
      return;
    }

    if (msg.type === "request_thread") {
      const sessionKey = msg.sessionKey.trim();
      const detail = sessionKey
        ? this.sessionProvider?.getDetail(sessionKey) ?? null
        : null;
      const built = buildWebuiThreadFromSession(detail);
      this.send({
        type: "thread_response",
        requestId: msg.requestId,
        payload: built as Record<string, unknown> | null,
      });
      return;
    }

    if (msg.type === "error") {
      this._lastError = msg.message;
      console.warn("[gateway] error:", msg.message);
      return;
    }

    if (msg.type === "create_session") {
      const sessionKey = msg.sessionKey.trim();
      const chatId = msg.chatId.trim();
      if (sessionKey) {
        this.subscribeSession(sessionKey);
        this.onCreateSession?.(sessionKey, chatId || sessionKey.slice(sessionKey.indexOf(":") + 1));
        this.publishSessionsSync();
      }
      return;
    }

    if (msg.type === "inbound_message") {
      if (this.onInbound) {
        this.onInbound(msg);
        return;
      }
      this.publishToBus(msg);
    }
  }

  private publishToBus(
    msg: Extract<GatewaySessionServerMessage, { type: "inbound_message" }>,
  ): void {
    if (!this.bus) return;
    const channel = msg.sessionKey.includes(":")
      ? msg.sessionKey.slice(0, msg.sessionKey.indexOf(":"))
      : "desktop";
    void this.bus.publishInbound({
      channel,
      senderId: "gateway-web",
      chatId: msg.chatId,
      content: msg.content,
      media: msg.media ?? [],
      timestamp: Date.now(),
      metadata: { _gateway_source: msg.source },
      sessionKeyOverride: msg.sessionKey,
    });
    BrowserWindow.getAllWindows()[0]?.webContents.send("agent:gateway-inbound", {
      chatId: msg.chatId,
      sessionKey: msg.sessionKey,
      content: msg.content,
    });
  }

  private applySyncPush(
    msg: Extract<GatewaySessionServerMessage, { type: "sync_push" }>,
  ): void {
    if (!this.sessionProvider) return;
    const rows = Array.isArray(msg.sessions) ? msg.sessions : [];
    for (const row of rows) {
      if (row?.key) this.sessionProvider.getOrCreate(row.key);
    }
    const threads = msg.threads ?? {};
    for (const [sessionKey, payload] of Object.entries(threads)) {
      if (!sessionKey || !payload) continue;
      this.sessionProvider.importWebuiThread(sessionKey, payload);
      this.subscribeSession(sessionKey);
    }
    console.log(
      `[gateway] sync_push applied sessions=${rows.length} threads=${Object.keys(threads).length}`,
    );
    this.publishSessionsSync();
  }

  private buildSessionRows(): GatewaySessionRow[] {
    if (!this.sessionProvider) return [];
    return this.sessionProvider.list().map((s) => {
      const idx = s.key.indexOf(":");
      const channel = idx === -1 ? "desktop" : s.key.slice(0, idx);
      const chatId = idx === -1 ? s.key : s.key.slice(idx + 1);
      return {
        key: s.key,
        channel,
        chatId,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
        title: s.title ?? "",
        preview: s.preview ?? "",
      };
    });
  }

  private send(msg: GatewaySessionClientMessage): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, 3000);
  }
}

export function loadGatewayConfigFromEnv(): GatewayWsClientConfig | null {
  const enabled =
    process.env.GATEWAY_ENABLED === "true" || process.env.GATEWAY_ENABLED === "1";
  const url = process.env.GATEWAY_URL?.trim();
  const secret = process.env.GATEWAY_SECRET?.trim();
  if (!enabled || !url || !secret) return null;
  const sessions = process.env.GATEWAY_DEFAULT_SESSIONS?.trim();
  return {
    url,
    secret,
    deviceId: process.env.GATEWAY_DEVICE_ID?.trim() || undefined,
    sessionKeys: sessions
      ? sessions.split(",").map((s) => s.trim()).filter(Boolean)
      : undefined,
  };
}
