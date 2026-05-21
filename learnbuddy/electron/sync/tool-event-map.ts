import type { ToolEvent } from "../../shared/types.js";

/** Map ToolEvent → UI tool_hint payload (mirrors src/lib/tool-traces). */
export function toolEventToUiHint(event: ToolEvent): Record<string, unknown> {
  const phase =
    event.status === "started"
      ? "start"
      : event.status === "error"
        ? "error"
        : "end";
  return {
    version: 1,
    phase,
    call_id: event.callId ?? `name:${event.name}`,
    name: event.name,
    arguments: event.arguments,
    detail: event.detail,
    durationMs: event.durationMs,
    error: event.status === "error" ? event.detail : undefined,
  };
}
