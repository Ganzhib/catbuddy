import type { ToolProgressEvent } from "@learnbuddy/shared";
interface ToolCallCardsProps {
    toolProgress: Record<string, ToolProgressEvent>;
    className?: string;
}
export declare function ToolCallCards({ toolProgress, className }: ToolCallCardsProps): import("react/jsx-runtime").JSX.Element | null;
/** Legacy progress lines (compression hints, tools summary). */
export declare function ProgressTraceLines({ lines, className, }: {
    lines: string[];
    className?: string;
}): import("react/jsx-runtime").JSX.Element | null;
export {};
//# sourceMappingURL=ToolCallCards.d.ts.map