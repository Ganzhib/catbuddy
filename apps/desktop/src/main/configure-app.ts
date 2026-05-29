/**
 * Electron startup: dedicated userData + single instance (avoids Windows cache 0x5).
 */
import { app } from "electron";
import fs from "node:fs";
import path from "node:path";

export function configureElectronApp(): boolean {
  const profileDir = app.isPackaged ? "electron" : "electron-dev";
  const userData = path.join(app.getPath("home"), ".catbuddy", profileDir);
  fs.mkdirSync(userData, { recursive: true });
  app.setPath("userData", userData);

  const cacheDir = path.join(userData, "Cache");
  fs.mkdirSync(cacheDir, { recursive: true });
  app.commandLine.appendSwitch("disk-cache-dir", cacheDir);
  app.commandLine.appendSwitch("disable-gpu-shader-disk-cache");

  const gotLock = app.requestSingleInstanceLock();
  if (!gotLock) {
    console.warn(`[main] Another Catbuddy ${app.isPackaged ? "packaged" : "dev"} instance is already running. Quitting this process.`);
    app.quit();
    return false;
  }
  return true;
}
