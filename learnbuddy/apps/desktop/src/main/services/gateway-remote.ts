import { BrowserWindow, ipcMain } from "electron";
import { GatewayDesktopClient, loadGatewayConfigFromEnv } from "@learnbuddy/gateway-sdk-desktop";
import type { MessageBus } from "../bus/index.js";
import type { ChannelManager } from "../channels/index.js";
import { GatewayChannel } from "../channels/index.js";
import type { SessionManager } from "../session/session-manager.js";
import { buildWebuiThreadFromSession } from "../sync/session-thread.js";

export interface GatewayRemoteState {
  gatewayWsClient: GatewayDesktopClient | null;
  gatewayAccountEmail: string | undefined;
  appConfig: any;
  appConfigFile: string;
  appSessions: SessionManager | null;
  appBus: MessageBus | null;
  appChannelManager: ChannelManager | null;
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

  const gwCfg = loadGatewayConfigFromEnv();
  const remoteEnabled = appConfig?.gateway?.remoteEnabled === true;
  if (!gwCfg || !remoteEnabled || !appChannelManager || !appSessions || !appBus) {
    if (gwCfg && !remoteEnabled) {
      console.log("[main] Gateway env set but remote control is off");
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
    envConfigured: !!loadGatewayConfigFromEnv(),
    connected: state.gatewayWsClient?.status.connected ?? false,
  }));

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
      const fs = await import("node:fs");
      fs.writeFileSync(
        state.appConfigFile,
        JSON.stringify(state.appConfig, null, 2),
        "utf-8",
      );
      applyGatewayRemote(state);
      return {
        enabled: state.appConfig.gateway.remoteEnabled === true,
        connected: state.gatewayWsClient?.status.connected ?? false,
      };
    },
  );
}
