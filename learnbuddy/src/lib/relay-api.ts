/**
 * Web-side helpers for cross-device relay (no Electron required).
 * See docs/CROSS_DEVICE_RELAY.md.
 */
import type {
  RelayHttpPairResponse,
  RelayHttpSendResponse,
  RelayServerMessage,
} from "../../shared/relay";
import type { InboundEvent } from "./types";

export interface RelayWebConfig {
  httpBase: string;
  wsUrl: string;
  viewerToken: string;
  deviceId?: string;
}

function httpBaseToWs(base: string): string {
  const trimmed = base.replace(/\/$/, "");
  return trimmed.replace(/^http/, "ws") + "/ws";
}

/** True when the relay-web page is served by Vite dev (use same-origin proxy). */
export function shouldUseRelayDevProxy(): boolean {
  if (typeof window === "undefined") return false;
  const port = window.location.port;
  return import.meta.env.DEV && (port === "5173" || port === "4173");
}

/** Prefer Vite `/relay-api` proxy in dev to avoid CORS (localhost vs 127.0.0.1). */
export function resolveRelayHttpBase(stored?: string): string {
  const raw = stored?.trim();
  if (shouldUseRelayDevProxy()) {
    const direct =
      !raw
      || /^https?:\/\/(127\.0\.0\.1|localhost):18765\/?$/i.test(raw);
    if (direct) return `${window.location.origin}/relay-api`;
  }
  return raw || "http://127.0.0.1:18765";
}

export function relayWsUrlFromHttp(httpBase: string): string {
  if (typeof window !== "undefined" && httpBase.includes("/relay-api")) {
    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    return `${proto}//${window.location.host}/relay-ws/ws`;
  }
  return httpBaseToWs(httpBase);
}

export function relayConfigFromEnv(): RelayWebConfig | null {
  const base = import.meta.env.VITE_RELAY_HTTP_BASE as string | undefined;
  const token = import.meta.env.VITE_RELAY_VIEWER_TOKEN as string | undefined;
  if (!base?.trim() || !token?.trim()) return null;
  const httpBase = base.replace(/\/$/, "");
  const wsUrl =
    (import.meta.env.VITE_RELAY_WS_URL as string | undefined)?.trim()
    || httpBaseToWs(httpBase);
  return {
    httpBase,
    wsUrl,
    viewerToken: token.trim(),
    deviceId: (import.meta.env.VITE_RELAY_DEVICE_ID as string | undefined)?.trim()
      || `web-${crypto.randomUUID().slice(0, 8)}`,
  };
}

export async function pairRelayViewer(
  httpBase: string,
  pairingCode: string,
  viewerToken: string,
): Promise<RelayHttpPairResponse> {
  const res = await fetch(`${httpBase.replace(/\/$/, "")}/api/pair`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pairingCode, token: viewerToken }),
  });
  return res.json() as Promise<RelayHttpPairResponse>;
}

export async function sendRelayMessage(
  httpBase: string,
  sessionKey: string,
  viewerToken: string,
  content: string,
  media?: string[],
): Promise<RelayHttpSendResponse> {
  const encoded = encodeURIComponent(sessionKey);
  const res = await fetch(
    `${httpBase.replace(/\/$/, "")}/api/sessions/${encoded}/messages`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${viewerToken}`,
      },
      body: JSON.stringify({ content, media }),
    },
  );
  return res.json() as Promise<RelayHttpSendResponse>;
}

export type RelayViewerCallbacks = {
  onEvent: (ev: InboundEvent) => void;
  onOpen?: () => void;
  onClose?: () => void;
  onError?: (message: string) => void;
};

/** Subscribe to ui_event stream for a session (Web UI). */
export function connectRelayViewer(
  config: RelayWebConfig,
  sessionKey: string,
  callbacks: RelayViewerCallbacks,
): () => void {
  const ws = new WebSocket(config.wsUrl);

  ws.onopen = () => {
    ws.send(
      JSON.stringify({
        type: "register",
        role: "viewer",
        deviceId: config.deviceId ?? "web-viewer",
        token: config.viewerToken,
      }),
    );
  };

  ws.onmessage = (raw) => {
    let msg: RelayServerMessage;
    try {
      msg = JSON.parse(String(raw.data)) as RelayServerMessage;
    } catch {
      return;
    }
    if (msg.type === "registered") {
      ws.send(JSON.stringify({ type: "subscribe", sessionKey }));
      callbacks.onOpen?.();
      return;
    }
    if (msg.type === "error") {
      callbacks.onError?.(msg.message);
      return;
    }
    if (msg.type === "ui_event") {
      callbacks.onEvent(msg.event as InboundEvent);
    }
  };

  ws.onclose = () => {
    callbacks.onClose?.();
  };

  ws.onerror = () => {
    callbacks.onError?.("websocket_error");
  };

  return () => {
    ws.onopen = null;
    ws.onmessage = null;
    ws.onclose = null;
    ws.onerror = null;
    ws.close();
  };
}
