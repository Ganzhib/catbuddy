import { useCallback, useEffect, useRef, useState } from "react";

import { useClient } from "@/providers/ClientProvider";
import { toMediaAttachment } from "@/lib/media";
import type { ToolProgressEvent, GoalStateWsPayload } from "@catbuddy/shared";
import type { StreamError } from "@catbuddy/client";
import type {
  InboundEvent,
  OutboundImageGeneration,
  OutboundMedia,
  UIImage,
  UIMessage,
} from "@catbuddy/shared";

import {
  closeReasoningStream,
  pruneReasoningOnlyPlaceholders,
  stampLastAssistantTurnStats,
  appendToolsUsedSummary,
  optimisticFileEditFromToolStart,
  absorbCompleteAssistantMessage,
  mergeFileEdits,
  mergeFileEditIntoTrace,
  appendToolProgressTrace,
  useStreamBuffer,
  attachReasoningChunk,
  findActiveAssistantPlaceholderIndex,
  findStreamingAssistantIndex,
  replaceMessageAt,
} from "./stream";

interface ActiveAssistantCursor {
  id: string;
  index: number;
}

export interface SendImage {
  media: OutboundMedia;
  preview: UIImage;
}

export interface SendOptions {
  imageGeneration?: OutboundImageGeneration;
}

export function useCatbuddyStream(
  chatId: string | null,
  initialMessages: UIMessage[] = [],
  hasPendingToolCalls = false,
  onTurnEnd?: () => void,
  workspaceFolderId?: string | null,
  onDiagramEvent?: (diagram: import("@catbuddy/shared").UIDiagramEvent) => void,
): {
  messages: UIMessage[];
  isStreaming: boolean;
  runStartedAt: number | null;
  goalState: GoalStateWsPayload | undefined;
  send: (content: string, images?: SendImage[], options?: SendOptions) => void;
  stop: () => void;
  setMessages: React.Dispatch<React.SetStateAction<UIMessage[]>>;
  streamError: StreamError | null;
  dismissStreamError: () => void;
} {
  const { client } = useClient();
  const [messages, setMessages] = useState<UIMessage[]>(initialMessages);
  const initialStreaming = hasPendingToolCalls
    && initialMessages.length > 0
    && initialMessages[initialMessages.length - 1].kind === "trace";
  const [isStreaming, setIsStreaming] = useState(initialStreaming);
  const [runStartedAt, setRunStartedAt] = useState<number | null>(null);
  const [goalState, setGoalState] = useState<GoalStateWsPayload | undefined>(undefined);
  const [streamError, setStreamError] = useState<StreamError | null>(null);

  const activeAssistantRef = useRef<ActiveAssistantCursor | null>(null);
  const closedAssistantStreamIdsRef = useRef<Set<string>>(new Set());
  const activitySegmentRef = useRef<string | null>(null);
  const fileEditSegmentRef = useRef<string | null>(null);
  const activitySegmentCounterRef = useRef(0);
  const deferStreamDisplayRef = useRef(false);
  const streamEndTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dismissStreamError = useCallback(() => setStreamError(null), []);

  const createActivitySegmentId = useCallback((activate = true) => {
    activitySegmentCounterRef.current += 1;
    const id = `activity-${activitySegmentCounterRef.current}`;
    if (activate) activitySegmentRef.current = id;
    return id;
  }, []);

  const ensureActivitySegmentId = useCallback(() => {
    if (activitySegmentRef.current) return activitySegmentRef.current;
    return createActivitySegmentId(true);
  }, [createActivitySegmentId]);

  const clearActivitySegment = useCallback(() => {
    activitySegmentRef.current = null;
    fileEditSegmentRef.current = null;
  }, []);

  const closeActiveAssistantStream = useCallback(() => {
    const closedStreamId = bufferControl.buffer.current?.messageId ?? activeAssistantRef.current?.id;
    if (closedStreamId) closedAssistantStreamIdsRef.current.add(closedStreamId);
    bufferControl.buffer.current = null;
    activeAssistantRef.current = null;
  }, []);

  const resolveActiveAssistantIndex = useCallback((prev: UIMessage[]): number | null => {
    const cursor = activeAssistantRef.current;
    if (!cursor) return null;
    const indexed = prev[cursor.index];
    if (indexed?.id === cursor.id && indexed.role === "assistant" && indexed.kind !== "trace") {
      return cursor.index;
    }
    const idx = prev.findIndex((m) => m.id === cursor.id);
    if (idx === -1) {
      activeAssistantRef.current = null;
      return null;
    }
    const found = prev[idx];
    if (found.role !== "assistant" || found.kind === "trace") {
      activeAssistantRef.current = null;
      return null;
    }
    activeAssistantRef.current = { id: cursor.id, index: idx };
    return idx;
  }, []);

  const appendAnswerChunk = useCallback(
    (prev: UIMessage[], chunk: string): UIMessage[] => {
      let next = prev;
      let targetIndex = resolveActiveAssistantIndex(next);

      if (targetIndex === null) {
        targetIndex = findActiveAssistantPlaceholderIndex(next);
      }
      if (targetIndex === null) {
        targetIndex = findStreamingAssistantIndex(next, closedAssistantStreamIdsRef.current);
      }
      if (targetIndex === null) {
        const id = crypto.randomUUID();
        next = [
          ...next,
          {
            id,
            role: "assistant",
            content: "",
            isStreaming: true,
            createdAt: Date.now(),
          },
        ];
        targetIndex = next.length - 1;
      }

      const target = next[targetIndex];
      const merged: UIMessage = {
        ...target,
        content: target.content + chunk,
        isStreaming: true,
      };
      closedAssistantStreamIdsRef.current.delete(merged.id);
      activeAssistantRef.current = { id: merged.id, index: targetIndex };
      return replaceMessageAt(next, targetIndex, merged);
    },
    [resolveActiveAssistantIndex],
  );

  const bufferControl = useStreamBuffer(
    appendAnswerChunk,
    setMessages,
    closeActiveAssistantStream,
    ensureActivitySegmentId,
  );
  const {
    buffer,
    pushPendingEvent,
    schedulePendingStreamFlush,
    flushPendingStreamEvents,
    clearPendingStreamWork,
  } = bufferControl;

  // Sync buffer.current with the stream buffer — closedActiveAssistantStream uses it
  useEffect(() => {
    return client.onError((err) => {
      setStreamError(err);
      setIsStreaming(false);
      flushPendingStreamEvents();
      buffer.current = null;
      activeAssistantRef.current = null;
      closedAssistantStreamIdsRef.current.clear();
      if (streamEndTimerRef.current !== null) {
        clearTimeout(streamEndTimerRef.current);
        streamEndTimerRef.current = null;
      }
    });
  }, [client, flushPendingStreamEvents, buffer]);

  // Reset local state when switching chats.
  useEffect(() => {
    setMessages(initialMessages);
    setIsStreaming(
      hasPendingToolCalls
      && initialMessages.length > 0
      && initialMessages[initialMessages.length - 1].kind === "trace",
    );
    setStreamError(null);
    setRunStartedAt(chatId ? client.getRunStartedAt(chatId) : null);
    setGoalState(chatId ? client.getGoalState(chatId) : undefined);
    buffer.current = null;
    activeAssistantRef.current = null;
    closedAssistantStreamIdsRef.current.clear();
    clearActivitySegment();
    clearPendingStreamWork();
    deferStreamDisplayRef.current = false;
    if (streamEndTimerRef.current !== null) {
      clearTimeout(streamEndTimerRef.current);
      streamEndTimerRef.current = null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatId, client, clearActivitySegment, clearPendingStreamWork]);

  useEffect(() => {
    if (hasPendingToolCalls) setIsStreaming(true);
  }, [hasPendingToolCalls]);

  useEffect(() => {
    if (!chatId) return;

    const handle = (ev: InboundEvent) => {
      if (streamEndTimerRef.current !== null) {
        clearTimeout(streamEndTimerRef.current);
        streamEndTimerRef.current = null;
      }

      if (ev.event === "user_inbound") {
        const text = ev.text?.trim();
        if (!text) return;
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: "user",
            content: text,
            createdAt: Date.now(),
          },
        ]);
        setIsStreaming(true);
        return;
      }

      if (ev.event === "delta") {
        if (deferStreamDisplayRef.current) return;
        const chunk = typeof ev.text === "string" ? ev.text : "";
        if (!chunk) return;
        setIsStreaming(true);
        pushPendingEvent({ kind: "delta", text: chunk });
        schedulePendingStreamFlush();
        return;
      }

      if (ev.event === "reasoning_delta") {
        if (deferStreamDisplayRef.current) return;
        const chunk = ev.text;
        if (!chunk) return;
        if (fileEditSegmentRef.current) clearActivitySegment();
        setIsStreaming(true);
        pushPendingEvent({ kind: "reasoning", text: chunk });
        schedulePendingStreamFlush();
        return;
      }

      if (ev.event === "stream_end") {
        flushPendingStreamEvents({ closeAnswerSegment: true });
        if (deferStreamDisplayRef.current) return;
        return;
      }

      flushPendingStreamEvents();

      if (ev.event === "reasoning_end") {
        if (deferStreamDisplayRef.current) return;
        setMessages((prev) => closeReasoningStream(prev));
        return;
      }

      if (ev.event === "goal_state") {
        setGoalState(ev.goal_state);
        return;
      }

      if (ev.event === "goal_status") {
        if (ev.status === "running" && typeof ev.started_at === "number") {
          setRunStartedAt(ev.started_at);
        } else {
          setRunStartedAt(null);
        }
        return;
      }

      if (ev.event === "diagram_event") {
        onDiagramEvent?.(ev.diagram);
        return;
      }

      if (ev.event === "turn_end") {
        if ("goal_state" in ev && ev.goal_state != null && typeof ev.goal_state === "object") {
          setGoalState(ev.goal_state);
        }
        if (streamEndTimerRef.current !== null) {
          clearTimeout(streamEndTimerRef.current);
          streamEndTimerRef.current = null;
        }
        setIsStreaming(false);
        setMessages((prev) => {
          let finalized = prev.map((m) => (m.isStreaming ? { ...m, isStreaming: false } : m));
          finalized = pruneReasoningOnlyPlaceholders(finalized);
          if (ev.tools_used?.length) {
            finalized = appendToolsUsedSummary(finalized, ev.tools_used);
          }
          if (typeof ev.latency_ms === "number" && ev.latency_ms >= 0) {
            finalized = stampLastAssistantTurnStats(finalized, {
              latencyMs: Math.round(ev.latency_ms),
              ...(ev.usage ? { tokenUsage: ev.usage } : {}),
            });
          } else if (ev.usage) {
            finalized = stampLastAssistantTurnStats(finalized, { tokenUsage: ev.usage });
          }
          buffer.current = null;
          activeAssistantRef.current = null;
          clearActivitySegment();
          closedAssistantStreamIdsRef.current.clear();
          return finalized;
        });
        deferStreamDisplayRef.current = false;
        onTurnEnd?.();
        return;
      }

      if (ev.event === "message") {
        if (
          deferStreamDisplayRef.current &&
          (ev.kind === "progress" || ev.kind === "reasoning")
        ) {
          return;
        }
        if (ev.kind === "reasoning") {
          const line = ev.text;
          if (!line) return;
          if (fileEditSegmentRef.current) clearActivitySegment();
          setMessages((prev) =>
            closeReasoningStream(
              attachReasoningChunk(prev, line, {
                ensure: ensureActivitySegmentId,
              })
            )
          );
          return;
        }
        if (ev.kind === "tool_hint") {
          const raw = ev.tool_events?.[0];
          const toolEvent: ToolProgressEvent | null = raw
            ? (raw as ToolProgressEvent)
            : null;
          if (!toolEvent?.name) return;
          const segmentId = ensureActivitySegmentId();
          setMessages((prev) => {
            let next = appendToolProgressTrace(prev, toolEvent, segmentId);
            const optimistic = optimisticFileEditFromToolStart(toolEvent);
            if (optimistic) {
              fileEditSegmentRef.current = segmentId;
              next = mergeFileEditIntoTrace(next, segmentId, [optimistic]);
            }
            return next;
          });
          return;
        }

        if (ev.kind === "progress") {
          const line = ev.text?.trim();
          if (!line) return;
          setMessages((prev) => {
            const segmentId = ensureActivitySegmentId();
            const last = prev[prev.length - 1];
            if (
              last
              && last.kind === "trace"
              && !last.toolProgress
              && !last.isStreaming
              && (!last.activitySegmentId || last.activitySegmentId === segmentId)
            ) {
              const previousTraces = last.traces?.length
                ? last.traces
                : last.content
                  ? [last.content]
                  : [];
              const merged: UIMessage = {
                ...last,
                traces: [...previousTraces, line],
                content: "",
                activitySegmentId: last.activitySegmentId ?? segmentId,
              };
              return [...prev.slice(0, -1), merged];
            }
            return [
              ...prev,
              {
                id: crypto.randomUUID(),
                role: "tool",
                kind: "trace",
                content: "",
                traces: [line],
                activitySegmentId: segmentId,
                createdAt: Date.now(),
              },
            ];
          });
          return;
        }

        const media = ev.media_urls?.length
          ? ev.media_urls.map((m) => toMediaAttachment(m))
          : ev.media?.map((url) => toMediaAttachment({ url }));
        const hasMedia = !!media && media.length > 0;

        setMessages((prev) => {
          const activeId = buffer.current?.messageId;
          buffer.current = null;
          activeAssistantRef.current = null;
          const filtered = activeId ? prev.filter((m) => m.id !== activeId) : prev;
          const content = ev.text;
          const lat =
            typeof ev.latency_ms === "number" && ev.latency_ms >= 0
              ? Math.round(ev.latency_ms)
              : undefined;
          return absorbCompleteAssistantMessage(filtered, {
            content,
            ...(hasMedia ? { media } : {}),
            ...(lat !== undefined ? { latencyMs: lat } : {}),
          });
        });
        if (hasMedia) {
          deferStreamDisplayRef.current = true;
        }
        return;
      }
      if (ev.event === "file_edit") {
        const edits = Array.isArray(ev.edits) ? ev.edits : [];
        if (edits.length === 0) return;
        const normalized = mergeFileEdits(undefined, edits);
        if (normalized.length === 0) return;
        const opensFileEditPhase = normalized.some(
          (edit) => edit.status === "editing" || edit.phase === "start",
        );
        const segmentId = ensureActivitySegmentId();
        if (opensFileEditPhase) {
          fileEditSegmentRef.current = segmentId;
        }
        setMessages((prev) =>
          mergeFileEditIntoTrace(prev, segmentId, normalized),
        );
        return;
      }
    };

    const unsub = client.onChat(chatId, handle);
    return () => {
      unsub();
      buffer.current = null;
      activeAssistantRef.current = null;
      closedAssistantStreamIdsRef.current.clear();
      clearActivitySegment();
      clearPendingStreamWork();
      if (streamEndTimerRef.current !== null) {
        clearTimeout(streamEndTimerRef.current);
        streamEndTimerRef.current = null;
      }
    };
  }, [
    chatId,
    client,
    clearActivitySegment,
    clearPendingStreamWork,
    ensureActivitySegmentId,
    flushPendingStreamEvents,
    onTurnEnd,
    onDiagramEvent,
    schedulePendingStreamFlush,
    buffer,
    pushPendingEvent,
  ]);

  const send = useCallback(
    (content: string, images?: SendImage[], options?: SendOptions) => {
      if (!chatId) return;
      const hasImages = !!images && images.length > 0;
      if (!hasImages && !content.trim()) return;

      flushPendingStreamEvents();
      const previews = hasImages ? images!.map((i) => i.preview) : undefined;
      setMessages((prev) => {
        buffer.current = null;
        activeAssistantRef.current = null;
        closedAssistantStreamIdsRef.current.clear();
        clearActivitySegment();
        return [
          ...pruneReasoningOnlyPlaceholders(prev),
          {
            id: crypto.randomUUID(),
            role: "user",
            content,
            createdAt: Date.now(),
            ...(previews ? { images: previews } : {}),
          },
        ];
      });
      setIsStreaming(true);
      const wireMedia = hasImages ? images!.map((i) => i.media) : undefined;
      client.sendMessage(chatId, content, wireMedia, options, workspaceFolderId ?? null);
    },
    [chatId, clearActivitySegment, client, flushPendingStreamEvents, workspaceFolderId],
  );

  const stop = useCallback(() => {
    if (!chatId) return;
    flushPendingStreamEvents();
    setIsStreaming(false);
    setMessages((prev) => {
      buffer.current = null;
      activeAssistantRef.current = null;
      closedAssistantStreamIdsRef.current.clear();
      clearActivitySegment();
      return prev.map((m) => (m.isStreaming ? { ...m, isStreaming: false } : m));
    });
    deferStreamDisplayRef.current = false;
    client.sendMessage(chatId, "/stop", undefined, undefined, workspaceFolderId ?? null);
  }, [chatId, clearActivitySegment, client, flushPendingStreamEvents, workspaceFolderId]);

  return {
    messages,
    isStreaming,
    runStartedAt,
    goalState,
    send,
    stop,
    setMessages,
    streamError,
    dismissStreamError,
  };
}
