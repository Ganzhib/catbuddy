import * as fs from "node:fs";
import { BrowserWindow, ipcMain } from "electron";
import type { FileEditEvent, OutboundMessage, ToolEvent, TurnCompleteData, catbuddyConfig } from "@catbuddy/shared";
import { CATBUDDY_GATEWAY_HOST, resolveBuiltinGatewayWsUrl } from "@catbuddy/shared";
import { GatewayDesktopClient, loadGatewayConfigFromSources } from "@catbuddy/gateway-sdk-desktop";
import { toolEventToUiHint } from "../sync/tool-event-map.js";
import { buildWebuiThreadFromSession } from "../sync/session-thread.js";
import { postGatewayAuthHttp } from "../services/gateway-auth-http.js";
import type { MessageBus } from "../bus/index.js";
import type { SessionManager } from "../session/session-manager.js";
import type { BaseChannel } from "./base";

let lastErr = "";
let errCount = 0;
const localGateway = () => {
  const flag = process.env.CATBUDDY_GATEWAY_USE_LOCAL?.trim();
  if (flag === "true" || flag === "1") return true;
  if (flag === "false" || flag === "0") return false;
  return false;
};
const needsEmail = () => {
  const flag = process.env.GATEWAY_AUTH_REQUIRE_EMAIL?.trim();
  if (flag === "false" || flag === "0") return false;
  if (flag === "true" || flag === "1") return true;
  return !localGateway();
};
const safeIpc = (name: string, handler: Parameters<typeof ipcMain.handle>[1]) => {
  try { ipcMain.removeHandler(name); } catch {}
  ipcMain.handle(name, handler);
};

export interface GatewayChannelOptions {
  config: catbuddyConfig;
  configFile: string;
  sessions: SessionManager;
  bus: MessageBus;
}

export class GatewayChannel implements BaseChannel {
  readonly name = "gateway";
  readonly displayName = "gateway";
  private _running = false;
  private gateway: GatewayDesktopClient | null = null;
  private accountEmail?: string;
  private ipcRegistered = false;

  constructor(private refs: GatewayChannelOptions) {
    this.accountEmail = refs.config.gateway?.accountEmail?.trim().toLowerCase() || undefined;
  }

  get running(): boolean { return this._running; }
  get client(): GatewayDesktopClient | null { return this.gateway; }

  async start(): Promise<void> {
    this._running = true;
    this.registerIpc();
    this.applyRemote();
  }
  async stop(): Promise<void> { this._running = false; this.stopClient(); }

  private registerIpc(): void {
    if (this.ipcRegistered) return;
    this.ipcRegistered = true;
    console.log("[main] GatewayChannel registerIpc");
    safeIpc("gateway:get-remote-enabled", async () => ({
      enabled: this.refs.config.gateway?.remoteEnabled === true,
      envConfigured: this.configured(),
      configured: this.configured(),
      connected: this.gateway?.status.connected ?? false,
      lastError: this.gateway?.status.lastError,
      needsLogin: this.refs.config.gateway?.remoteEnabled === true && needsEmail() && !this.email(),
    }));
    safeIpc("gateway:get-connection-settings", async () => {
      const local = localGateway();
      const merged = this.gatewayConfig();
      return {
        host: CATBUDDY_GATEWAY_HOST,
        mode: this.connectionMode(),
        useLocal: local,
        url: merged?.url ?? resolveBuiltinGatewayWsUrl(local),
        hasSecret: true,
        configured: this.configured(),
        envOverridesUrl: !!process.env.GATEWAY_URL?.trim(),
        envOverridesSecret: local ? !!process.env.GATEWAY_SECRET?.trim() : !!process.env.GATEWAY_DESKTOP_SECRET?.trim(),
        selfHostCustom: this.connectionMode() === "custom",
      };
    });
    safeIpc("gateway:set-connection-settings", async (_event, payload: { url?: string; secret?: string; clearCustom?: boolean }) => {
      const gateway = this.ensureGatewayConfig();
      if (payload.clearCustom) {
        delete gateway.url;
        delete gateway.secret;
      } else {
        if (payload.url !== undefined) gateway.url = String(payload.url).trim();
        if (payload.secret !== undefined) {
          const secret = String(payload.secret).trim();
          if (secret) gateway.secret = secret;
        }
      }
      this.saveAndApply();
      return { ok: true, configured: this.configured(), connected: this.gateway?.status.connected ?? false };
    });
    safeIpc("gateway:set-account-email", async (_event, { email }: { email?: string }) => {
      const normalized = String(email || "").trim().toLowerCase();
      this.accountEmail = normalized.includes("@") ? normalized : undefined;
      this.ensureGatewayConfig().accountEmail = this.accountEmail;
      this.saveAndApply();
      return { ok: true, accountEmail: this.accountEmail ?? null };
    });
    safeIpc("gateway:set-remote-enabled", async (_event, { enabled }: { enabled?: boolean }) => {
      this.ensureGatewayConfig().remoteEnabled = !!enabled;
      this.saveAndApply();
      return { enabled: this.refs.config.gateway?.remoteEnabled === true, connected: this.gateway?.status.connected ?? false };
    });
    safeIpc("gateway:auth-post", async (_event, payload: { path?: string; body?: Record<string, unknown> }) => {
      const path = String(payload?.path ?? "").trim();
      if (!new Set(["login", "register", "register/verify", "email/request-code"]).has(path)) {
        return { ok: false, status: 400, text: "invalid_auth_path" };
      }
      return postGatewayAuthHttp(path, payload?.body ?? {});
    });
  }

  applyRemote(): void {
    const cfg = this.gatewayConfig();
    const remoteEnabled = this.refs.config.gateway?.remoteEnabled === true;
    console.log("[main] GatewayChannel applyRemote", { remoteEnabled, hasGatewayConfig: !!cfg, gatewayUrl: cfg?.url, gatewayEnabled: process.env.GATEWAY_ENABLED ?? "(unset)", useLocal: localGateway(), accountEmail: this.email() ?? "(none)" });
    this.stopClient();
    if (!cfg || !remoteEnabled || !this._running) {
      console.log("[main] Gateway remote skipped:", { hasGatewayConfig: !!cfg, remoteEnabled, running: this._running });
      if (cfg && !remoteEnabled) console.log("[main] Gateway ready but remote control is off");
      return;
    }
    const accountEmail = this.email();
    if (needsEmail() && !accountEmail) {
      console.log("[main] Gateway remote enabled but waiting for login email");
      return;
    }
    console.log("[main] Gateway connecting:", { url: cfg.url, useLocal: localGateway(), accountEmail: accountEmail ?? "(none)" });
    this.gateway = new GatewayDesktopClient({ ...cfg, accountEmail }, {
      onConnected: (deviceId) => this.broadcast("gateway:connection-changed", { connected: true, deviceId }),
      onError: (message) => { this.logWsError(message); this.broadcast("gateway:connection-changed", { connected: false, lastError: message }); },
      sessionProvider: {
        list: () => this.refs.sessions.list(),
        getDetail: (key) => this.refs.sessions.getDetail(key),
        getOrCreate: (key) => this.refs.sessions.getOrCreate(key),
        importWebuiThread: (key, payload) => this.refs.sessions.importWebuiThread(key, payload),
      },
      buildThreadSnapshot: buildWebuiThreadFromSession,
      publishInbound: (msg) => {
        this.refs.bus.publishInbound(msg);
        this.broadcast("agent:gateway-inbound", { chatId: msg.chatId, sessionKey: msg.sessionKeyOverride ?? `desktop:${msg.chatId}`, content: msg.content });
      },
      onCreateSession: (sessionKey, chatId) => {
        this.refs.sessions.getOrCreate(sessionKey);
        this.gateway?.focusSession(sessionKey);
        console.log("[main] Gateway create_session:", sessionKey);
        this.broadcast("session:created", { sessionKey, chatId });
      },
      onDeleteSession: (sessionKey) => {
        this.refs.sessions.delete(sessionKey);
        console.log("[main] Gateway delete_session:", sessionKey);
        this.broadcast("session:deleted", { sessionKey });
      },
    });
    this.gateway.start();
    this.syncSessions();
    console.log("[main] Gateway remote enabled:", cfg.url);
  }

  async send(msg: OutboundMessage): Promise<void> {
    if (msg.metadata?._progress && msg.content) this.emitSession(msg.chatId, { event: "message", chat_id: msg.chatId, text: msg.content, kind: "progress" });
  }
  async sendAssistantMessage(chatId: string, text: string): Promise<void> { this.emitSession(chatId, { event: "message", chat_id: chatId, text }); }
  async sendDelta(chatId: string, delta: string, metadata?: Record<string, unknown>): Promise<void> { this.emitSession(chatId, { event: "delta", chat_id: chatId, text: delta, stream_id: (metadata?._stream_id as string) ?? chatId }); }
  async sendStreamEnd(chatId: string, metadata?: Record<string, unknown>): Promise<void> { this.emitSession(chatId, { event: "stream_end", chat_id: chatId, stream_id: (metadata?._stream_id as string) ?? "" }); }
  async sendReasoningDelta(chatId: string, delta: string): Promise<void> { this.emitSession(chatId, { event: "reasoning_delta", chat_id: chatId, text: delta }); }
  async sendReasoningEnd(chatId: string): Promise<void> { this.emitSession(chatId, { event: "reasoning_end", chat_id: chatId }); }
  async sendToolProgress(chatId: string, event: ToolEvent): Promise<void> { this.emitSession(chatId, { event: "message", chat_id: chatId, text: "", kind: "tool_hint", tool_events: [toolEventToUiHint(event)] }); }
  async sendFileEdit(chatId: string, edit: FileEditEvent): Promise<void> { this.emitSession(chatId, { event: "file_edit", chat_id: chatId, edits: [edit as unknown as Record<string, unknown>] }); }
  async sendTurnComplete(chatId: string, data: TurnCompleteData): Promise<void> {
    this.emitSession(chatId, { event: "turn_end", chat_id: chatId, latency_ms: data.latencyMs, usage: data.usage, tools_used: data.toolsUsed?.length ? [...new Set(data.toolsUsed)] : undefined });
    this.emitSession(chatId, { event: "goal_status", chat_id: chatId, status: "idle" });
    this.gateway?.publishSessionsSync();
    this.gateway?.publishThreadSnapshot(this.sessionKey(chatId));
  }

  private gatewayConfig() { return loadGatewayConfigFromSources(this.refs.config.gateway, { useLocalDefaults: localGateway() }); }
  private configured(): boolean { return this.gatewayConfig() !== null; }
  private ensureGatewayConfig() { return this.refs.config.gateway ??= {}; }
  private connectionMode(): "env" | "custom" | "local" | "builtin" {
    const local = localGateway();
    if (local && process.env.GATEWAY_URL?.trim()) return "env";
    if (!local && (process.env.GATEWAY_URL?.trim() || process.env.GATEWAY_DESKTOP_SECRET?.trim())) return "env";
    if (local && process.env.GATEWAY_SECRET?.trim()) return "env";
    if (this.refs.config.gateway?.url?.trim() || this.refs.config.gateway?.secret?.trim()) return "custom";
    return local ? "local" : "builtin";
  }
  private email(): string | undefined { return [this.accountEmail, this.refs.config.gateway?.accountEmail, process.env.GATEWAY_ACCOUNT_EMAIL].map((v) => v?.trim().toLowerCase()).find((v) => v?.includes("@")); }
  private saveAndApply(): void { fs.writeFileSync(this.refs.configFile, JSON.stringify(this.refs.config, null, 2), "utf-8"); this.applyRemote(); }
  private stopClient(): void { this.gateway?.stop(); this.gateway = null; }
  private syncSessions(): void { if (this.gateway) this.gateway.syncSessions(this.refs.sessions.list().map((row) => row.key)); }
  private sessionKey(chatId: string): string { return chatId.startsWith("desktop:") ? chatId : `desktop:${chatId}`; }
  private emitSession(chatId: string, event: Record<string, unknown>): void { this.gateway?.publishUiEvent(this.sessionKey(chatId), chatId, event); }
  private broadcast(channel: string, payload: Record<string, unknown>): void { for (const win of BrowserWindow.getAllWindows()) win.webContents.send(channel, payload); }
  private logWsError(message: string): void {
    if (message === lastErr) {
      errCount += 1;
      if (errCount !== 3 && errCount % 10 !== 0) return;
    } else {
      lastErr = message;
      errCount = 1;
    }
    console.warn("[main] Gateway WS error:", message + (errCount > 1 ? ` (×${errCount})` : ""));
  }
}
