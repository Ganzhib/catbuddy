import { useCallback, useRef } from "react";
import type { UIMessage } from "@catbuddy/shared";
import { attachReasoningChunk } from "./message-tree";

interface StreamBuffer {
  /** ID of the assistant message currently receiving deltas (cleared on ``stream_end``). */
  messageId: string;
}

export type PendingStreamEvent =
  | { kind: "delta"; text: string }
  | { kind: "reasoning"; text: string };

export interface StreamBufferControl {
  buffer: React.MutableRefObject<StreamBuffer | null>;
  pushPendingEvent: (event: PendingStreamEvent) => void;
  schedulePendingStreamFlush: () => void;
  flushPendingStreamEvents: (options?: { closeAnswerSegment?: boolean }) => void;
  clearPendingStreamWork: () => void;
}

/**
 * Buffers streaming delta/reasoning events and flushes them via
 * `requestAnimationFrame` for efficient React rendering.
 *
 * `appendAnswerChunk` is injected so the buffer doesn't need to know
 * about `activeAssistantRef` / `resolveActiveAssistantIndex`.
 */
export function useStreamBuffer(
  appendAnswerChunk: (prev: UIMessage[], chunk: string) => UIMessage[],
  setMessages: React.Dispatch<React.SetStateAction<UIMessage[]>>,
  closeActiveAssistantStream: () => void,
  ensureActivitySegmentId: () => string,
): StreamBufferControl {
  const buffer = useRef<StreamBuffer | null>(null);
  const pendingStreamEventsRef = useRef<PendingStreamEvent[]>([]);
  const streamFrameRef = useRef<number | null>(null);

  const clearPendingStreamWork = useCallback(() => {
    if (streamFrameRef.current !== null) {
      window.cancelAnimationFrame(streamFrameRef.current);
      streamFrameRef.current = null;
    }
    pendingStreamEventsRef.current = [];
  }, []);

  const applyPendingStreamEvents = useCallback(
    (prev: UIMessage[], events: PendingStreamEvent[]): UIMessage[] => {
      let next = prev;
      for (let i = 0; i < events.length; ) {
        const kind = events[i].kind;
        let text = "";
        while (i < events.length && events[i].kind === kind) {
          text += events[i].text;
          i += 1;
        }
        next =
          kind === "delta"
            ? appendAnswerChunk(next, text)
            : attachReasoningChunk(next, text, {
                ensure: ensureActivitySegmentId,
              });
      }
      return next;
    },
    [appendAnswerChunk, ensureActivitySegmentId],
  );

  const flushPendingStreamEvents = useCallback(
    (options?: { closeAnswerSegment?: boolean }) => {
      if (streamFrameRef.current !== null) {
        window.cancelAnimationFrame(streamFrameRef.current);
        streamFrameRef.current = null;
      }
      const events = pendingStreamEventsRef.current;
      if (events.length === 0) {
        if (options?.closeAnswerSegment) closeActiveAssistantStream();
        return;
      }
      pendingStreamEventsRef.current = [];
      setMessages((prev) => {
        const next = applyPendingStreamEvents(prev, events);
        if (options?.closeAnswerSegment) closeActiveAssistantStream();
        return next;
      });
    },
    [applyPendingStreamEvents, closeActiveAssistantStream, setMessages],
  );

  const schedulePendingStreamFlush = useCallback(() => {
    if (streamFrameRef.current !== null) return;
    streamFrameRef.current = window.requestAnimationFrame(() => {
      streamFrameRef.current = null;
      const events = pendingStreamEventsRef.current;
      if (events.length === 0) return;
      pendingStreamEventsRef.current = [];
      setMessages((prev) => applyPendingStreamEvents(prev, events));
    });
  }, [applyPendingStreamEvents, setMessages]);

  const pushPendingEvent = useCallback((event: PendingStreamEvent) => {
    pendingStreamEventsRef.current.push(event);
  }, []);

  return {
    buffer,
    pushPendingEvent,
    schedulePendingStreamFlush,
    flushPendingStreamEvents,
    clearPendingStreamWork,
  };
}
