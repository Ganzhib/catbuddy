/**
 * Fan-out Agent outbound events to Gateway as ui_event (for Web clients).
 */
import type { FileEditEvent, OutboundMessage, ToolEvent, TurnCompleteData } from "@learnbuddy/shared";
import type { GatewayWsClient } from "../sync/gateway-ws-client.js";
import { toolEventToUiHint } from "../sync/tool-event-map.js";
import type { BaseChannel } from "./base";

export class GatewayChannel implements BaseChannel {
  readonly name = "gateway";
  readonly displayName = "gateway";

  private _running = false;

  constructor(private readonly gateway: GatewayWsClient) {}

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
    this.gateway.publishSessionsSync();
    this.gateway.publishThreadSnapshot(this.sessionKey(chatId));
  }

  private sessionKey(chatId: string): string {
    return chatId.startsWith("desktop:") ? chatId : `desktop:${chatId}`;
  }

  private emitSession(chatId: string, event: Record<string, unknown>): void {
    const sessionKey = this.sessionKey(chatId);
    this.gateway.publishUiEvent(sessionKey, chatId, event);
  }

  private emit(msg: OutboundMessage, event: Record<string, unknown>): void {
    this.emitSession(msg.chatId, event);
  }
}
