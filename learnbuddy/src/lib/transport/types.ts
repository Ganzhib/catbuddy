import type { ConnectionStatus, InboundEvent } from "@/lib/types";

export type TransportKind = "ipc" | "websocket";

export type SessionUpdateScope = "metadata" | "thread" | string;

/** Callbacks from a transport into learnbuddyClient (UI contract unchanged). */
export interface TransportCallbacks {
  getActiveChatId: () => string;
  onEvent: (ev: InboundEvent) => void;
  onStatus: (status: ConnectionStatus) => void;
  onSessionUpdate?: (chatId: string, scope?: SessionUpdateScope) => void;
  onGoHome?: () => void;
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

  /** WebSocket-only: switch gateway URL after bootstrap. */
  updateUrl?(url: string): void;
}

export interface CreateTransportOptions {
  mode?: "auto" | "desktop" | "web";
  token: string;
  wsPath: string;
}
