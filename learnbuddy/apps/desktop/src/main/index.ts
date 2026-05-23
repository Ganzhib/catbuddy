/**
 * Electron main process entry
 */
import { app, BrowserWindow } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnvFile } from "./utils/index.js";
import { createMainWindow } from "./windows/main-window.js";
import { initAgent } from "./services/init-agent.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let mainWindow: BrowserWindow | null = null;

app.whenReady().then(async () => {
  const envDir = path.join(__dirname, "..");
  if (app.isPackaged) {
    loadEnvFile(path.join(envDir, ".env.production"));
  }
  loadEnvFile(path.join(envDir, ".env"));
  loadEnvFile(path.join(app.getPath("home"), ".learnbuddy.env"));

  mainWindow = createMainWindow();
  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  await initAgent();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createMainWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
