import type {
  ToolProgressEvent,
  TokenUsage,
  UIFileEdit,
  UIMessage,
} from "@catbuddy/shared";
import { toolProgressKey, upsertToolProgress, linesFromToolProgress } from "@catbuddy/client";

/** Find a still-open streamed assistant turn. Closed stream segments stay visible
 * as streaming until ``turn_end`` for visual continuity, but they must not
 * receive later delta segments. */
export function findStreamingAssistantIndex(
  prev: UIMessage[],
  closedStreamIds: ReadonlySet<string>,
): number | null {
  for (let i = prev.length - 1; i >= 0; i -= 1) {
    const m = prev[i];
    if (m.kind === "trace") continue;
    if (m.role === "assistant" && m.isStreaming && !closedStreamIds.has(m.id)) return i;
    if (m.role === "user") break;
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
export function attachReasoningChunk(
  prev: UIMessage[],
  chunk: string,
  segments?: {
    ensure: () => string;
  },
): UIMessage[] {
  for (let i = prev.length - 1; i >= 0; i -= 1) {
    const candidate = prev[i];
    if (candidate.role === "user") break;
    if (candidate.kind === "trace") break;
    if (candidate.role !== "assistant") continue;
    const activitySegmentId = candidate.activitySegmentId ?? segments?.ensure();
    const hasAnswer = candidate.content.length > 0;
    if (
      candidate.reasoningStreaming
      || candidate.reasoning !== undefined
      || hasAnswer
      || candidate.isStreaming
    ) {
      const merged: UIMessage = {
        ...candidate,
        reasoning: (candidate.reasoning ?? "") + chunk,
        reasoningStreaming: true,
        ...(activitySegmentId ? { activitySegmentId } : {}),
      };
      return [...prev.slice(0, i), merged, ...prev.slice(i + 1)];
    }
    if (!hasAnswer && candidate.isStreaming) {
      const merged: UIMessage = {
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
export function findActiveAssistantPlaceholderIndex(prev: UIMessage[]): number | null {
  const last = prev[prev.length - 1];
  if (!last) return null;
  if (last.role !== "assistant" || last.kind === "trace") return null;
  if (last.content.length > 0) return null;
  if (!last.isStreaming) return null;
  return prev.length - 1;
}

export function replaceMessageAt(prev: UIMessage[], index: number, message: UIMessage): UIMessage[] {
  const next = prev.slice();
  next[index] = message;
  return next;
}

/**
 * Close the active reasoning stream segment, if any. Idempotent: a
 * ``reasoning_end`` with no preceding deltas is a harmless no-op.
 */
export function closeReasoningStream(prev: UIMessage[]): UIMessage[] {
  for (let i = prev.length - 1; i >= 0; i -= 1) {
    const candidate = prev[i];
    if (!candidate.reasoningStreaming) continue;
    const merged: UIMessage = { ...candidate, reasoningStreaming: false };
    return [...prev.slice(0, i), merged, ...prev.slice(i + 1)];
  }
  return prev;
}

export function isReasoningOnlyPlaceholder(message: UIMessage): boolean {
  return (
    message.role === "assistant"
    && message.kind !== "trace"
    && message.content.trim().length === 0
    && !!message.reasoning
    && !message.reasoningStreaming
    && !message.media?.length
  );
}

export function isToolTrace(message: UIMessage | undefined): boolean {
  return message?.kind === "trace";
}

export function pruneReasoningOnlyPlaceholders(prev: UIMessage[]): UIMessage[] {
  return prev.filter((message, index) => {
    if (!isReasoningOnlyPlaceholder(message)) return true;
    return isToolTrace(prev[index + 1]);
  });
}

export function stampLastAssistantTurnStats(
  prev: UIMessage[],
  stats: { latencyMs?: number; tokenUsage?: TokenUsage },
): UIMessage[] {
  for (let i = prev.length - 1; i >= 0; i -= 1) {
    const m = prev[i];
    if (m.role === "assistant" && m.kind !== "trace") {
      const merged: UIMessage = {
        ...m,
        isStreaming: false,
        ...(stats.latencyMs !== undefined ? { latencyMs: stats.latencyMs } : {}),
        ...(stats.tokenUsage ? { tokenUsage: stats.tokenUsage } : {}),
      };
      return [...prev.slice(0, i), merged, ...prev.slice(i + 1)];
    }
  }
  return prev;
}

export function stampLastAssistantLatency(prev: UIMessage[], latencyMs: number): UIMessage[] {
  return stampLastAssistantTurnStats(prev, { latencyMs });
}

export function appendToolsUsedSummary(
  prev: UIMessage[],
  toolsUsed: string[],
): UIMessage[] {
  if (toolsUsed.length === 0) return prev;
  const summary = `Tools: ${toolsUsed.join(", ")}`;
  for (let i = prev.length - 1; i >= 0; i -= 1) {
    const m = prev[i];
    if (m.kind !== "trace") continue;
    const traces = [...(m.traces ?? []), summary];
    const merged: UIMessage = {
      ...m,
      traces,
      content: summary,
    };
    return [...prev.slice(0, i), merged, ...prev.slice(i + 1)];
  }
  return prev;
}

export function optimisticFileEditFromToolStart(
  event: ToolProgressEvent,
): UIFileEdit | null {
  if (event.phase !== "start") return null;
  if (event.name !== "write_file" && event.name !== "edit_file") return null;
  const args = event.arguments;
  if (!args || typeof args !== "object") return null;
  const path = (args as { path?: unknown }).path;
  if (typeof path !== "string" || !path.trim()) return null;
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

export function absorbCompleteAssistantMessage(
  prev: UIMessage[],
  message: Omit<UIMessage, "id" | "role" | "createdAt">,
): UIMessage[] {
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

// ── File edit helpers ──

function fileEditKey(edit: Pick<UIFileEdit, "call_id" | "tool" | "path">): string {
  if (edit.call_id) return `${edit.call_id}|${edit.tool}`;
  return `${edit.tool}|${edit.path}`;
}

function normalizeFileEdit(edit: UIFileEdit): UIFileEdit | null {
  const pathValue = typeof edit.path === "string" ? edit.path.trim() : "";
  const hasUsablePath = !!pathValue && pathValue !== "undefined" && pathValue !== "null";
  if (!edit || !edit.tool || (!hasUsablePath && !edit.pending)) return null;
  const inferredStatus =
    edit.phase === "error"
      ? "error"
      : edit.phase === "end"
        ? "done"
        : "editing";
  const normalized: UIFileEdit = {
    ...edit,
    path: hasUsablePath ? pathValue : "",
    call_id: edit.call_id || `${edit.tool}:${pathValue || "pending"}`,
    added: Number.isFinite(edit.added) ? Math.max(0, Math.round(edit.added)) : 0,
    deleted: Number.isFinite(edit.deleted) ? Math.max(0, Math.round(edit.deleted)) : 0,
    status: edit.status === "error" || edit.status === "done" || edit.status === "editing"
      ? edit.status
      : inferredStatus,
  };
  if (edit.pending && !hasUsablePath) normalized.pending = true;
  return normalized;
}

export function mergeFileEdits(
  existing: UIFileEdit[] | undefined,
  incoming: UIFileEdit[],
): UIFileEdit[] {
  const next = [...(existing ?? [])];
  const indexByKey = new Map(next.map((edit, index) => [fileEditKey(edit), index]));
  for (const raw of incoming) {
    const edit = normalizeFileEdit(raw);
    if (!edit) continue;
    const key = fileEditKey(edit);
    const existingIndex = indexByKey.get(key);
    if (existingIndex === undefined) {
      indexByKey.set(key, next.length);
      next.push(edit);
      continue;
    }
    const merged = { ...next[existingIndex], ...edit };
    if (edit.path && !edit.pending) delete merged.pending;
    next[existingIndex] = merged;
  }
  return next;
}

function findFileEditTraceIndex(
  prev: UIMessage[],
  segmentId: string,
  incoming: UIFileEdit[],
): number | null {
  const incomingKeys = new Set(incoming.map(fileEditKey));
  const callIds = new Set(
    incoming
      .map((edit) => edit.call_id)
      .filter((id): id is string => typeof id === "string" && id.length > 0),
  );

  for (let i = prev.length - 1; i >= 0; i -= 1) {
    const candidate = prev[i];
    if (candidate.role === "user") break;
    if (candidate.kind !== "trace") continue;
    if (candidate.activitySegmentId && candidate.activitySegmentId !== segmentId) {
      continue;
    }

    if (candidate.fileEdits?.length) {
      for (const existing of candidate.fileEdits) {
        if (incomingKeys.has(fileEditKey(existing))) return i;
      }
    }

    if (callIds.size > 0 && candidate.toolProgress) {
      for (const callId of callIds) {
        if (candidate.toolProgress[callId]) return i;
      }
    }
  }

  for (let i = prev.length - 1; i >= 0; i -= 1) {
    const candidate = prev[i];
    if (candidate.role === "user") break;
    if (candidate.kind !== "trace") continue;
    if (candidate.activitySegmentId === segmentId) return i;
  }

  return null;
}

export function mergeFileEditIntoTrace(
  prev: UIMessage[],
  segmentId: string,
  edits: UIFileEdit[],
): UIMessage[] {
  const normalized = mergeFileEdits(undefined, edits);
  if (normalized.length === 0) return prev;
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

// ── Tool progress helpers ──

function findToolProgressTraceIndex(
  prev: UIMessage[],
  incoming: ToolProgressEvent,
  segmentId: string,
): number | null {
  const key = toolProgressKey(incoming);
  for (let i = prev.length - 1; i >= 0; i -= 1) {
    const candidate = prev[i];
    if (candidate.role === "user") break;
    if (candidate.kind !== "trace") continue;
    if (candidate.toolProgress?.[key]) return i;
  }
  for (let i = prev.length - 1; i >= 0; i -= 1) {
    const candidate = prev[i];
    if (candidate.role === "user") break;
    if (candidate.kind !== "trace") continue;
    if (candidate.activitySegmentId === segmentId) return i;
  }
  return null;
}

export function appendToolProgressTrace(
  prev: UIMessage[],
  toolEvent: ToolProgressEvent,
  segmentId: string,
): UIMessage[] {
  const targetIndex = findToolProgressTraceIndex(prev, toolEvent, segmentId);
  if (targetIndex !== null) {
    const target = prev[targetIndex];
    const toolProgress = upsertToolProgress(target.toolProgress, toolEvent);
    const traces = linesFromToolProgress(toolProgress);
    const merged: UIMessage = {
      ...target,
      toolProgress,
      traces,
      content: traces[traces.length - 1] ?? target.content,
      activitySegmentId: target.activitySegmentId ?? segmentId,
    };
    return replaceMessageAt(prev, targetIndex, merged);
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
