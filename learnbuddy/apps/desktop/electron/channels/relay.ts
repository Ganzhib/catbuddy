/**
 * Fan-out Agent outbound events to relay server as ui_event (for Web viewers).
 */
import type { FileEditEvent, OutboundMessage, ToolEvent, TurnCompleteData } from "@learnbuddy/shared";
import type { RelayClient } from "../sync/relay-client.js";
import { toolEventToUiHint } from "../sync/tool-event-map.js";
import type { BaseChannel } from "./base";

export class RelayChannel implements BaseChannel {
  readonly name = "relay";
  readonly displayName = "relay";

  private _running = false;

  constructor(private readonly relay: RelayClient) {}

  get running(): boolean {
    return this._running;
  }

  async start(): Promise<void> {
    this._running = true;
  }

  async stop(): Promise<void> {
    this._running = false;
  }

  async send(msg: OutboundMessage): Promise<void> {
    if (msg.metadata?._progress && msg.content) {
      this.emit(msg, {
        event: "message",
        chat_id: msg.chatId,
        text: msg.content,
        kind: "progress",
      });
    }
  }

  async sendAssistantMessage(chatId: string, text: string): Promise<void> {
    this.emitSession(chatId, {
      event: "message",
      chat_id: chatId,
      text,
    });
  }

  async sendDelta(
    chatId: string,
    delta: string,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    const streamId = (metadata?._stream_id as string) ?? chatId;
    this.emitSession(chatId, {
      event: "delta",
      chat_id: chatId,
      text: delta,
      stream_id: streamId,
    });
  }

  async sendStreamEnd(
    chatId: string,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    const streamId = (metadata?._stream_id as string) ?? "";
    this.emitSession(chatId, {
      event: "stream_end",
      chat_id: chatId,
      stream_id: streamId,
    });
  }

  async sendReasoningDelta(chatId: string, delta: string): Promise<void> {
    this.emitSession(chatId, {
      event: "reasoning_delta",
      chat_id: chatId,
      text: delta,
    });
  }

  async sendReasoningEnd(chatId: string): Promise<void> {
    this.emitSession(chatId, {
      event: "reasoning_end",
      chat_id: chatId,
    });
  }

  async sendToolProgress(chatId: string, event: ToolEvent): Promise<void> {
    this.emitSession(chatId, {
      event: "message",
      chat_id: chatId,
      text: "",
      kind: "tool_hint",
      tool_events: [toolEventToUiHint(event)],
    });
  }

  async sendFileEdit(chatId: string, edit: FileEditEvent): Promise<void> {
    this.emitSession(chatId, {
      event: "file_edit",
      chat_id: chatId,
      edits: [edit as unknown as Record<string, unknown>],
    });
  }

  async sendTurnComplete(chatId: string, data: TurnCompleteData): Promise<void> {
    this.emitSession(chatId, {
      event: "turn_end",
      chat_id: chatId,
      latency_ms: data.latencyMs,
      tools_used: data.toolsUsed?.length
        ? [...new Set(data.toolsUsed)]
        : undefined,
    });
    this.emitSession(chatId, {
      event: "goal_status",
      chat_id: chatId,
      status: "idle",
    });
    this.relay.publishSessionsSync();
    this.relay.publishThreadSnapshot(this.sessionKey(chatId));
  }

  private sessionKey(chatId: string): string {
    return chatId.startsWith("desktop:") ? chatId : `desktop:${chatId}`;
  }

  private emitSession(chatId: string, event: Record<string, unknown>): void {
    const sessionKey = this.sessionKey(chatId);
    this.relay.publishUiEvent(sessionKey, chatId, event);
  }

  private emit(msg: OutboundMessage, event: Record<string, unknown>): void {
    this.emitSession(msg.chatId, event);
  }
}
