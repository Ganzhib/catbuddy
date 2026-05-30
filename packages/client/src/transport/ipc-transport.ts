import type { TurnCompleteData, UIFileEdit } from "@catbuddy/shared";
import type { CatbuddyPreloadApi } from "@catbuddy/platform";
import type { AgentTransport, TransportCallbacks } from "./types";
import { inboundFromFileEdit, inboundFromToolEvent } from "./event-mappers";

type StreamDeltaPayload = Parameters<
  Parameters<CatbuddyPreloadApi["onStreamDelta"]>[0]
>[0];
type StreamEndPayload = Parameters<
  Parameters<CatbuddyPreloadApi["onStreamEnd"]>[0]
>[0];
type TurnCompletePayload = Parameters<
  Parameters<CatbuddyPreloadApi["onTurnComplete"]>[0]
>[0];
type ReasoningDeltaPayload = Parameters<
  Parameters<CatbuddyPreloadApi["onReasoningDelta"]>[0]
>[0];
type ReasoningEndPayload = Parameters<
  Parameters<CatbuddyPreloadApi["onReasoningEnd"]>[0]
>[0];
type ToolProgressPayload = Parameters<
  Parameters<CatbuddyPreloadApi["onToolProgress"]>[0]
>[0];
type FileEditPayload = Parameters<
  Parameters<NonNullable<CatbuddyPreloadApi["onFileEdit"]>>[0]
>[0];
type RetryWaitPayload = Parameters<
  Parameters<NonNullable<CatbuddyPreloadApi["onRetryWait"]>>[0]
>[0];
type AssistantMessagePayload = Parameters<
  Parameters<NonNullable<CatbuddyPreloadApi["onAssistantMessage"]>>[0]
>[0];
type SystemMessagePayload = Parameters<
  Parameters<CatbuddyPreloadApi["onSystemMessage"]>[0]
>[0];
type GatewayInboundPayload = Parameters<
  Parameters<NonNullable<CatbuddyPreloadApi["onGatewayInbound"]>>[0]
>[0];
type SessionCreatedPayload = Parameters<
  Parameters<NonNullable<CatbuddyPreloadApi["onSessionCreated"]>>[0]
>[0];
type SessionDeletedPayload = Parameters<
  Parameters<NonNullable<CatbuddyPreloadApi["onSessionDeleted"]>>[0]
>[0];

function chatIdFromPayload(
  data: { chatId?: string },
  fallback: () => string,
): string {
  const id = data.chatId?.trim();
  return id || fallback();
}

export class IpcTransport implements AgentTransport {
  readonly kind = "ipc" as const;

  attach(callbacks: TransportCallbacks): () => void {
    const api = window.catbuddy;
    if (!api) {
      callbacks.onStatus("error");
      return () => {};
    }

    callbacks.onStatus("connecting");

    const activeChatId = () => callbacks.getActiveChatId();

    const unsubs = [
      api.onStreamDelta((data: StreamDeltaPayload) => {
        callbacks.onEvent({
          event: "delta",
          chat_id: chatIdFromPayload(data, activeChatId),
          text: data.content,
          stream_id: data.streamId,
        });
      }),

      api.onStreamEnd((data: StreamEndPayload) => {
        callbacks.onEvent({
          event: "stream_end",
          chat_id: chatIdFromPayload(data, activeChatId),
          stream_id: data.streamId,
        });
      }),

      api.onTurnComplete((data: TurnCompletePayload) => {
        const chat_id = chatIdFromPayload(data, activeChatId);
        const { chatId: _c, ...turn } = data;
        callbacks.onEvent({
          event: "turn_end",
          chat_id,
          latency_ms: turn.latencyMs,
          usage: turn.usage,
          tools_used: turn.toolsUsed?.length
            ? ([...new Set(turn.toolsUsed)] as string[])
            : undefined,
        });
        callbacks.onEvent({
          event: "goal_status",
          chat_id,
          status: "idle",
        });
      }),

      api.onReasoningDelta((data: ReasoningDeltaPayload) => {
        callbacks.onEvent({
          event: "reasoning_delta",
          chat_id: chatIdFromPayload(data, activeChatId),
          text: data.content,
        });
      }),

      api.onReasoningEnd((data: ReasoningEndPayload) => {
        callbacks.onEvent({
          event: "reasoning_end",
          chat_id: chatIdFromPayload(data, activeChatId),
        });
      }),

      api.onToolProgress((data: ToolProgressPayload) => {
        const chat_id = chatIdFromPayload(data, activeChatId);
        const { chatId: _c, ...tool } = data;
        callbacks.onEvent(inboundFromToolEvent(chat_id, tool));
      }),

      api.onFileEdit?.((data: FileEditPayload) => {
        const chat_id = chatIdFromPayload(data, activeChatId);
        const { chatId: _c, ...edit } = data;
        callbacks.onEvent(
          inboundFromFileEdit(chat_id, edit as UIFileEdit),
        );
      }),

      api.onRetryWait?.((data: RetryWaitPayload) => {
        callbacks.onEvent({
          event: "message",
          chat_id: chatIdFromPayload(data, activeChatId),
          text: data.message,
          kind: "progress",
        });
      }),

      api.onAssistantMessage?.((data: AssistantMessagePayload) => {
        callbacks.onEvent({
          event: "message",
          chat_id: chatIdFromPayload(data, activeChatId),
          text: data.text,
        });
      }),

      api.onSystemMessage((data: SystemMessagePayload) => {
        callbacks.onEvent({
          event: "message",
          chat_id: chatIdFromPayload(data, activeChatId),
          text: data.text,
          kind: "progress",
        });
        if (data.text === "Started a new conversation.") {
          callbacks.onSessionUpdate?.(chatIdFromPayload(data, activeChatId), "thread");
          callbacks.onGoHome?.();
        }
      }),

      api.onGatewayInbound?.((data: GatewayInboundPayload) => {
        const chat_id = data.chatId?.trim();
        if (!chat_id || !data.content?.trim()) return;
        callbacks.onEvent({
          event: "user_inbound",
          chat_id,
          text: data.content,
        });
      }),

      api.onSessionCreated?.((data: SessionCreatedPayload) => {
        const chat_id = data.chatId?.trim();
        if (!chat_id) return;
        callbacks.onSessionUpdate?.(chat_id, "focus");
      }),

      api.onSessionDeleted?.((data: SessionDeletedPayload) => {
        const sessionKey = data.sessionKey?.trim();
        if (!sessionKey) return;
        callbacks.onSessionUpdate?.(sessionKey, "deleted");
      }),
    ];

    callbacks.onStatus("open");
    return () => {
      for (const fn of unsubs) fn();
    };
  }

  sendMessage(chatId: string, content: string, mediaUrls?: string[], workspaceFolderId?: string | null): void {
    window.catbuddy?.sendMessage(chatId, content, mediaUrls, workspaceFolderId);
  }

  ensureSession(chatId: string, workspaceFolderId?: string | null): void {
    const id = chatId.trim();
    if (!id) return;
    const payload: { chatId: string; workspaceFolderId?: string | null } = { chatId: id };
    if (workspaceFolderId !== undefined) payload.workspaceFolderId = workspaceFolderId;
    void window.catbuddy?.gatewaySubscribeSession(payload);
  }
}
