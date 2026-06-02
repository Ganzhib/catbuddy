/** Thread cache + pending desktop delete queue. */

export class ThreadCacheManager {
  private readonly threadCache = new Map<string, Record<string, unknown>>();
  private readonly pendingDesktopDeletesByEmail = new Map<string, Set<string>>();

  put(sessionKey: string, payload: Record<string, unknown> | null): void {
    if (!sessionKey || !payload) return;
    this.threadCache.set(sessionKey, payload);
  }

  get(sessionKey: string): Record<string, unknown> | null {
    return this.threadCache.get(sessionKey) ?? null;
  }

  delete(sessionKey: string): void {
    this.threadCache.delete(sessionKey);
  }

  queueDeleteForDesktop(ownerEmail: string, sessionKey: string): void {
    const email = ownerEmail.trim().toLowerCase();
    if (!email.includes('@')) return;
    const key = sessionKey.trim();
    if (!key) return;

    let pending = this.pendingDesktopDeletesByEmail.get(email);
    if (!pending) {
      pending = new Set();
      this.pendingDesktopDeletesByEmail.set(email, pending);
    }
    pending.add(key);
  }

  flushDeletes(ws: import('ws').WebSocket, accountEmail: string): void {
    const email = accountEmail.trim().toLowerCase();
    if (!email.includes('@') || ws.readyState !== 1) return;

    const pending = this.pendingDesktopDeletesByEmail.get(email);
    if (!pending?.size) return;

    for (const sessionKey of pending) {
      ws.send(JSON.stringify({ type: 'delete_session', sessionKey }));
    }
    this.pendingDesktopDeletesByEmail.delete(email);
  }
}
