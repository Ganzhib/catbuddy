/**
 * Electron main process entry
 */
import { app, BrowserWindow } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { configureElectronApp } from "./configure-app.js";
import { loadEnvFile } from "./utils/index.js";
import { createMainWindow } from "./windows/main-window.js";
import { initAgent } from "./services/init-agent.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envDir = path.join(__dirname, "..");

// Load .env before initAgent / Gateway (whenReady alone is too late for first apply).
if (app.isPackaged) {
  loadEnvFile(path.join(envDir, ".env.production"));
}
loadEnvFile(path.join(envDir, ".env"));

let mainWindow: BrowserWindow | null = null;

const isPrimaryInstance = configureElectronApp();
if (isPrimaryInstance) {
  app.on("second-instance", () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  });
}

app.whenReady().then(async () => {
  if (!isPrimaryInstance) return;
  loadEnvFile(path.join(app.getPath("home"), ".learnbuddy.env"));

  await initAgent();

  mainWindow = createMainWindow();
  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createMainWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
