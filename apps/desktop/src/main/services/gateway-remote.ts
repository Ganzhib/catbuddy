import * as fs from "node:fs";
import { app, BrowserWindow, ipcMain } from "electron";
import {
  GatewayDesktopClient,
  loadGatewayConfigFromSources,
} from "@catbuddy/gateway-sdk-desktop";
import {
  CATBUDDY_GATEWAY_HOST,
  resolveBuiltinGatewayWsUrl,
  type catbuddyConfig,
} from "@catbuddy/shared";
import type { MessageBus } from "../bus/index.js";
import type { ChannelManager } from "../channels/index.js";
import { GatewayChannel } from "../channels/index.js";
import type { SessionManager } from "../session/session-manager.js";
import { buildWebuiThreadFromSession } from "../sync/session-thread.js";

export interface GatewayRemoteState {
  gatewayWsClient: GatewayDesktopClient | null;
  gatewayAccountEmail: string | undefined;
  appConfig: catbuddyConfig;
  appConfigFile: string;
  appSessions: SessionManager | null;
  appBus: MessageBus | null;
  appChannelManager: ChannelManager | null;
}

function useLocalGateway(): boolean {
  const flag = process.env.CATBUDDY_GATEWAY_USE_LOCAL?.trim()
  if (flag === 'true' || flag === '1') return true
  if (flag === 'false' || flag === '0') return false
  // Default: production builtin (avoid dev silently targeting 127.0.0.1:18765).
  return false
}

function resolveGatewayConfig(state: GatewayRemoteState) {
  return loadGatewayConfigFromSources(state.appConfig?.gateway, {
    useLocalDefaults: useLocalGateway(),
  })
}

function isGatewayConfigured(state: GatewayRemoteState): boolean {
  return resolveGatewayConfig(state) !== null
}

function connectionMode(state: GatewayRemoteState): 'env' | 'custom' | 'local' | 'builtin' {
  if (process.env.GATEWAY_URL?.trim() || process.env.GATEWAY_SECRET?.trim()) return 'env'
  if (state.appConfig?.gateway?.url?.trim() || state.appConfig?.gateway?.secret?.trim()) {
    return 'custom'
  }
  return useLocalGateway() ? 'local' : 'builtin'
}

function requiresGatewayAccountEmail(): boolean {
  const flag = process.env.GATEWAY_AUTH_REQUIRE_EMAIL?.trim()
  if (flag === 'false' || flag === '0') return false
  if (flag === 'true' || flag === '1') return true
  return !useLocalGateway()
}

function resolveAccountEmail(state: GatewayRemoteState): string | undefined {
  const fromState = state.gatewayAccountEmail?.trim()
  if (fromState?.includes('@')) return fromState.toLowerCase()
  const fromConfig = state.appConfig?.gateway?.accountEmail?.trim()
  if (fromConfig?.includes('@')) return fromConfig.toLowerCase()
  const fromEnv = process.env.GATEWAY_ACCOUNT_EMAIL?.trim()
  if (fromEnv?.includes('@')) return fromEnv.toLowerCase()
  return undefined
}

function persistConfig(state: GatewayRemoteState): void {
  fs.writeFileSync(
    state.appConfigFile,
    JSON.stringify(state.appConfig, null, 2),
    "utf-8",
  );
}

function safeIpcHandle(channel: string, handler: Parameters<typeof ipcMain.handle>[1]): void {
  try {
    ipcMain.removeHandler(channel);
  } catch {
    // no prior handler (first register)
  }
  ipcMain.handle(channel, handler);
}

export function applyGatewayRemote(state: GatewayRemoteState): void {
  const { appConfig, appSessions, appBus, appChannelManager } = state;

  const remoteEnabled = appConfig?.gateway?.remoteEnabled === true;
  const gwCfg = resolveGatewayConfig(state);
  console.log("[main] applyGatewayRemote", {
    remoteEnabled,
    hasGatewayConfig: !!gwCfg,
    gatewayUrl: gwCfg?.url,
    gatewayEnabled: process.env.GATEWAY_ENABLED ?? "(unset)",
    useLocal: useLocalGateway(),
    accountEmail: resolveAccountEmail(state) ?? "(none)",
  });

  if (state.gatewayWsClient) {
    state.gatewayWsClient.stop();
    appChannelManager?.unregister("gateway");
    state.gatewayWsClient = null;
  }

  if (!gwCfg || !remoteEnabled || !appChannelManager || !appSessions || !appBus) {
    console.log("[main] Gateway remote skipped:", {
      hasGatewayConfig: !!gwCfg,
      remoteEnabled,
      hasChannelManager: !!appChannelManager,
      hasSessions: !!appSessions,
      hasBus: !!appBus,
    });
    if (gwCfg && !remoteEnabled) {
      console.log("[main] Gateway ready but remote control is off");
    }
    return;
  }

  const email = resolveAccountEmail(state)

  if (requiresGatewayAccountEmail() && !email) {
    console.log("[main] Gateway remote enabled but waiting for login email");
    return;
  }

  console.log("[main] Gateway connecting:", {
    url: gwCfg.url,
    useLocal: useLocalGateway(),
    accountEmail: email ?? "(none)",
  });

  state.gatewayWsClient = new GatewayDesktopClient(
    { ...gwCfg, accountEmail: email },
    {
      onConnected: (deviceId) => {
        console.log("[main] Gateway WS connected:", deviceId);
        for (const win of BrowserWindow.getAllWindows()) {
          win.webContents.send("gateway:connection-changed", {
            connected: true,
            deviceId,
          });
        }
      },
      onError: (message) => {
        console.warn("[main] Gateway WS error:", message);
        for (const win of BrowserWindow.getAllWindows()) {
          win.webContents.send("gateway:connection-changed", {
            connected: false,
            lastError: message,
          });
        }
      },
      sessionProvider: {
        list: () => appSessions!.list(),
        getDetail: (key) => appSessions!.getDetail(key),
        getOrCreate: (key) => appSessions!.getOrCreate(key),
        importWebuiThread: (key, payload) =>
          appSessions!.importWebuiThread(key, payload),
      },
      buildThreadSnapshot: buildWebuiThreadFromSession,
      publishInbound: (msg) => {
        appBus!.publishInbound(msg);
        for (const win of BrowserWindow.getAllWindows()) {
          win.webContents.send("agent:gateway-inbound", {
            chatId: msg.chatId,
            sessionKey: msg.sessionKeyOverride ?? `desktop:${msg.chatId}`,
            content: msg.content,
          });
        }
      },
      onCreateSession: (sessionKey, chatId) => {
        appSessions!.getOrCreate(sessionKey);
        state.gatewayWsClient!.focusSession(sessionKey);
        console.log("[main] Gateway create_session:", sessionKey);
        for (const win of BrowserWindow.getAllWindows()) {
          win.webContents.send("session:created", { sessionKey, chatId });
        }
      },
    },
  );

  state.gatewayWsClient.start();
  appChannelManager.register(new GatewayChannel(state.gatewayWsClient));
  const rows = appSessions.list();
  state.gatewayWsClient.syncSessions(rows.map((r) => r.key));
  console.log("[main] Gateway remote enabled:", gwCfg.url);
}

export function registerGatewayRemoteIpc(state: GatewayRemoteState): void {
  console.log("[main] registerGatewayRemoteIpc");

  safeIpcHandle("gateway:get-remote-enabled", async () => {
    const email = resolveAccountEmail(state)
    const needsLogin =
      state.appConfig?.gateway?.remoteEnabled === true
      && requiresGatewayAccountEmail()
      && !email
    return {
      enabled: state.appConfig?.gateway?.remoteEnabled === true,
      envConfigured: isGatewayConfigured(state),
      configured: isGatewayConfigured(state),
      connected: state.gatewayWsClient?.status.connected ?? false,
      lastError: state.gatewayWsClient?.status.lastError,
      needsLogin,
    }
  });

  safeIpcHandle("gateway:get-connection-settings", async () => {
    const stored = state.appConfig?.gateway ?? {};
    const merged = resolveGatewayConfig(state);
    const local = useLocalGateway()
    return {
      host: CATBUDDY_GATEWAY_HOST,
      mode: connectionMode(state),
      useLocal: local,
      url: merged?.url ?? resolveBuiltinGatewayWsUrl(local),
      hasSecret: true,
      configured: isGatewayConfigured(state),
      envOverridesUrl: !!process.env.GATEWAY_URL?.trim(),
      envOverridesSecret: !!process.env.GATEWAY_SECRET?.trim(),
      selfHostCustom: connectionMode(state) === 'custom',
    };
  });

  safeIpcHandle(
    "gateway:set-connection-settings",
    async (_event, payload: { url?: string; secret?: string; clearCustom?: boolean }) => {
      if (!state.appConfig.gateway) state.appConfig.gateway = {};
      if (payload.clearCustom) {
        delete state.appConfig.gateway.url;
        delete state.appConfig.gateway.secret;
      } else {
        if (payload.url !== undefined) {
          state.appConfig.gateway.url = String(payload.url).trim();
        }
        if (payload.secret !== undefined) {
          const next = String(payload.secret).trim();
          if (next) state.appConfig.gateway.secret = next;
        }
      }
      persistConfig(state);
      applyGatewayRemote(state);
      return {
        ok: true,
        configured: isGatewayConfigured(state),
        connected: state.gatewayWsClient?.status.connected ?? false,
      };
    },
  );

  safeIpcHandle(
    "gateway:set-account-email",
    async (_event, { email }: { email?: string }) => {
      console.log("[main] gateway:set-account-email", email);
      const normalized = String(email || "").trim().toLowerCase();
      state.gatewayAccountEmail = normalized.includes("@")
        ? normalized
        : undefined;
      if (!state.appConfig.gateway) state.appConfig.gateway = {};
      state.appConfig.gateway.accountEmail = state.gatewayAccountEmail;
      persistConfig(state);
      applyGatewayRemote(state);
      return { ok: true, accountEmail: state.gatewayAccountEmail ?? null };
    },
  );

  safeIpcHandle(
    "gateway:set-remote-enabled",
    async (_event, { enabled }: { enabled?: boolean }) => {
      console.log("[main] gateway:set-remote-enabled", enabled);
      if (!state.appConfig.gateway) state.appConfig.gateway = {};
      state.appConfig.gateway.remoteEnabled = !!enabled;
      persistConfig(state);
      applyGatewayRemote(state);
      return {
        enabled: state.appConfig.gateway.remoteEnabled === true,
        connected: state.gatewayWsClient?.status.connected ?? false,
      };
    },
  );
}
