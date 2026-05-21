/**
 * Electron 主进程入口
 */
import { app, BrowserWindow , Menu } from "electron";
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
import { ChannelManager, DesktopChannel } from "./channels/index.js";
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// 按优先级加载 .env（延迟到 app ready 后）

let mainWindow: BrowserWindow | null = null;
let agentLoop: AgentLoop | null = null;
let sessions: SessionManager | null = null;
let bus: MessageBus | null = null;
let channelManager: ChannelManager | null = null;

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

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.webContents.openDevTools();
  }

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

  // ── Bus + ChannelDispatcher（未来多管道的基础设施） ──
  bus = new MessageBus();
  channelManager = new ChannelManager(bus);
  channelManager.register(new DesktopChannel());

  const provider = createProvider(config);
  agentLoop = new AgentLoop({
    provider,
    workspace,
    model: config.agents.defaults.model,
    maxIterations: config.agents.defaults.maxToolIterations,
    maxMessages: config.agents.defaults.maxMessages,
    contextWindowTokens: config.agents.defaults.contextWindowTokens,
    restrictToWorkspace: config.tools.restrictToWorkspace,
    sessionManager: sessions,
    bus,  // ← 注入 bus，开启 multi-channel 支持
  });
  registerIpcHandlers(agentLoop, sessions, config);

  // 启动 bus 驱动的后台循环
  channelManager.start();
  agentLoop.run().catch((err) =>
    console.error("[main] AgentLoop.run() crashed:", err)
  );
  log.success("[main] Backend initialized successfully");
}

app.whenReady().then(async () => {
  // 0. 加载 .env
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
