import type { TurnCompleteData } from "../../../shared/types";
import type { UIFileEdit } from "@/lib/types";
import type { AgentTransport, TransportCallbacks } from "./types";
import { inboundFromFileEdit, inboundFromToolEvent } from "./event-mappers";

export class IpcTransport implements AgentTransport {
  readonly kind = "ipc" as const;

  attach(callbacks: TransportCallbacks): () => void {
    const api = window.learnbuddy;
    if (!api) {
      callbacks.onStatus("error");
      return () => {};
    }

    callbacks.onStatus("connecting");

    const chatId = () => callbacks.getActiveChatId();

    const unsubs = [
      api.onStreamDelta(({ content, streamId }) => {
        callbacks.onEvent({
          event: "delta",
          chat_id: chatId(),
          text: content,
          stream_id: streamId,
        });
      }),

      api.onStreamEnd(({ streamId }) => {
        callbacks.onEvent({
          event: "stream_end",
          chat_id: chatId(),
          stream_id: streamId,
        });
      }),

      api.onTurnComplete((data: TurnCompleteData) => {
        callbacks.onEvent({
          event: "turn_end",
          chat_id: chatId(),
          latency_ms: data.latencyMs,
          tools_used: data.toolsUsed?.length
            ? ([...new Set(data.toolsUsed)] as string[])
            : undefined,
        });
        callbacks.onEvent({
          event: "goal_status",
          chat_id: chatId(),
          status: "idle",
        });
      }),

      api.onReasoningDelta(({ content }) => {
        callbacks.onEvent({
          event: "reasoning_delta",
          chat_id: chatId(),
          text: content,
        });
      }),

      api.onReasoningEnd(() => {
        callbacks.onEvent({
          event: "reasoning_end",
          chat_id: chatId(),
        });
      }),

      api.onToolProgress((data) => {
        callbacks.onEvent(inboundFromToolEvent(chatId(), data));
      }),

      api.onFileEdit?.((edit) => {
        callbacks.onEvent(
          inboundFromFileEdit(chatId(), edit as UIFileEdit),
        );
      }),

      api.onRetryWait(({ message }) => {
        callbacks.onEvent({
          event: "message",
          chat_id: chatId(),
          text: message,
          kind: "progress",
        });
      }),

      api.onAssistantMessage?.(({ text }) => {
        callbacks.onEvent({
          event: "message",
          chat_id: chatId(),
          text,
        });
      }),

      api.onSystemMessage(({ text }) => {
        callbacks.onEvent({
          event: "message",
          chat_id: chatId(),
          text,
          kind: "progress",
        });
        if (text === "Started a new conversation.") {
          callbacks.onSessionUpdate?.(chatId(), "thread");
          callbacks.onGoHome?.();
        }
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
