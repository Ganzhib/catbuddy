/**
 * Cross-device relay protocol (Web UI ↔ relay server ↔ Desktop executor).
 * Wire format: JSON lines or WebSocket text frames of RelayEnvelope.
 */

/** Role of a connected client. */
export type RelayRole = "executor" | "viewer";

/** Client → server */
export type RelayClientMessage =
  | {
      type: "register";
      role: RelayRole;
      deviceId: string;
      token: string;
      pairingCode?: string;
    }
  | {
      type: "subscribe";
      sessionKey: string;
    }
  | {
      type: "unsubscribe";
      sessionKey: string;
    }
  | {
      type: "ping";
    };

/** Server → client */
export type RelayServerMessage =
  | {
      type: "registered";
      deviceId: string;
      role: RelayRole;
      pairingCode?: string;
    }
  | {
      type: "inbound_message";
      sessionKey: string;
      chatId: string;
      content: string;
      media?: string[];
      source: "web" | "relay";
    }
  | {
      type: "ui_event";
      sessionKey: string;
      chatId: string;
      /** Same JSON shape as frontend InboundEvent. */
      event: Record<string, unknown>;
    }
  | {
      type: "executor_status";
      online: boolean;
      deviceId?: string;
    }
  | {
      type: "error";
      message: string;
    }
  | {
      type: "pong";
    };

export type RelayEnvelope = RelayClientMessage | RelayServerMessage;

/** HTTP POST /api/sessions/:sessionKey/messages (Web → relay → desktop). */
export interface RelayHttpSendBody {
  content: string;
  media?: string[];
}

export interface RelayHttpSendResponse {
  ok: boolean;
  queued?: boolean;
  error?: string;
}

/** HTTP POST /api/pair (bind viewer token to executor pairing code). */
export interface RelayHttpPairBody {
  pairingCode: string;
  token: string;
}

export interface RelayHttpPairResponse {
  ok: boolean;
  deviceId?: string;
  error?: string;
}

export const RELAY_DEFAULT_PORT = 18765;
