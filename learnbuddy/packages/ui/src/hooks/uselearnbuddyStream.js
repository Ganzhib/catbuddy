import { useCallback, useEffect, useRef, useState } from "react";
import { useClient } from "@/providers/ClientProvider";
import { toMediaAttachment } from "@/lib/media";
import { linesFromToolProgress, upsertToolProgress } from "@learnbuddy/client";
/** Find a still-open streamed assistant turn. Closed stream segments stay visible
 * as streaming until ``turn_end`` for visual continuity, but they must not
 * receive later delta segments. */
function findStreamingAssistantIndex(prev, closedStreamIds) {
    for (let i = prev.length - 1; i >= 0; i -= 1) {
        const m = prev[i];
        if (m.kind === "trace")
            continue;
        if (m.role === "assistant" && m.isStreaming && !closedStreamIds.has(m.id))
            return i;
        if (m.role === "user")
            break;
    }
    return null;
}
/**
 * Append a reasoning chunk to the last open reasoning stream in ``prev``.
 *
 * Lookup rule: prefer the most recent assistant turn in the active UI tail.
 * Most providers emit reasoning before answer text, but some only expose
 * ``reasoning_content`` after the answer stream completes. In that post-hoc
 * case the reasoning still belongs to the same assistant turn and must render
 * above the answer, not as a new row below it.
 */
function attachReasoningChunk(prev, chunk, segments) {
    for (let i = prev.length - 1; i >= 0; i -= 1) {
        const candidate = prev[i];
        // A user turn is a hard boundary: reasoning after it belongs to the new
        // assistant turn, never to an earlier assistant reply.
        if (candidate.role === "user")
            break;
        // A trace row (e.g. Used tools) is also a phase boundary. Reasoning after
        // tools belongs to the next assistant iteration, not the assistant turn
        // that produced those tool calls.
        if (candidate.kind === "trace")
            break;
        if (candidate.role !== "assistant")
            continue;
        const activitySegmentId = candidate.activitySegmentId ?? segments?.ensure();
        const hasAnswer = candidate.content.length > 0;
        if (candidate.reasoningStreaming
            || candidate.reasoning !== undefined
            || hasAnswer
            || candidate.isStreaming) {
            const merged = {
                ...candidate,
                reasoning: (candidate.reasoning ?? "") + chunk,
                reasoningStreaming: true,
                ...(activitySegmentId ? { activitySegmentId } : {}),
            };
            return [...prev.slice(0, i), merged, ...prev.slice(i + 1)];
        }
        if (!hasAnswer && candidate.isStreaming) {
            const merged = {
                ...candidate,
                reasoning: chunk,
                reasoningStreaming: true,
                ...(activitySegmentId ? { activitySegmentId } : {}),
            };
            return [...prev.slice(0, i), merged, ...prev.slice(i + 1)];
        }
        break;
    }
    const activitySegmentId = segments?.ensure();
    return [
        ...prev,
        {
            id: crypto.randomUUID(),
            role: "assistant",
            content: "",
            isStreaming: true,
            reasoning: chunk,
            reasoningStreaming: true,
            ...(activitySegmentId ? { activitySegmentId } : {}),
            createdAt: Date.now(),
        },
    ];
}
/**
 * Find the most recent assistant placeholder that an incoming answer
 * delta should adopt instead of spawning a parallel row. We look for an
 * empty-content assistant turn that is still marked ``isStreaming`` —
 * typically created earlier by ``reasoning_delta``. Anything else means
 * the model already produced an answer in a previous turn, so the new
 * delta belongs in a fresh row.
 */
function findActiveAssistantPlaceholderIndex(prev) {
    const last = prev[prev.length - 1];
    if (!last)
        return null;
    if (last.role !== "assistant" || last.kind === "trace")
        return null;
    if (last.content.length > 0)
        return null;
    if (!last.isStreaming)
        return null;
    return prev.length - 1;
}
function replaceMessageAt(prev, index, message) {
    const next = prev.slice();
    next[index] = message;
    return next;
}
/**
 * Close the active reasoning stream segment, if any. Idempotent: a
 * ``reasoning_end`` with no preceding deltas is a harmless no-op.
 */
function closeReasoningStream(prev) {
    for (let i = prev.length - 1; i >= 0; i -= 1) {
        const candidate = prev[i];
        if (!candidate.reasoningStreaming)
            continue;
        const merged = { ...candidate, reasoningStreaming: false };
        return [...prev.slice(0, i), merged, ...prev.slice(i + 1)];
    }
    return prev;
}
function isReasoningOnlyPlaceholder(message) {
    return (message.role === "assistant"
        && message.kind !== "trace"
        && message.content.trim().length === 0
        && !!message.reasoning
        && !message.reasoningStreaming
        && !message.media?.length);
}
function isToolTrace(message) {
    return message?.kind === "trace";
}
function pruneReasoningOnlyPlaceholders(prev) {
    return prev.filter((message, index) => {
        if (!isReasoningOnlyPlaceholder(message))
            return true;
        // A reasoning-only assistant row immediately followed by tool traces is
        // the live equivalent of a persisted assistant tool-call message with
        // empty content, reasoning_content, and tool_calls. Keep it so live render
        // and history replay stay isomorphic.
        return isToolTrace(prev[index + 1]);
    });
}
function stampLastAssistantLatency(prev, latencyMs) {
    for (let i = prev.length - 1; i >= 0; i -= 1) {
        const m = prev[i];
        if (m.role === "assistant" && m.kind !== "trace") {
            const merged = { ...m, latencyMs, isStreaming: false };
            return [...prev.slice(0, i), merged, ...prev.slice(i + 1)];
        }
    }
    return prev;
}
function appendToolsUsedSummary(prev, toolsUsed) {
    if (toolsUsed.length === 0)
        return prev;
    const summary = `Tools: ${toolsUsed.join(', ')}`;
    for (let i = prev.length - 1; i >= 0; i -= 1) {
        const m = prev[i];
        if (m.kind !== "trace")
            continue;
        const traces = [...(m.traces ?? []), summary];
        const merged = {
            ...m,
            traces,
            content: summary,
        };
        return [...prev.slice(0, i), merged, ...prev.slice(i + 1)];
    }
    return prev;
}
/** Show file chip as soon as write_file / edit_file tool card appears (before file_edit IPC). */
function optimisticFileEditFromToolStart(event) {
    if (event.phase !== "start")
        return null;
    if (event.name !== "write_file" && event.name !== "edit_file")
        return null;
    const args = event.arguments;
    if (!args || typeof args !== "object")
        return null;
    const path = args.path;
    if (typeof path !== "string" || !path.trim())
        return null;
    const trimmed = path.trim();
    return {
        version: 1,
        call_id: event.call_id ?? `${event.name}:${trimmed}`,
        tool: event.name,
        path: trimmed,
        phase: "start",
        status: "editing",
        added: 0,
        deleted: 0,
    };
}
function mergeFileEditIntoTrace(prev, segmentId, edits) {
    const normalized = mergeFileEdits(undefined, edits);
    if (normalized.length === 0)
        return prev;
    const targetIndex = findFileEditTraceIndex(prev, segmentId, normalized);
    if (targetIndex === null) {
        return [
            ...prev,
            {
                id: crypto.randomUUID(),
                role: "tool",
                kind: "trace",
                content: "",
                traces: [],
                fileEdits: normalized,
                activitySegmentId: segmentId,
                createdAt: Date.now(),
            },
        ];
    }
    const target = prev[targetIndex];
    return replaceMessageAt(prev, targetIndex, {
        ...target,
        fileEdits: mergeFileEdits(target.fileEdits, normalized),
        activitySegmentId: target.activitySegmentId ?? segmentId,
    });
}
function appendToolProgressTrace(prev, toolEvent, segmentId) {
    const last = prev[prev.length - 1];
    if (last
        && last.kind === "trace"
        && !last.isStreaming
        && (!last.activitySegmentId || last.activitySegmentId === segmentId)) {
        const toolProgress = upsertToolProgress(last.toolProgress, toolEvent);
        const traces = linesFromToolProgress(toolProgress);
        const merged = {
            ...last,
            toolProgress,
            traces,
            content: traces[traces.length - 1] ?? last.content,
            activitySegmentId: last.activitySegmentId ?? segmentId,
        };
        return [...prev.slice(0, -1), merged];
    }
    const toolProgress = upsertToolProgress(undefined, toolEvent);
    const traces = linesFromToolProgress(toolProgress);
    return [
        ...prev,
        {
            id: crypto.randomUUID(),
            role: "tool",
            kind: "trace",
            toolProgress,
            content: traces[traces.length - 1] ?? "",
            traces,
            activitySegmentId: segmentId,
            createdAt: Date.now(),
        },
    ];
}
function absorbCompleteAssistantMessage(prev, message) {
    const last = prev[prev.length - 1];
    if (!last || !isReasoningOnlyPlaceholder(last)) {
        return [
            ...prev,
            {
                id: crypto.randomUUID(),
                role: "assistant",
                createdAt: Date.now(),
                ...message,
            },
        ];
    }
    return [
        ...prev.slice(0, -1),
        {
            ...last,
            ...message,
            isStreaming: false,
            reasoningStreaming: false,
        },
    ];
}
function fileEditKey(edit) {
    if (edit.call_id)
        return `${edit.call_id}|${edit.tool}`;
    return `${edit.tool}|${edit.path}`;
}
function normalizeFileEdit(edit) {
    if (!edit || !edit.tool || (!edit.path && !edit.pending))
        return null;
    const inferredStatus = edit.phase === "error"
        ? "error"
        : edit.phase === "end"
            ? "done"
            : "editing";
    const normalized = {
        ...edit,
        call_id: edit.call_id || `${edit.tool}:${edit.path}`,
        added: Number.isFinite(edit.added) ? Math.max(0, Math.round(edit.added)) : 0,
        deleted: Number.isFinite(edit.deleted) ? Math.max(0, Math.round(edit.deleted)) : 0,
        status: edit.status === "error" || edit.status === "done" || edit.status === "editing"
            ? edit.status
            : inferredStatus,
    };
    if (edit.pending && !edit.path)
        normalized.pending = true;
    return normalized;
}
function mergeFileEdits(existing, incoming) {
    const next = [...(existing ?? [])];
    const indexByKey = new Map(next.map((edit, index) => [fileEditKey(edit), index]));
    for (const raw of incoming) {
        const edit = normalizeFileEdit(raw);
        if (!edit)
            continue;
        const key = fileEditKey(edit);
        const existingIndex = indexByKey.get(key);
        if (existingIndex === undefined) {
            indexByKey.set(key, next.length);
            next.push(edit);
            continue;
        }
        const merged = { ...next[existingIndex], ...edit };
        if (edit.path && !edit.pending)
            delete merged.pending;
        next[existingIndex] = merged;
    }
    return next;
}
/**
 * Find the trace row to merge file_edit into — prefer the in-flight tool card
 * (same call_id / activity segment) so file chips appear immediately.
 */
function findFileEditTraceIndex(prev, segmentId, incoming) {
    const incomingKeys = new Set(incoming.map(fileEditKey));
    const callIds = new Set(incoming
        .map((edit) => edit.call_id)
        .filter((id) => typeof id === "string" && id.length > 0));
    for (let i = prev.length - 1; i >= 0; i -= 1) {
        const candidate = prev[i];
        if (candidate.role === "user")
            break;
        if (candidate.kind !== "trace")
            continue;
        if (candidate.activitySegmentId && candidate.activitySegmentId !== segmentId) {
            continue;
        }
        if (candidate.fileEdits?.length) {
            for (const existing of candidate.fileEdits) {
                if (incomingKeys.has(fileEditKey(existing)))
                    return i;
            }
        }
        if (callIds.size > 0 && candidate.toolProgress) {
            for (const callId of callIds) {
                if (candidate.toolProgress[callId])
                    return i;
            }
        }
    }
    for (let i = prev.length - 1; i >= 0; i -= 1) {
        const candidate = prev[i];
        if (candidate.role === "user")
            break;
        if (candidate.kind !== "trace")
            continue;
        if (candidate.activitySegmentId === segmentId)
            return i;
    }
    return null;
}
export function uselearnbuddyStream(chatId, initialMessages = [], hasPendingToolCalls = false, onTurnEnd) {
    const { client } = useClient();
    const [messages, setMessages] = useState(initialMessages);
    /** If the last loaded message is a trace row (e.g. "Using 2 tools"),
     * the model was still processing when the page loaded — keep the
     * loading spinner alive so the user sees the model is active.
     *
     * NOTE: This only applies to hot-reload scenarios where a live WebSocket
     * session survives across reloads. For cold-start / app-restart, all
     * messages are historical and ``hasPendingToolCalls`` is always false,
     * so this flag correctly evaluates to ``false``. */
    const initialStreaming = hasPendingToolCalls
        && initialMessages.length > 0
        && initialMessages[initialMessages.length - 1].kind === "trace";
    const [isStreaming, setIsStreaming] = useState(initialStreaming);
    /** Unix epoch seconds when the current user turn started; cleared on ``idle``. */
    const [runStartedAt, setRunStartedAt] = useState(null);
    const [goalState, setGoalState] = useState(undefined);
    const [streamError, setStreamError] = useState(null);
    const buffer = useRef(null);
    const activeAssistantRef = useRef(null);
    const closedAssistantStreamIdsRef = useRef(new Set());
    const activitySegmentRef = useRef(null);
    const fileEditSegmentRef = useRef(null);
    const activitySegmentCounterRef = useRef(0);
    const pendingStreamEventsRef = useRef([]);
    const streamFrameRef = useRef(null);
    const suppressStreamUntilTurnEndRef = useRef(false);
    /** Timer that defers ``isStreaming = false`` after ``stream_end``.
     *
     * When the model finishes a text segment and calls a tool, the server
     * sends ``stream_end`` but the agent is still "thinking" while the tool
     * executes.  By deferring the flag reset by a short window (1 s) we keep
     * the loading spinner alive across tool-call boundaries without needing
     * backend changes. */
    const streamEndTimerRef = useRef(null);
    useEffect(() => {
        return client.onError((err) => setStreamError(err));
    }, [client]);
    const dismissStreamError = useCallback(() => setStreamError(null), []);
    const clearPendingStreamWork = useCallback(() => {
        if (streamFrameRef.current !== null) {
            window.cancelAnimationFrame(streamFrameRef.current);
            streamFrameRef.current = null;
        }
        pendingStreamEventsRef.current = [];
    }, []);
    const createActivitySegmentId = useCallback((activate = true) => {
        activitySegmentCounterRef.current += 1;
        const id = `activity-${activitySegmentCounterRef.current}`;
        if (activate)
            activitySegmentRef.current = id;
        return id;
    }, []);
    const freshActivitySegmentId = useCallback(() => createActivitySegmentId(true), [createActivitySegmentId]);
    const detachedActivitySegmentId = useCallback(() => createActivitySegmentId(false), [createActivitySegmentId]);
    const ensureActivitySegmentId = useCallback(() => {
        if (activitySegmentRef.current)
            return activitySegmentRef.current;
        return freshActivitySegmentId();
    }, [freshActivitySegmentId]);
    const clearActivitySegment = useCallback(() => {
        activitySegmentRef.current = null;
        fileEditSegmentRef.current = null;
    }, []);
    const closeActiveAssistantStream = useCallback(() => {
        const closedStreamId = buffer.current?.messageId ?? activeAssistantRef.current?.id;
        if (closedStreamId)
            closedAssistantStreamIdsRef.current.add(closedStreamId);
        buffer.current = null;
        activeAssistantRef.current = null;
    }, []);
    const resolveActiveAssistantIndex = useCallback((prev) => {
        const cursor = activeAssistantRef.current;
        if (!cursor)
            return null;
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
    const appendAnswerChunk = useCallback((prev, chunk) => {
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
        const merged = {
            ...target,
            content: target.content + chunk,
            isStreaming: true,
        };
        closedAssistantStreamIdsRef.current.delete(merged.id);
        activeAssistantRef.current = { id: merged.id, index: targetIndex };
        buffer.current = { messageId: merged.id };
        return replaceMessageAt(next, targetIndex, merged);
    }, [resolveActiveAssistantIndex]);
    const applyPendingStreamEvents = useCallback((prev, events) => {
        let next = prev;
        for (let i = 0; i < events.length;) {
            const kind = events[i].kind;
            let text = "";
            while (i < events.length && events[i].kind === kind) {
                text += events[i].text;
                i += 1;
            }
            next = kind === "delta"
                ? appendAnswerChunk(next, text)
                : attachReasoningChunk(next, text, {
                    ensure: ensureActivitySegmentId,
                });
        }
        return next;
    }, [appendAnswerChunk, ensureActivitySegmentId]);
    const flushPendingStreamEvents = useCallback((options) => {
        if (streamFrameRef.current !== null) {
            window.cancelAnimationFrame(streamFrameRef.current);
            streamFrameRef.current = null;
        }
        const events = pendingStreamEventsRef.current;
        if (events.length === 0) {
            if (options?.closeAnswerSegment)
                closeActiveAssistantStream();
            return;
        }
        pendingStreamEventsRef.current = [];
        setMessages((prev) => {
            const next = applyPendingStreamEvents(prev, events);
            if (options?.closeAnswerSegment)
                closeActiveAssistantStream();
            return next;
        });
    }, [applyPendingStreamEvents, closeActiveAssistantStream]);
    const schedulePendingStreamFlush = useCallback(() => {
        if (streamFrameRef.current !== null)
            return;
        streamFrameRef.current = window.requestAnimationFrame(() => {
            streamFrameRef.current = null;
            const events = pendingStreamEventsRef.current;
            if (events.length === 0)
                return;
            pendingStreamEventsRef.current = [];
            setMessages((prev) => applyPendingStreamEvents(prev, events));
        });
    }, [applyPendingStreamEvents]);
    // Reset local state when switching chats. Do not reset on every
    // ``initialMessages`` update: a brand-new chat can receive an empty/404
    // history response after the optimistic first message has already rendered.
    useEffect(() => {
        setMessages(initialMessages);
        setIsStreaming(hasPendingToolCalls
            && initialMessages.length > 0
            && initialMessages[initialMessages.length - 1].kind === "trace");
        setStreamError(null);
        setRunStartedAt(chatId ? client.getRunStartedAt(chatId) : null);
        setGoalState(chatId ? client.getGoalState(chatId) : undefined);
        buffer.current = null;
        activeAssistantRef.current = null;
        closedAssistantStreamIdsRef.current.clear();
        clearActivitySegment();
        clearPendingStreamWork();
        suppressStreamUntilTurnEndRef.current = false;
        if (streamEndTimerRef.current !== null) {
            clearTimeout(streamEndTimerRef.current);
            streamEndTimerRef.current = null;
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [chatId, client, clearActivitySegment, clearPendingStreamWork]);
    useEffect(() => {
        if (hasPendingToolCalls)
            setIsStreaming(true);
    }, [hasPendingToolCalls]);
    useEffect(() => {
        if (!chatId)
            return;
        const handle = (ev) => {
            // Any incoming event while the debounce timer is alive means the model
            // is still working (e.g. tool result arrived, more text to stream).
            // Cancel the pending "stream ended" timer so we don't hide the spinner.
            if (streamEndTimerRef.current !== null) {
                clearTimeout(streamEndTimerRef.current);
                streamEndTimerRef.current = null;
            }
            if (ev.event === "user_inbound") {
                const text = ev.text?.trim();
                if (!text)
                    return;
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
                if (suppressStreamUntilTurnEndRef.current)
                    return;
                const chunk = typeof ev.text === "string" ? ev.text : "";
                if (!chunk)
                    return;
                setIsStreaming(true);
                pendingStreamEventsRef.current.push({ kind: "delta", text: chunk });
                schedulePendingStreamFlush();
                return;
            }
            if (ev.event === "reasoning_delta") {
                if (suppressStreamUntilTurnEndRef.current)
                    return;
                const chunk = ev.text;
                if (!chunk)
                    return;
                if (fileEditSegmentRef.current)
                    clearActivitySegment();
                setIsStreaming(true);
                pendingStreamEventsRef.current.push({ kind: "reasoning", text: chunk });
                schedulePendingStreamFlush();
                return;
            }
            if (ev.event === "stream_end") {
                flushPendingStreamEvents({ closeAnswerSegment: true });
                if (suppressStreamUntilTurnEndRef.current)
                    return;
                // stream_end only means the text segment finished — the model may
                // still be executing tools.  Do NOT reset isStreaming here; the
                // definitive "turn is complete" signal is ``turn_end``.
                return;
            }
            flushPendingStreamEvents();
            if (ev.event === "reasoning_end") {
                if (suppressStreamUntilTurnEndRef.current)
                    return;
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
                }
                else {
                    setRunStartedAt(null);
                }
                return;
            }
            if (ev.event === "turn_end") {
                if ("goal_state" in ev && ev.goal_state != null && typeof ev.goal_state === "object") {
                    setGoalState(ev.goal_state);
                }
                // Definitive signal that the turn is fully complete.  Cancel any
                // pending debounce timer and stop the loading indicator immediately.
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
                        finalized = stampLastAssistantLatency(finalized, Math.round(ev.latency_ms));
                    }
                    buffer.current = null;
                    activeAssistantRef.current = null;
                    clearActivitySegment();
                    closedAssistantStreamIdsRef.current.clear();
                    return finalized;
                });
                suppressStreamUntilTurnEndRef.current = false;
                onTurnEnd?.();
                return;
            }
            if (ev.event === "message") {
                if (suppressStreamUntilTurnEndRef.current &&
                    (ev.kind === "progress" || ev.kind === "reasoning")) {
                    return;
                }
                // Back-compat: a legacy ``kind: "reasoning"`` message (no streaming
                // partner) is treated as one complete delta + immediate end so the
                // bubble renders identically to the streaming path.
                if (ev.kind === "reasoning") {
                    const line = ev.text;
                    if (!line)
                        return;
                    if (fileEditSegmentRef.current)
                        clearActivitySegment();
                    setMessages((prev) => closeReasoningStream(attachReasoningChunk(prev, line, {
                        ensure: ensureActivitySegmentId,
                    })));
                    return;
                }
                // Intermediate agent breadcrumbs (tool-call hints, raw progress).
                // Attach them to the last trace row if it was the last emitted item
                // so a sequence of calls collapses into one compact trace group.
                if (ev.kind === "tool_hint") {
                    const raw = ev.tool_events?.[0];
                    const toolEvent = raw
                        ? raw
                        : null;
                    if (!toolEvent?.name)
                        return;
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
                    if (!line)
                        return;
                    setMessages((prev) => {
                        const segmentId = ensureActivitySegmentId();
                        const last = prev[prev.length - 1];
                        if (last
                            && last.kind === "trace"
                            && !last.toolProgress
                            && !last.isStreaming
                            && (!last.activitySegmentId || last.activitySegmentId === segmentId)) {
                            const previousTraces = last.traces?.length
                                ? last.traces
                                : last.content
                                    ? [last.content]
                                    : [];
                            const merged = {
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
                // A complete (non-streamed) assistant message. If a stream was in
                // flight, drop the placeholder so we don't render the text twice.
                // Do NOT reset isStreaming here — only ``turn_end`` signals that
                // the full turn (all tool calls + final text) is complete.
                setMessages((prev) => {
                    const activeId = buffer.current?.messageId;
                    buffer.current = null;
                    activeAssistantRef.current = null;
                    const filtered = activeId ? prev.filter((m) => m.id !== activeId) : prev;
                    const content = ev.text;
                    const lat = typeof ev.latency_ms === "number" && ev.latency_ms >= 0
                        ? Math.round(ev.latency_ms)
                        : undefined;
                    return absorbCompleteAssistantMessage(filtered, {
                        content,
                        ...(hasMedia ? { media } : {}),
                        ...(lat !== undefined ? { latencyMs: lat } : {}),
                    });
                });
                if (hasMedia) {
                    suppressStreamUntilTurnEndRef.current = true;
                }
                return;
            }
            if (ev.event === "file_edit") {
                const edits = Array.isArray(ev.edits) ? ev.edits : [];
                if (edits.length === 0)
                    return;
                const normalized = mergeFileEdits(undefined, edits);
                if (normalized.length === 0)
                    return;
                const opensFileEditPhase = normalized.some((edit) => edit.status === "editing" || edit.phase === "start");
                const segmentId = ensureActivitySegmentId();
                if (opensFileEditPhase) {
                    fileEditSegmentRef.current = segmentId;
                }
                setMessages((prev) => mergeFileEditIntoTrace(prev, segmentId, normalized));
                return;
            }
            // ``attached`` / ``error`` frames aren't actionable here; the client
            // shell handles them separately.
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
        detachedActivitySegmentId,
        ensureActivitySegmentId,
        flushPendingStreamEvents,
        onTurnEnd,
        schedulePendingStreamFlush,
    ]);
    const send = useCallback((content, images, options) => {
        if (!chatId)
            return;
        const hasImages = !!images && images.length > 0;
        // Text is optional when images are attached — the agent will still see
        // the image blocks via ``media`` paths.
        if (!hasImages && !content.trim())
            return;
        flushPendingStreamEvents();
        const previews = hasImages ? images.map((i) => i.preview) : undefined;
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
        // Mark streaming immediately so the UI shows the loading indicator
        // right away, before the first delta arrives from the server.
        setIsStreaming(true);
        const wireMedia = hasImages ? images.map((i) => i.media) : undefined;
        if (options) {
            client.sendMessage(chatId, content, wireMedia, options);
        }
        else {
            client.sendMessage(chatId, content, wireMedia);
        }
    }, [chatId, clearActivitySegment, client, flushPendingStreamEvents]);
    const stop = useCallback(() => {
        if (!chatId)
            return;
        flushPendingStreamEvents();
        setIsStreaming(false);
        setMessages((prev) => {
            buffer.current = null;
            activeAssistantRef.current = null;
            closedAssistantStreamIdsRef.current.clear();
            clearActivitySegment();
            return prev.map((m) => (m.isStreaming ? { ...m, isStreaming: false } : m));
        });
        suppressStreamUntilTurnEndRef.current = false;
        client.sendMessage(chatId, "/stop");
    }, [chatId, clearActivitySegment, client, flushPendingStreamEvents]);
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
//# sourceMappingURL=uselearnbuddyStream.js.map