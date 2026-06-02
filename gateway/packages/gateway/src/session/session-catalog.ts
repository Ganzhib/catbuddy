import type WebSocket from 'ws'
import type { GatewayClient } from './gateway-state.js'
import type { GatewaySessionRow } from './storage/session-types.js'

/** Prevent deleted sessions from being resurrected via sessions_sync / thread_snapshot. */
const DELETED_TOMBSTONE_MS = 7 * 24 * 60 * 60 * 1000

export class SessionCatalog {
  private readonly sessionDesktop = new Map<string, string>()
  private readonly sessionWebSockets = new Map<string, Set<WebSocket>>()
  private readonly sessionCatalogByDevice = new Map<string, GatewaySessionRow[]>()
  private readonly deletedSessions = new Map<string, number>()

  // ── Session → Desktop ──

  bindSessionToDesktop(sessionKey: string, deviceId: string): void {
    if (!sessionKey) return
    this.sessionDesktop.set(sessionKey, deviceId)
  }

  getDesktopForSession(sessionKey: string): string | undefined {
    return this.sessionDesktop.get(sessionKey)
  }

  unbindSessionsForDevice(deviceId: string): void {
    for (const [key, dev] of this.sessionDesktop) {
      if (dev === deviceId) this.sessionDesktop.delete(key)
    }
  }

  // ── Web subscribers ──

  addWebSubscriber(sessionKey: string, ws: WebSocket): void {
    if (!sessionKey) return;
    let set = this.sessionWebSockets.get(sessionKey);
    if (!set) {
      set = new Set();
      this.sessionWebSockets.set(sessionKey, set);
    }
    set.add(ws);
  }

  removeWebSubscriber(sessionKey: string, ws: WebSocket): void {
    this.sessionWebSockets.get(sessionKey)?.delete(ws);
  }

  hasWebSubscribers(sessionKey: string): boolean {
    const set = this.sessionWebSockets.get(sessionKey);
    return !!set && set.size > 0;
  }

  getWebSubscribers(sessionKey: string): Set<WebSocket> | undefined {
    return this.sessionWebSockets.get(sessionKey);
  }

  // ── Catalog per device ──

  setCatalog(deviceId: string, rows: GatewaySessionRow[]): void {
    this.sessionCatalogByDevice.set(deviceId, rows);
  }

  getCatalog(deviceId: string): GatewaySessionRow[] | undefined {
    return this.sessionCatalogByDevice.get(deviceId);
  }

  deleteCatalog(deviceId: string): void {
    this.sessionCatalogByDevice.delete(deviceId);
  }

  removeSessionFromAllCatalogs(sessionKey: string): void {
    if (!sessionKey) return;
    for (const [deviceId, rows] of this.sessionCatalogByDevice) {
      const filtered = rows.filter((row) => row.key !== sessionKey);
      if (filtered.length !== rows.length) {
        this.sessionCatalogByDevice.set(deviceId, filtered);
      }
    }
  }

  // ── Tombstone (deleted sessions) ──

  markDeleted(sessionKey: string): void {
    const key = sessionKey.trim();
    if (!key) return;
    this.deletedSessions.set(key, Date.now());
  }

  isTombstoned(sessionKey: string): boolean {
    const key = sessionKey.trim();
    const ts = this.deletedSessions.get(key);
    if (!ts) return false;
    if (Date.now() - ts > DELETED_TOMBSTONE_MS) {
      this.deletedSessions.delete(key);
      return false;
    }
    return true;
  }

  // ── Cleanup ──

  removeSessionFromRuntime(sessionKey: string): void {
    const key = sessionKey.trim();
    if (!key) return;
    this.sessionDesktop.delete(key);
    this.sessionWebSockets.delete(key);
    this.removeSessionFromAllCatalogs(key);
  }

  collectSessionKeys(): string[] {
    const keys = new Set(this.sessionDesktop.keys());
    return [...keys];
  }

  cleanupWebSubscriptionsForClient(ws: WebSocket): void {
    for (const [key, set] of this.sessionWebSockets) {
      set.delete(ws);
      if (set.size === 0) this.sessionWebSockets.delete(key);
    }
  }
}
