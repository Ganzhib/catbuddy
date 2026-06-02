import type WebSocket from 'ws'
import type { GatewayClient, GatewayClientRole } from './gateway-state.js'
import { gatewayEnv } from './config/env.js'
import { isWebLoginRequired } from './auth/auth-policy.js'

export class ConnectionRegistry {
  private readonly clients = new Map<string, GatewayClient>()
  private readonly webTokens = new Set<string>()
  private readonly webEmailByToken = new Map<string, string>()
  /** Logged-in account email → online desktop `deviceId`. */
  private readonly deviceIdByAccountEmail = new Map<string, string>()

  // ── Token management ──

  registerWebToken(token: string, webEmail?: string): void {
    if (!token) return;
    this.webTokens.add(token);
    const email = webEmail?.trim().toLowerCase();
    if (email?.includes('@')) this.webEmailByToken.set(token, email);
  }

  getWebEmailForToken(token: string): string | undefined {
    return this.webEmailByToken.get(token);
  }

  isWebAuthorized(token: string): boolean {
    return !!token && this.webTokens.has(token);
  }

  webTokenFromClientKey(clientKey: string): string {
    if (!clientKey.startsWith('web:')) return '';
    const rest = clientKey.slice('web:'.length);
    const lastColon = rest.lastIndexOf(':');
    return lastColon === -1 ? rest : rest.slice(0, lastColon);
  }

  // ── Normalization ──

  normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  // ── Desktop registration ──

  registerDesktop(
    ws: WebSocket,
    deviceId: string,
    token: string,
    accountEmail?: string,
  ): { ok: boolean; error?: string } {
    if (token !== gatewayEnv.desktopSecret) {
      return { ok: false, error: 'unauthorized' };
    }
    const email = accountEmail ? this.normalizeEmail(accountEmail) : '';
    if (isWebLoginRequired() && !email.includes('@')) {
      return { ok: false, error: 'account_email_required' };
    }
    if (email) {
      const prev = this.deviceIdByAccountEmail.get(email);
      if (prev && prev !== deviceId) {
        this.disconnect(`desktop:${prev}`);
      }
      this.deviceIdByAccountEmail.set(email, deviceId);
    }
    const clientKey = `desktop:${deviceId}`;
    this.clients.set(clientKey, {
      ws,
      role: 'desktop',
      deviceId,
      sessions: new Set(),
      clientKey,
      accountEmail: email || undefined,
    });
    return { ok: true };
  }

  // ── Web registration ──

  registerWeb(ws: WebSocket, deviceId: string, token: string, webEmail?: string): {
    ok: boolean;
    error?: string;
  } {
    if (!this.isWebAuthorized(token)) {
      return { ok: false, error: 'unauthorized' };
    }
    const clientKey = `web:${token}:${deviceId}`;
    const email = webEmail || this.getWebEmailForToken(token);
    this.clients.set(clientKey, {
      ws,
      role: 'web',
      deviceId,
      sessions: new Set(),
      clientKey,
      webEmail: email,
    });
    return { ok: true };
  }

  // ── Queries ──

  getClient(clientKey: string): GatewayClient | undefined {
    return this.clients.get(clientKey);
  }

  getDesktopClient(deviceId: string): GatewayClient | null {
    for (const c of this.clients.values()) {
      if (c.role === 'desktop' && c.deviceId === deviceId) return c;
    }
    return null;
  }

  findWebClientByWs(ws: WebSocket): GatewayClient | null {
    for (const c of this.clients.values()) {
      if (c.role === 'web' && c.ws === ws) return c;
    }
    return null;
  }

  getDesktopDeviceIdByEmail(email: string): string | undefined {
    return email.includes('@')
      ? this.deviceIdByAccountEmail.get(this.normalizeEmail(email))
      : undefined;
  }

  /** Route Web traffic to the desktop registered with the same account email. */
  resolveDesktopForWebToken(webToken: string): GatewayClient | null {
    const email = this.getWebEmailForToken(webToken);
    if (email?.includes('@')) {
      const deviceId = this.deviceIdByAccountEmail.get(this.normalizeEmail(email));
      if (!deviceId) return null;
      const client = this.getDesktopClient(deviceId);
      if (client?.ws.readyState === 1) return client;
      return null;
    }
    if (isWebLoginRequired()) return null;
    return this.getFirstOnlineDesktop();
  }

  getFirstOnlineDesktop(): GatewayClient | null {
    for (const c of this.clients.values()) {
      if (c.role === 'desktop' && c.ws.readyState === 1) return c;
    }
    return null;
  }

  // ── Iteration ──

  forEachDesktop(fn: (client: GatewayClient) => void): void {
    for (const c of this.clients.values()) {
      if (c.role === 'desktop') fn(c);
    }
  }

  forEachWebOnline(fn: (client: GatewayClient) => void): void {
    for (const c of this.clients.values()) {
      if (c.role === 'web' && c.ws.readyState === 1) fn(c);
    }
  }

  /** Iterate over web clients whose clientKey starts with the given prefix. */
  forEachWebByTokenPrefix(prefix: string, fn: (client: GatewayClient) => void): void {
    for (const [clientKey, client] of this.clients) {
      if (client.role === 'web' && clientKey.startsWith(prefix)) fn(client);
    }
  }

  // ── Disconnect ──

  disconnect(clientKey: string): {
    role: GatewayClientRole;
    deviceId: string;
    accountEmail?: string;
  } | null {
    const client = this.clients.get(clientKey);
    if (!client) return null;

    if (client.role === 'desktop' && client.accountEmail) {
      const email = this.normalizeEmail(client.accountEmail);
      if (this.deviceIdByAccountEmail.get(email) === client.deviceId) {
        this.deviceIdByAccountEmail.delete(email);
      }
    }

    this.clients.delete(clientKey);
    return {
      role: client.role,
      deviceId: client.deviceId,
      accountEmail: client.accountEmail,
    };
  }

  // ── Stats ──

  countDesktops(): { total: number; online: number } {
    let total = 0;
    let online = 0;
    for (const c of this.clients.values()) {
      if (c.role === 'desktop') {
        total += 1;
        if (c.ws.readyState === 1) online += 1;
      }
    }
    return { total, online };
  }
}
