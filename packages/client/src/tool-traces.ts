import type { ToolProgressEvent } from "@learnbuddy/shared";

const DETAIL_PREVIEW_CHARS = 120;

/** Stable key for merging start/end/error into one UI row. */
export function toolProgressKey(event: ToolProgressEvent): string {
  if (event.call_id) return event.call_id;
  return event.name ? `name:${event.name}` : "unknown";
}

function formatArgs(arguments_: unknown): string {
  if (arguments_ == null) return "";
  if (typeof arguments_ === "string") {
    const trimmed = arguments_.trim();
    if (!trimmed) return "";
    return trimmed.length > 80 ? `${trimmed.slice(0, 80)}…` : trimmed;
  }
  if (typeof arguments_ === "object") {
    const json = JSON.stringify(arguments_);
    return json.length > 80 ? `${json.slice(0, 80)}…` : json;
  }
  return String(arguments_);
}

export type ToolCallUiStatus = "running" | "done" | "error";

export function toolCallUiStatus(event: ToolProgressEvent): ToolCallUiStatus {
  const phase = event.phase ?? "start";
  if (phase === "error") return "error";
  if (phase === "end") return "done";
  return "running";
}

export function toolCallTitle(event: ToolProgressEvent): string {
  return event.name ?? "tool";
}

export function toolLabel(event: ToolProgressEvent): string {
  const name = toolCallTitle(event);
  const args = formatArgs(event.arguments);
  return args ? `${name}(${args})` : `${name}()`;
}

/** Multi-line arguments for expanded tool card. */
export function formatToolArgumentsBlock(arguments_: unknown): string | null {
  if (arguments_ == null) return null;
  if (typeof arguments_ === "string") {
    const trimmed = arguments_.trim();
    return trimmed || null;
  }
  try {
    return JSON.stringify(arguments_, null, 2);
  } catch {
    return String(arguments_);
  }
}

export function toolCallDetailText(event: ToolProgressEvent): string | null {
  if (typeof event.error === "string" && event.error.trim()) return event.error.trim();
  if (typeof event.detail === "string" && event.detail.trim()) return event.detail.trim();
  if (event.result != null) {
    if (typeof event.result === "string") return event.result;
    try {
      return JSON.stringify(event.result, null, 2);
    } catch {
      return String(event.result);
    }
  }
  return null;
}

export function sortedToolProgressEntries(
  toolProgress: Record<string, ToolProgressEvent>,
): [string, ToolProgressEvent][] {
  return Object.entries(toolProgress).sort(([, a], [, b]) => {
    const order = (e: ToolProgressEvent) => {
      const s = toolCallUiStatus(e);
      if (s === "running") return 0;
      if (s === "error") return 1;
      return 2;
    };
    return order(a) - order(b);
  });
}

function truncateDetail(detail: string): string {
  const oneLine = detail.replace(/\s+/g, " ").trim();
  if (oneLine.length <= DETAIL_PREVIEW_CHARS) return oneLine;
  return `${oneLine.slice(0, DETAIL_PREVIEW_CHARS)}…`;
}

/** One display line per tool call (updates in place via toolProgress map). */
export function formatToolProgressLine(event: ToolProgressEvent): string {
  const label = toolLabel(event);
  const phase = event.phase ?? "start";

  if (phase === "start") {
    return `▶ ${label}`;
  }
  if (phase === "error") {
    const detail =
      typeof event.error === "string"
        ? event.error
        : typeof event.detail === "string"
          ? event.detail
          : "";
    return detail ? `✗ ${label} — ${truncateDetail(detail)}` : `✗ ${label}`;
  }
  if (phase === "end") {
    const detail = typeof event.detail === "string" ? event.detail : "";
    if (detail) {
      return `✓ ${label} — ${truncateDetail(detail)}`;
    }
    return `✓ ${label}`;
  }
  return label;
}

export function linesFromToolProgress(
  toolProgress: Record<string, ToolProgressEvent> | undefined,
): string[] {
  if (!toolProgress) return [];
  return Object.values(toolProgress).map(formatToolProgressLine);
}

export function upsertToolProgress(
  existing: Record<string, ToolProgressEvent> | undefined,
  incoming: ToolProgressEvent,
): Record<string, ToolProgressEvent> {
  const key = toolProgressKey(incoming);
  const prev = existing?.[key];
  return {
    ...existing,
    [key]: {
      ...prev,
      ...incoming,
      name: incoming.name ?? prev?.name,
      call_id: incoming.call_id ?? prev?.call_id,
      arguments: incoming.arguments ?? prev?.arguments,
    },
  };
}

/** Map backend ToolEvent (IPC) → UI ToolProgressEvent. */
export function toolProgressFromBackendEvent(data: {
  name: string;
  status: "started" | "completed" | "error";
  callId?: string;
  arguments?: Record<string, unknown>;
  detail?: string;
  durationMs?: number;
}): ToolProgressEvent {
  const phase =
    data.status === "started"
      ? "start"
      : data.status === "error"
        ? "error"
        : "end";
  return {
    version: 1,
    phase,
    call_id: data.callId ?? `name:${data.name}`,
    name: data.name,
    arguments: data.arguments,
    detail: data.detail,
    durationMs: data.durationMs,
    error: data.status === "error" ? data.detail : undefined,
  };
}
