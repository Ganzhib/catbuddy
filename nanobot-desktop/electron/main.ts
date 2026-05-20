/**
 * Electron 主进程入口
 */
import { app, BrowserWindow, ipcMain, Menu } from "electron";
import path from "node:path";
import { loadEnvFile } from "./utils";
import { fileURLToPath } from "node:url";
import { registerIpcHandlers } from "./ipc/handlers.js";
import { AgentLoop } from "./agent/agent-loop.js";
import { createProvider } from "./providers/factory.js";
import { SessionManager } from "./session/session-manager.js";
import { getDefaultConfig } from "./config/defaults.js";
import { log } from "./utils";
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// 按优先级加载 .env（延迟到 app ready 后）

let mainWindow: BrowserWindow | null = null;
let agentLoop: AgentLoop | null = null;
let sessions: SessionManager | null = null;

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
    title: "nanobot",
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
  const config = getDefaultConfig();
  const home = app.getPath("home");
  const workspace = path.join(home, "workspace");

  // 首次启动时创建配置目录和 config.json
  const configDir = path.join(home, "config");
  const configFile = path.join(configDir, "config.json");

  const fs = await import("node:fs");
  fs.mkdirSync(configDir, { recursive: true });
  fs.writeFileSync(configFile, JSON.stringify(config, null, 2), "utf-8");
  // 将 config_path 写入 config 对象，供前端 Settings 展示
  (config as any).runtime = { config_path: configFile };
  console.log("[main] Config written to:", configFile);

  console.log("[main] Workspace:", workspace);

  sessions = new SessionManager(workspace);

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
  });
  registerIpcHandlers(agentLoop, sessions, config);
  log.success("[main] Backend initialized successfully");
}

app.whenReady().then(async () => {
  // 0. 加载 .env
  loadEnvFile(path.join(__dirname, "../.env"));
  loadEnvFile(path.join(app.getPath("home"), ".nanobot.env"));

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
