import { app, BrowserWindow, shell } from "electron";
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


  win.on("ready-to-show", () => {
    console.log("[main] Main window ready-to-show");
    win.show();
    win.focus();
  });

  if(!app.isPackaged) {
    win.webContents.on("before-input-event", (_event, input) => {
      if (input.type !== "keyDown") return;
      const toggle =
        input.key === "F12" ||
        (input.control && input.shift && input.key.toLowerCase() === "i");
      if (toggle) win.webContents.toggleDevTools();
    });
  }

  win.webContents.setWindowOpenHandler(({ url }) => {
    try {
      const parsed = new URL(url);
      if (parsed.protocol === "http:" || parsed.protocol === "https:") {
        void shell.openExternal(url);
      }
    } catch {
      // ignore invalid URLs
    }
    return { action: "deny" };
  });

  win.webContents.on("will-navigate", (event, url) => {
    if (url === win.webContents.getURL()) return;
    try {
      const parsed = new URL(url);
      if (parsed.protocol === "http:" || parsed.protocol === "https:") {
        event.preventDefault();
        void shell.openExternal(url);
      }
    } catch {
      event.preventDefault();
    }
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    win.loadFile(path.join(__dirname, "../dist/index.html"));
  }

  return win;
}
