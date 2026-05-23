import * as fs from "node:fs";
import { app, BrowserWindow, ipcMain } from "electron";
import {
  GatewayDesktopClient,
  loadGatewayConfigFromSources,
} from "@learnbuddy/gateway-sdk-desktop";
import {
  LEARNBUDDY_GATEWAY_HOST,
  resolveBuiltinGatewayWsUrl,
  type learnbuddyConfig,
} from "@learnbuddy/shared";
import type { MessageBus } from "../bus/index.js";
import type { ChannelManager } from "../channels/index.js";
import { GatewayChannel } from "../channels/index.js";
import type { SessionManager } from "../session/session-manager.js";
import { buildWebuiThreadFromSession } from "../sync/session-thread.js";

export interface GatewayRemoteState {
  gatewayWsClient: GatewayDesktopClient | null;
  gatewayAccountEmail: string | undefined;
  appConfig: learnbuddyConfig;
  appConfigFile: string;
  appSessions: SessionManager | null;
  appBus: MessageBus | null;
  appChannelManager: ChannelManager | null;
}

function useLocalGateway(): boolean {
  const flag = process.env.LEARNBUDDY_GATEWAY_USE_LOCAL?.trim()
  if (flag === 'true' || flag === '1') return true
  if (flag === 'false' || flag === '0') return false
  return !app.isPackaged
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

function persistConfig(state: GatewayRemoteState): void {
  fs.writeFileSync(
    state.appConfigFile,
    JSON.stringify(state.appConfig, null, 2),
    "utf-8",
  );
}

export function applyGatewayRemote(state: GatewayRemoteState): void {
  const {
    appConfig,
    appSessions,
    appBus,
    appChannelManager,
    gatewayAccountEmail,
  } = state;

  if (state.gatewayWsClient) {
    state.gatewayWsClient.stop();
    appChannelManager?.unregister("gateway");
    state.gatewayWsClient = null;
  }

  const gwCfg = resolveGatewayConfig(state);
  const remoteEnabled = appConfig?.gateway?.remoteEnabled === true;
  if (!gwCfg || !remoteEnabled || !appChannelManager || !appSessions || !appBus) {
    if (gwCfg && !remoteEnabled) {
      console.log("[main] Gateway ready but remote control is off");
    }
    return;
  }

  const email =
    gatewayAccountEmail?.trim() || gwCfg.accountEmail?.trim() || undefined;

  state.gatewayWsClient = new GatewayDesktopClient(
    { ...gwCfg, accountEmail: email },
    {
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
  ipcMain.handle("gateway:get-remote-enabled", async () => ({
    enabled: state.appConfig?.gateway?.remoteEnabled === true,
    envConfigured: isGatewayConfigured(state),
    configured: isGatewayConfigured(state),
    connected: state.gatewayWsClient?.status.connected ?? false,
  }));

  ipcMain.handle("gateway:get-connection-settings", async () => {
    const stored = state.appConfig?.gateway ?? {};
    const merged = resolveGatewayConfig(state);
    const local = useLocalGateway()
    return {
      host: LEARNBUDDY_GATEWAY_HOST,
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

  ipcMain.handle(
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

  ipcMain.handle(
    "gateway:set-account-email",
    async (_event, { email }: { email?: string }) => {
      const normalized = String(email || "").trim().toLowerCase();
      state.gatewayAccountEmail = normalized.includes("@")
        ? normalized
        : undefined;
      applyGatewayRemote(state);
      return { ok: true, accountEmail: state.gatewayAccountEmail ?? null };
    },
  );

  ipcMain.handle(
    "gateway:set-remote-enabled",
    async (_event, { enabled }: { enabled?: boolean }) => {
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
