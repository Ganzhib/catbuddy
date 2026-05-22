import type { ConnectionStatus, InboundEvent } from "@learnbuddy/shared";

export type TransportKind = "ipc" | "websocket";

export type SessionUpdateScope = "metadata" | "thread" | string;

/** Callbacks from a transport into learnbuddyClient (UI contract unchanged). */
export interface TransportCallbacks {
  getActiveChatId: () => string;
  onEvent: (ev: InboundEvent) => void;
  onStatus: (status: ConnectionStatus) => void;
  onSessionUpdate?: (chatId: string, scope?: SessionUpdateScope) => void;
  onGoHome?: () => void;
  /** HTTP send to gateway failed (e.g. desktop executor offline). */
  onSendError?: (code: string) => void;
}

/**
 * Pluggable agent event pipe: Electron IPC today, WebSocket for a future web build.
 * Emits the same InboundEvent shapes the UI already consumes.
 */
export interface AgentTransport {
  readonly kind: TransportKind;

  /** Subscribe to backend → UI events. Returns teardown. */
  attach(callbacks: TransportCallbacks): () => void;

  sendMessage(chatId: string, content: string, mediaUrls?: string[]): void;

  /** Relay: subscribe to ``desktop:{chatId}`` before events arrive. */
  ensureSession?(chatId: string): void;

  /** WebSocket-only: switch gateway URL after bootstrap. */
  updateUrl?(url: string): void;
}

export interface CreateTransportOptions {
  mode?: "auto" | "desktop" | "web" | "gateway" | "relay";
  token: string;
  wsPath: string;
  /** HTTP base for learnbuddy gateway (e.g. ``/gateway-api`` or ``http://127.0.0.1:18765``). */
  gatewayHttpBase?: string;
  /** @deprecated Use gatewayHttpBase */
  relayHttpBase?: string;
}
