import type { ToolProgressEvent } from "@learnbuddy/shared";
/** Stable key for merging start/end/error into one UI row. */
export declare function toolProgressKey(event: ToolProgressEvent): string;
export type ToolCallUiStatus = "running" | "done" | "error";
export declare function toolCallUiStatus(event: ToolProgressEvent): ToolCallUiStatus;
export declare function toolCallTitle(event: ToolProgressEvent): string;
export declare function toolLabel(event: ToolProgressEvent): string;
/** Multi-line arguments for expanded tool card. */
export declare function formatToolArgumentsBlock(arguments_: unknown): string | null;
export declare function toolCallDetailText(event: ToolProgressEvent): string | null;
export declare function sortedToolProgressEntries(toolProgress: Record<string, ToolProgressEvent>): [string, ToolProgressEvent][];
/** One display line per tool call (updates in place via toolProgress map). */
export declare function formatToolProgressLine(event: ToolProgressEvent): string;
export declare function linesFromToolProgress(toolProgress: Record<string, ToolProgressEvent> | undefined): string[];
export declare function upsertToolProgress(existing: Record<string, ToolProgressEvent> | undefined, incoming: ToolProgressEvent): Record<string, ToolProgressEvent>;
/** Map backend ToolEvent (IPC) → UI ToolProgressEvent. */
export declare function toolProgressFromBackendEvent(data: {
    name: string;
    status: "started" | "completed" | "error";
    callId?: string;
    arguments?: Record<string, unknown>;
    detail?: string;
    durationMs?: number;
}): ToolProgressEvent;
//# sourceMappingURL=tool-traces.d.ts.map