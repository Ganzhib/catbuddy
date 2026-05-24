import { BrowserWindow } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { setupApplicationMenu } from "../menu/index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function getPreloadPath(): string {
  return path.join(__dirname, "./preload/index.cjs");
}

function getIconPath(): string {
  return path.join(__dirname, "./assets/icon.png");
}

export function createMainWindow(): BrowserWindow {
  setupApplicationMenu();

  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    title: "Catbuddy",
    autoHideMenuBar: true,
    icon: getIconPath(),
    webPreferences: {
      preload: getPreloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
    show: false,
  });

  win.on("ready-to-show", () => win.show());

  if (process.env.VITE_DEV_SERVER_URL) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    win.loadFile(path.join(__dirname, "../dist/index.html"));
  }

  return win;
}
