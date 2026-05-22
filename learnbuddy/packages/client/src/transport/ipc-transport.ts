import type { TurnCompleteData, UIFileEdit } from "@learnbuddy/shared";
import type { AgentTransport, TransportCallbacks } from "./types";
import { inboundFromFileEdit, inboundFromToolEvent } from "./event-mappers";

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
    const api = window.learnbuddy;
    if (!api) {
      callbacks.onStatus("error");
      return () => {};
    }

    callbacks.onStatus("connecting");

    const activeChatId = () => callbacks.getActiveChatId();

    const unsubs = [
      api.onStreamDelta((data) => {
        callbacks.onEvent({
          event: "delta",
          chat_id: chatIdFromPayload(data, activeChatId),
          text: data.content,
          stream_id: data.streamId,
        });
      }),

      api.onStreamEnd((data) => {
        callbacks.onEvent({
          event: "stream_end",
          chat_id: chatIdFromPayload(data, activeChatId),
          stream_id: data.streamId,
        });
      }),

      api.onTurnComplete((data) => {
        const chat_id = chatIdFromPayload(data, activeChatId);
        const { chatId: _c, ...turn } = data;
        callbacks.onEvent({
          event: "turn_end",
          chat_id,
          latency_ms: turn.latencyMs,
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

      api.onReasoningDelta((data) => {
        callbacks.onEvent({
          event: "reasoning_delta",
          chat_id: chatIdFromPayload(data, activeChatId),
          text: data.content,
        });
      }),

      api.onReasoningEnd((data) => {
        callbacks.onEvent({
          event: "reasoning_end",
          chat_id: chatIdFromPayload(data, activeChatId),
        });
      }),

      api.onToolProgress((data) => {
        const chat_id = chatIdFromPayload(data, activeChatId);
        const { chatId: _c, ...tool } = data;
        callbacks.onEvent(inboundFromToolEvent(chat_id, tool));
      }),

      api.onFileEdit?.((data) => {
        const chat_id = chatIdFromPayload(data, activeChatId);
        const { chatId: _c, ...edit } = data;
        callbacks.onEvent(
          inboundFromFileEdit(chat_id, edit as UIFileEdit),
        );
      }),

      api.onRetryWait?.((data) => {
        callbacks.onEvent({
          event: "message",
          chat_id: chatIdFromPayload(data, activeChatId),
          text: data.message,
          kind: "progress",
        });
      }),

      api.onAssistantMessage?.((data) => {
        callbacks.onEvent({
          event: "message",
          chat_id: chatIdFromPayload(data, activeChatId),
          text: data.text,
        });
      }),

      api.onSystemMessage((data) => {
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

      api.onRelayInbound?.((data) => {
        const chat_id = data.chatId?.trim();
        if (!chat_id || !data.content?.trim()) return;
        callbacks.onEvent({
          event: "user_inbound",
          chat_id,
          text: data.content,
        });
      }),

      api.onSessionCreated?.((data) => {
        const chat_id = data.chatId?.trim();
        if (!chat_id) return;
        callbacks.onSessionUpdate?.(chat_id, "metadata");
      }),
    ];

    callbacks.onStatus("open");
    return () => {
      for (const fn of unsubs) fn();
    };
  }

  sendMessage(chatId: string, content: string, mediaUrls?: string[]): void {
    window.learnbuddy?.sendMessage(chatId, content, mediaUrls);
  }
}
