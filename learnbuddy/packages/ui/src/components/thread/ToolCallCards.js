import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
import { Check, ChevronRight, Loader2, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { formatToolArgumentsBlock, sortedToolProgressEntries, toolCallDetailText, toolCallTitle, toolCallUiStatus, toolLabel, } from "@learnbuddy/client";
export function ToolCallCards({ toolProgress, className }) {
    const entries = sortedToolProgressEntries(toolProgress);
    if (entries.length === 0)
        return null;
    return (_jsx("ul", { className: cn("flex flex-col gap-1.5", className), children: entries.map(([key, event]) => (_jsx(ToolCallCard, { event: event }, key))) }));
}
function ToolCallCard({ event }) {
    const { t } = useTranslation();
    const status = toolCallUiStatus(event);
    const running = status === "running";
    const [open, setOpen] = useState(false);
    const argsBlock = formatToolArgumentsBlock(event.arguments);
    const output = toolCallDetailText(event);
    const title = toolCallTitle(event);
    const subtitle = toolLabel(event);
    const statusLabel = status === "running"
        ? t("message.toolCard.running", { defaultValue: "Running" })
        : status === "error"
            ? t("message.toolCard.error", { defaultValue: "Failed" })
            : t("message.toolCard.done", { defaultValue: "Done" });
    return (_jsxs("li", { className: cn("overflow-hidden rounded-md border text-xs", status === "error"
            ? "border-destructive/25 bg-destructive/5"
            : status === "running"
                ? "border-primary/20 bg-primary/5"
                : "border-border/60 bg-background/60"), children: [_jsxs("button", { type: "button", onClick: () => setOpen((v) => !v), className: cn("flex w-full items-center gap-2 px-2.5 py-2 text-left", "transition-colors hover:bg-muted/40"), "aria-expanded": open, children: [_jsx(StatusIcon, { status: status }), _jsxs("div", { className: "min-w-0 flex-1", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("span", { className: "truncate font-medium text-foreground/90", children: title }), _jsx("span", { className: cn("shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium", status === "running" && "bg-primary/15 text-primary", status === "done" && "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300", status === "error" && "bg-destructive/10 text-destructive"), children: statusLabel })] }), !open ? (_jsx("p", { className: "mt-0.5 truncate font-mono text-[11px] text-muted-foreground/80", children: subtitle })) : null] }), _jsx(ChevronRight, { "aria-hidden": true, className: cn("h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform duration-200", open && "rotate-90") })] }), open ? (_jsxs("div", { className: cn("space-y-2 border-t border-border/50 px-2.5 py-2", "animate-in fade-in-0 slide-in-from-top-1 duration-200"), children: [argsBlock ? (_jsx(ToolCallSection, { label: t("message.toolCard.arguments", { defaultValue: "Arguments" }), children: _jsx("pre", { className: "max-h-32 overflow-auto whitespace-pre-wrap break-all rounded bg-muted/50 p-2 font-mono text-[11px] leading-relaxed text-muted-foreground", children: argsBlock }) })) : null, output ? (_jsx(ToolCallSection, { label: t("message.toolCard.output", { defaultValue: "Output" }), children: _jsx("pre", { className: "max-h-40 overflow-auto whitespace-pre-wrap break-words rounded bg-muted/50 p-2 font-mono text-[11px] leading-relaxed text-muted-foreground", children: output }) })) : running ? (_jsx("p", { className: "text-[11px] text-muted-foreground/70", children: t("message.toolCard.waiting", { defaultValue: "Waiting for result…" }) })) : null, typeof event.durationMs === "number" && event.durationMs > 0 ? (_jsx("p", { className: "text-[10.5px] tabular-nums text-muted-foreground/60", children: t("message.toolCard.duration", {
                            ms: event.durationMs,
                            defaultValue: "{{ms}} ms",
                        }) })) : null] })) : null] }));
}
function ToolCallSection({ label, children, }) {
    return (_jsxs("div", { children: [_jsx("p", { className: "mb-1 text-[10.5px] font-medium uppercase tracking-wide text-muted-foreground/55", children: label }), children] }));
}
function StatusIcon({ status }) {
    if (status === "running") {
        return _jsx(Loader2, { className: "h-3.5 w-3.5 shrink-0 animate-spin text-primary", "aria-hidden": true });
    }
    if (status === "error") {
        return _jsx(X, { className: "h-3.5 w-3.5 shrink-0 text-destructive", "aria-hidden": true });
    }
    return _jsx(Check, { className: "h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400", "aria-hidden": true });
}
/** Legacy progress lines (compression hints, tools summary). */
export function ProgressTraceLines({ lines, className, }) {
    const filtered = lines.filter((line) => line.trim().length > 0);
    if (filtered.length === 0)
        return null;
    return (_jsx("ul", { className: cn("space-y-0.5 border-l border-muted-foreground/20 pl-3", className), children: filtered.map((line, i) => (_jsx("li", { className: "whitespace-pre-wrap break-words font-mono text-[11.5px] leading-relaxed text-muted-foreground/90", children: line }, i))) }));
}
//# sourceMappingURL=ToolCallCards.js.map