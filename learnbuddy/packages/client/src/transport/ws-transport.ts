import type { ConnectionStatus, InboundEvent, Outbound } from "@learnbuddy/shared";
import type { AgentTransport, TransportCallbacks } from "./types";

function isInboundEvent(value: unknown): value is InboundEvent {
  return (
    !!value
    && typeof value === "object"
    && "event" in value
    && typeof (value as InboundEvent).event === "string"
  );
}

/**
 * WebSocket transport for a future browser build (gateway / webui protocol).
 * Wire format: JSON InboundEvent inbound, Outbound outbound.
 */
export class WsTransport implements AgentTransport {
  readonly kind = "websocket" as const;

  private socket: WebSocket | null = null;
  private url = "";
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly token: string,
    wsPath: string,
    private readonly baseUrl = "",
  ) {
    this.url = joinWsUrl(baseUrl, wsPath, token);
  }

  attach(callbacks: TransportCallbacks): () => void {
    callbacks.onStatus("connecting");
    this.openSocket(callbacks);
    return () => this.teardown();
  }

  sendMessage(chatId: string, content: string, mediaUrls?: string[]): void {
    const outbound: Outbound = {
      type: "message",
      chat_id: chatId,
      content,
      webui: true,
      ...(mediaUrls?.length
        ? {
            media: mediaUrls.map((data_url) => ({ data_url })),
          }
        : {}),
    };
    this.sendJson(outbound);
  }

  updateUrl(url: string): void {
    this.url = url;
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.teardown();
    }
  }

  private openSocket(callbacks: TransportCallbacks): void {
    this.teardown(false);
    try {
      this.socket = new WebSocket(this.url);
    } catch {
      callbacks.onStatus("error");
      return;
    }

    this.socket.onopen = () => {
      callbacks.onStatus("open");
    };

    this.socket.onmessage = (msg) => {
      try {
        const parsed: unknown = JSON.parse(String(msg.data));
        if (!isInboundEvent(parsed)) return;
        callbacks.onEvent(parsed);
        if (parsed.event === "session_updated") {
          callbacks.onSessionUpdate?.(parsed.chat_id, parsed.scope);
        }
      } catch {
        /* ignore malformed frames */
      }
    };

    this.socket.onerror = () => {
      callbacks.onStatus("error");
    };

    this.socket.onclose = () => {
      callbacks.onStatus("closed");
      this.scheduleReconnect(callbacks);
    };
  }

  private scheduleReconnect(callbacks: TransportCallbacks): void {
    if (this.reconnectTimer) return;
    callbacks.onStatus("reconnecting");
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.openSocket(callbacks);
    }, 2000);
  }

  private sendJson(payload: Outbound): void {
    if (this.socket?.readyState !== WebSocket.OPEN) return;
    this.socket.send(JSON.stringify(payload));
  }

  private teardown(clearReconnect = true): void {
    if (clearReconnect && this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.socket) {
      this.socket.onopen = null;
      this.socket.onmessage = null;
      this.socket.onerror = null;
      this.socket.onclose = null;
      this.socket.close();
      this.socket = null;
    }
  }
}

function joinWsUrl(baseUrl: string, wsPath: string, token: string): string {
  const path = wsPath.startsWith("/") ? wsPath : `/${wsPath}`;
  const q = token ? `?token=${encodeURIComponent(token)}` : "";
  if (baseUrl) {
    const httpBase = baseUrl.replace(/\/$/, "");
    const wsBase = httpBase.replace(/^http/, "ws");
    return `${wsBase}${path}${q}`;
  }
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${window.location.host}${path}${q}`;
}
