import { app, BrowserWindow, ipcMain, shell } from "electron";
import type { DesktopUpdateStatus } from "@catbuddy/shared";

const RELEASE_API_URL = "https://api.github.com/repos/Ganzhib/catbuddy/releases/latest";
const RELEASE_DOWNLOAD_BASE = "https://github.com/Ganzhib/catbuddy/releases/download";
const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;

interface GitHubRelease {
  tag_name: string;
  assets: Array<{ name: string; state: string }>;
}

function installerName(): string | null {
  if (process.platform === "win32" && process.arch === "x64") {
    return "catbuddy-windows-x64.exe";
  }
  if (process.platform === "darwin" && process.arch === "arm64") {
    return "catbuddy-macos-arm64.dmg";
  }
  if (process.platform === "darwin" && process.arch === "x64") {
    return "catbuddy-macos-x64.dmg";
  }
  return null;
}

function versionParts(version: string): [number, number, number] | null {
  const match = /^v?(\d+)\.(\d+)\.(\d+)$/.exec(version);
  return match ? [Number(match[1]), Number(match[2]), Number(match[3])] : null;
}

function isNewerVersion(
  latest: [number, number, number],
  current: [number, number, number],
): boolean {
  for (let index = 0; index < 3; index += 1) {
    if (latest[index] > current[index]) return true;
    if (latest[index] < current[index]) return false;
  }
  return false;
}

let status: DesktopUpdateStatus = {
  state: app.isPackaged && installerName() ? "idle" : "unsupported",
  currentVersion: app.getVersion(),
};
let downloadUrl: string | null = null;
let inFlightCheck: Promise<DesktopUpdateStatus> | null = null;

function publishStatus(next: DesktopUpdateStatus): DesktopUpdateStatus {
  status = next;
  for (const window of BrowserWindow.getAllWindows()) {
    window.webContents.send("app:update-status-changed", next);
  }
  return next;
}

export function getDesktopUpdateStatus(): DesktopUpdateStatus {
  return status;
}

export function checkForDesktopUpdate(): Promise<DesktopUpdateStatus> {
  const assetName = installerName();
  if (!app.isPackaged || !assetName) return Promise.resolve(status);
  if (inFlightCheck) return inFlightCheck;

  const previousStatus = status;
  if (previousStatus.state !== "available") {
    publishStatus({ state: "checking", currentVersion: app.getVersion() });
  }
  inFlightCheck = (async () => {
    try {
      const response = await fetch(RELEASE_API_URL, {
        headers: {
          Accept: "application/vnd.github+json",
          "User-Agent": "catbuddy-desktop",
        },
        signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) throw new Error(`GitHub release request failed: ${response.status}`);

      const release = (await response.json()) as GitHubRelease;
      const latest = versionParts(release.tag_name);
      const current = versionParts(app.getVersion());
      if (!latest || !current) throw new Error("Release or installed version is not x.y.z");

      if (!isNewerVersion(latest, current)) {
        downloadUrl = null;
        return publishStatus({ state: "current", currentVersion: app.getVersion() });
      }

      const installer = release.assets.find((asset) => asset.name === assetName && asset.state === "uploaded");
      if (!installer) throw new Error(`Release ${release.tag_name} has no ${assetName} installer`);

      // 仅拼接固定 GitHub 仓库与已验证的版本号、资产名，不打开 API 返回的任意 URL。
      downloadUrl = `${RELEASE_DOWNLOAD_BASE}/${release.tag_name}/${assetName}`;
      return publishStatus({
        state: "available",
        currentVersion: app.getVersion(),
        latestVersion: release.tag_name.replace(/^v/, ""),
      });
    } catch (error) {
      console.warn("[update] Failed to check desktop release:", error);
      if (previousStatus.state === "available" && downloadUrl) {
        return publishStatus(previousStatus);
      }
      downloadUrl = null;
      return publishStatus({ state: "error", currentVersion: app.getVersion() });
    }
  })().finally(() => {
    inFlightCheck = null;
  });

  return inFlightCheck;
}

export function registerDesktopUpdateHandlers(): void {
  ipcMain.handle("app:update-status", () => getDesktopUpdateStatus());
  ipcMain.handle("app:update-check", () => checkForDesktopUpdate());
  ipcMain.handle("app:update-download", async () => {
    if (status.state !== "available" || !downloadUrl) {
      throw new Error("No desktop update is available");
    }
    await shell.openExternal(downloadUrl);
  });
}

export function startDesktopUpdateChecks(): void {
  if (status.state === "unsupported") return;
  void checkForDesktopUpdate();
  const interval = setInterval(() => void checkForDesktopUpdate(), CHECK_INTERVAL_MS);
  interval.unref();
  app.once("before-quit", () => clearInterval(interval));
}
