/**
 * Electron 主进程入口
 */
import { app, BrowserWindow, ipcMain, Menu } from "electron";
import path from "node:path";
import { loadEnvFile } from "./utils";
import { fileURLToPath } from "node:url";
import { registerIpcHandlers } from "./ipc/handlers.js";
import { AgentLoop } from "./agent/loop.js";
import { createProvider } from "./providers";
import { SessionManager } from "./session/session-manager.js";
import { getDefaultConfig } from "./config/defaults.js";
import { log } from "./utils";
import { MessageBus } from "./bus/index.js";
import { ChannelManager, DesktopChannel, GatewayChannel } from "./channels/index.js";
import {
  GatewayDesktopClient,
  loadGatewayConfigFromEnv,
} from "@learnbuddy/gateway-sdk-desktop";
import { buildWebuiThreadFromSession } from "./sync/session-thread.js";
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// 按优先级加载 .env（延迟到 app ready 后）

let mainWindow: BrowserWindow | null = null;
let agentLoop: AgentLoop | null = null;
let sessions: SessionManager | null = null;
let bus: MessageBus | null = null;
let channelManager: ChannelManager | null = null;
let gatewayWsClient: GatewayDesktopClient | null = null;
let appConfig: any = null;
let appConfigFile = "";
let appSessions: SessionManager | null = null;
let appBus: MessageBus | null = null;
let appChannelManager: ChannelManager | null = null;
/** Same email as Web JWT (set from renderer after login or GATEWAY_ACCOUNT_EMAIL). */
let gatewayAccountEmail: string | undefined;

function applyGatewayRemote(): void {
  if (gatewayWsClient) {
    gatewayWsClient.stop();
    appChannelManager?.unregister("gateway");
    gatewayWsClient = null;
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
    gatewayAccountEmail?.trim()
    || gwCfg.accountEmail?.trim()
    || undefined;
  gatewayWsClient = new GatewayDesktopClient(
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
        gatewayWsClient!.focusSession(sessionKey);
        console.log("[main] Gateway create_session:", sessionKey);
        for (const win of BrowserWindow.getAllWindows()) {
          win.webContents.send("session:created", { sessionKey, chatId });
        }
      },
    },
  );
  gatewayWsClient.start();
  appChannelManager.register(new GatewayChannel(gatewayWsClient));
  const rows = appSessions.list();
  gatewayWsClient.syncSessions(rows.map((r) => r.key));
  console.log("[main] Gateway remote enabled:", gwCfg.url);
}

function registerGatewayRemoteIpc(): void {
  ipcMain.handle("gateway:get-remote-enabled", async () => ({
    enabled: appConfig?.gateway?.remoteEnabled === true,
    envConfigured: !!loadGatewayConfigFromEnv(),
    connected: gatewayWsClient?.status.connected ?? false,
  }));

  ipcMain.handle(
    "gateway:set-account-email",
    async (_event, { email }: { email?: string }) => {
      const normalized = String(email || "").trim().toLowerCase();
      gatewayAccountEmail = normalized.includes("@") ? normalized : undefined;
      applyGatewayRemote();
      return { ok: true, accountEmail: gatewayAccountEmail ?? null };
    },
  );

  ipcMain.handle(
    "gateway:set-remote-enabled",
    async (_event, { enabled }: { enabled?: boolean }) => {
      if (!appConfig.gateway) appConfig.gateway = {};
      appConfig.gateway.remoteEnabled = !!enabled;
      const fs = await import("node:fs");
      fs.writeFileSync(appConfigFile, JSON.stringify(appConfig, null, 2), "utf-8");
      applyGatewayRemote();
      return {
        enabled: appConfig.gateway.remoteEnabled === true,
        connected: gatewayWsClient?.status.connected ?? false,
      };
    },
  );
}

function getPreloadPath(): string {
  return path.join(__dirname, "./preload.cjs");
}

function createWindow() {
  const preloadPath = getPreloadPath();

  Menu.setApplicationMenu(null);

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    title: "learnbuddy",
    autoHideMenuBar: true,
    icon: path.join(__dirname, "../electron/assets/icon.png"),
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
    show: false,
  });

  // if (process.env.VITE_DEV_SERVER_URL) {
  //   mainWindow.webContents.openDevTools();
  // }

  mainWindow.on("ready-to-show", () => mainWindow?.show());
  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
  }
}

async function initAgent() {
  // 工作区域: ~/.learnbuddy-desktop
  const home = app.getPath("home");
  const learnbuddyDir = path.join(home, ".learnbuddy-desktop");
  const workspace = path.join(learnbuddyDir, "workspace");
  const configFile = path.join(learnbuddyDir, "config", "config.json");

  const fs = await import("node:fs");
  fs.mkdirSync(path.dirname(configFile), { recursive: true });

  // 优先读取已有 config.json，首次启动时生成默认配置
  let config: any;
  if (fs.existsSync(configFile)) {
    config = JSON.parse(fs.readFileSync(configFile, "utf-8"));
    console.log("[main] Config loaded from:", configFile);
  } else {
    config = getDefaultConfig();
    // 用真实路径覆写默认 workspace
    config.workspace = workspace.replace(/\\/g, "/");
    fs.writeFileSync(configFile, JSON.stringify(config, null, 2), "utf-8");
    console.log("[main] Config written to:", configFile);
  }

  // 将 config_path 写入 config 对象，供前端 Settings 展示
  (config as any).runtime = { config_path: configFile };

  console.log("[main] Workspace:", workspace);

  sessions = new SessionManager(workspace);
  appConfig = config;
  appConfigFile = configFile;
  appSessions = sessions;

  // ── Bus + ChannelDispatcher（未来多管道的基础设施） ──
  bus = new MessageBus();
  appBus = bus;
  channelManager = new ChannelManager(bus);
  appChannelManager = channelManager;
  channelManager.register(new DesktopChannel());

  applyGatewayRemote();
  registerGatewayRemoteIpc();

  const provider = createProvider(config);
  agentLoop = new AgentLoop({
    provider,
    workspace,
    model: config.agents.defaults.model,
    maxIterations: config.agents.defaults.maxToolIterations,
    maxMessages: config.agents.defaults.maxMessages,
    contextWindowTokens: config.agents.defaults.contextWindowTokens,
    restrictToWorkspace: config.tools.restrictToWorkspace,
    disabledSkills: config.agents.defaults.disabledSkills ?? [],
    sessionManager: sessions,
    bus,  // ← 注入 bus，开启 multi-channel 支持
  });
  registerIpcHandlers(agentLoop, sessions, config, configFile, gatewayWsClient);

  // 启动 bus 驱动的后台循环
  channelManager.start();
  agentLoop.run().catch((err) =>
    console.error("[main] AgentLoop.run() crashed:", err)
  );
  log.success("[main] Backend initialized successfully");
}

app.whenReady().then(async () => {
  // 0. 加载 .env（dist-electron → ../../../ = learnbuddy 根；../ = apps/desktop）
  loadEnvFile(path.join(__dirname, "../../../.env"));
  loadEnvFile(path.join(__dirname, "../.env"));
  loadEnvFile(path.join(app.getPath("home"), ".learnbuddy.env"));

  createWindow();

  await initAgent();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {});
