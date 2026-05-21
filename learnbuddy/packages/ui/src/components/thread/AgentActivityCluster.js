import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, ChevronRight, Layers } from "lucide-react";
import { useTranslation } from "react-i18next";
import { FileReferenceChip } from "@/components/FileReferenceChip";
import { ReasoningBubble, StreamingLabelSheen, TraceGroup } from "@/components/MessageBubble";
import { cn } from "@/lib/utils";
/** Scrollport height for the Cursor-style “live trace” strip (tailwind spacing). */
const CLUSTER_SCROLL_MAX_CLASS = "max-h-52";
const ACTIVITY_SCROLL_NEAR_BOTTOM_PX = 24;
export function isReasoningOnlyAssistant(m) {
    if (m.role !== "assistant" || m.kind === "trace")
        return false;
    if (m.content.trim().length > 0)
        return false;
    return !!(m.reasoning?.length || m.reasoningStreaming || m.isStreaming);
}
export function isAgentActivityMember(m) {
    return isReasoningOnlyAssistant(m) || m.kind === "trace";
}
function countActivity(messages, fileEdits) {
    let reasoningSteps = 0;
    let toolCalls = 0;
    for (const m of messages) {
        if (isReasoningOnlyAssistant(m)) {
            reasoningSteps += 1;
            continue;
        }
        if (m.kind === "trace") {
            if (m.toolProgress && Object.keys(m.toolProgress).length > 0) {
                toolCalls += Object.keys(m.toolProgress).length;
            }
            else {
                const lines = m.traces?.length ?? (m.content.trim() ? 1 : 0);
                toolCalls += lines;
            }
        }
    }
    let added = 0;
    let deleted = 0;
    let hasEditingFiles = false;
    let failedFileCount = 0;
    let primaryFilePath;
    let primaryFileTooltipPath;
    for (const edit of fileEdits) {
        primaryFilePath = edit.path;
        primaryFileTooltipPath = edit.absolute_path || edit.path;
        if (edit.status === "editing") {
            hasEditingFiles = true;
        }
        if (edit.status === "error") {
            failedFileCount += 1;
        }
        if (edit.status === "error" || edit.binary) {
            continue;
        }
        added += edit.added;
        deleted += edit.deleted;
    }
    return {
        reasoningSteps,
        toolCalls,
        fileCount: fileEdits.length,
        added,
        deleted,
        hasEditingFiles,
        hasFailedFiles: fileEdits.length > 0 && failedFileCount === fileEdits.length,
        primaryFilePath,
        primaryFileTooltipPath,
    };
}
/**
 * Outer fold wrapping interleaved reasoning-only assistant rows and tool-trace rows.
 * Fixed max height with inner scroll; each block keeps its own small collapsible (reasoning / tools).
 */
export function AgentActivityCluster({ messages, isTurnStreaming, hasBodyBelow, }) {
    const { t } = useTranslation();
    const fileEdits = useMemo(() => summarizeFileEdits(collectFileEdits(messages), isTurnStreaming), [messages, isTurnStreaming]);
    const { reasoningSteps, toolCalls, fileCount, added, deleted, hasEditingFiles, hasFailedFiles, primaryFilePath, primaryFileTooltipPath, } = countActivity(messages, fileEdits);
    const hasPendingFileEdit = fileEdits.some((edit) => edit.pending);
    const hasLiveActivity = isTurnStreaming && (toolCalls > 0 || fileCount > 0 || reasoningSteps > 0);
    const [userToggledOuter, setUserToggledOuter] = useState(false);
    const [outerOpenLocal, setOuterOpenLocal] = useState(false);
    const activityScrollRef = useRef(null);
    const activityContentRef = useRef(null);
    const autoFollowActivityRef = useRef(true);
    const scrollFrameRef = useRef(null);
    /** Auto-expand while tools/files/reasoning are active; user can still collapse manually. */
    const outerExpanded = userToggledOuter ? outerOpenLocal : hasLiveActivity;
    const hasLiveEditingFiles = isTurnStreaming && hasEditingFiles;
    const headerBusy = fileCount > 0 ? hasEditingFiles : isTurnStreaming;
    const singleFilePath = fileCount === 1 ? primaryFilePath : undefined;
    const singleFileTooltipPath = fileCount === 1 ? primaryFileTooltipPath : undefined;
    const fileActivitySummary = fileCount > 0
        ? hasPendingFileEdit && !singleFilePath
            ? t("message.fileActivityPreparing", { defaultValue: "Preparing edit…" })
            : singleFilePath
                ? t(fileActivitySummaryKey(hasLiveEditingFiles, hasFailedFiles), {
                    file: shortFileName(singleFilePath),
                    defaultValue: `${fileActivityVerb(hasLiveEditingFiles, hasFailedFiles)} {{file}}`,
                })
                : t(fileActivityManySummaryKey(hasLiveEditingFiles, hasFailedFiles), {
                    count: fileCount,
                    defaultValue: `${fileActivityVerb(hasLiveEditingFiles, hasFailedFiles)} {{count}} files`,
                })
        : "";
    const summary = fileCount > 0
        ? fileActivitySummary
        : isTurnStreaming
            ? reasoningSteps > 0
                ? t("message.agentActivityLiveSummary", {
                    reasoning: reasoningSteps,
                    tools: toolCalls,
                    defaultValue: "Working… · {{reasoning}} steps · {{tools}} tool calls",
                })
                : toolCalls === 0 && fileCount > 0
                    ? t("message.agentActivityLiveFilesOnly", { defaultValue: "Working…" })
                    : t("message.agentActivityLiveToolsOnly", {
                        tools: toolCalls,
                        defaultValue: "Working… · {{tools}} tool calls",
                    })
            : reasoningSteps > 0
                ? t("message.agentActivitySummary", {
                    reasoning: reasoningSteps,
                    tools: toolCalls,
                    defaultValue: "{{reasoning}} steps · {{tools}} tool calls",
                })
                : toolCalls === 0 && fileCount > 0
                    ? t("message.agentActivityFilesOnly", { defaultValue: "File changes" })
                    : t("message.agentActivityToolsOnly", {
                        tools: toolCalls,
                        defaultValue: "{{tools}} tool calls",
                    });
    const cancelActivityScrollFrame = useCallback(() => {
        if (scrollFrameRef.current !== null) {
            window.cancelAnimationFrame(scrollFrameRef.current);
            scrollFrameRef.current = null;
        }
    }, []);
    const scrollActivityToBottom = useCallback(() => {
        const el = activityScrollRef.current;
        if (!el)
            return;
        el.scrollTop = Math.max(0, el.scrollHeight - el.clientHeight);
    }, []);
    const scheduleActivityScrollToBottom = useCallback(() => {
        cancelActivityScrollFrame();
        scrollFrameRef.current = window.requestAnimationFrame(() => {
            scrollFrameRef.current = null;
            scrollActivityToBottom();
        });
    }, [cancelActivityScrollFrame, scrollActivityToBottom]);
    const toggleOuter = () => {
        const nextOpen = userToggledOuter ? !outerOpenLocal : !outerExpanded;
        if (nextOpen) {
            autoFollowActivityRef.current = true;
        }
        setUserToggledOuter(true);
        setOuterOpenLocal(nextOpen);
    };
    useLayoutEffect(() => {
        if (!outerExpanded || !autoFollowActivityRef.current)
            return;
        scheduleActivityScrollToBottom();
    }, [outerExpanded, messages, isTurnStreaming, scheduleActivityScrollToBottom]);
    useEffect(() => {
        if (!outerExpanded) {
            autoFollowActivityRef.current = true;
            return;
        }
        const target = activityContentRef.current;
        if (!target || typeof ResizeObserver === "undefined")
            return;
        const observer = new ResizeObserver(() => {
            if (autoFollowActivityRef.current) {
                scheduleActivityScrollToBottom();
            }
        });
        observer.observe(target);
        return () => observer.disconnect();
    }, [outerExpanded, scheduleActivityScrollToBottom]);
    useEffect(() => cancelActivityScrollFrame, [cancelActivityScrollFrame]);
    const onActivityScroll = useCallback(() => {
        const el = activityScrollRef.current;
        if (!el)
            return;
        const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
        autoFollowActivityRef.current = distance < ACTIVITY_SCROLL_NEAR_BOTTOM_PX;
    }, []);
    return (_jsxs("div", { className: cn("w-full", hasBodyBelow && "mb-2"), children: [_jsxs("button", { type: "button", onClick: toggleOuter, className: cn("group flex w-full items-center gap-2 rounded-md px-2 py-1.5", "text-xs text-muted-foreground transition-colors hover:bg-muted/45"), "aria-expanded": outerExpanded, "aria-label": summary, children: [_jsx(Layers, { className: "h-3.5 w-3.5 shrink-0", "aria-hidden": true }), _jsxs("span", { className: "flex min-w-0 flex-1 flex-wrap items-center gap-x-1.5 gap-y-0.5 text-left", children: [singleFilePath ? (_jsxs("span", { className: "inline-flex min-w-0 items-center gap-1.5", children: [_jsx(StreamingLabelSheen, { active: headerBusy, className: "shrink-0", children: fileActivityVerb(hasLiveEditingFiles, hasFailedFiles) }), _jsx(FileReferenceChip, { path: singleFilePath, tooltipPath: singleFileTooltipPath, active: hasLiveEditingFiles, className: "-my-0.5 min-w-0", textClassName: "text-xs", testId: "activity-header-file-reference" })] })) : (_jsx(StreamingLabelSheen, { active: headerBusy, className: "min-w-0", children: summary })), fileCount > 0 && (_jsx("span", { className: "inline-flex min-w-0 items-center gap-1 text-muted-foreground/85", children: _jsx(DiffPair, { added: added, deleted: deleted }) }))] }), _jsx(ChevronRight, { "aria-hidden": true, className: cn("h-3.5 w-3.5 shrink-0 transition-transform duration-200", outerExpanded && "rotate-90") })] }), outerExpanded && (_jsx("div", { className: cn("mt-1 overflow-hidden rounded-md border border-border/50 bg-muted/25"), children: _jsx("div", { ref: activityScrollRef, "data-testid": "agent-activity-scroll", onScroll: onActivityScroll, className: cn(CLUSTER_SCROLL_MAX_CLASS, "overflow-y-auto px-2 py-1.5 scrollbar-thin scrollbar-track-transparent"), children: _jsxs("div", { ref: activityContentRef, className: "flex flex-col gap-2", children: [messages.map((m) => {
                                if (isReasoningOnlyAssistant(m)) {
                                    return (_jsx(ReasoningBubble, { text: m.reasoning ?? "", streaming: isTurnStreaming && !!m.reasoningStreaming, hasBodyBelow: false, embeddedInCluster: true }, m.id));
                                }
                                if (m.kind === "trace") {
                                    const hasTraceLines = (m.toolProgress && Object.keys(m.toolProgress).length > 0)
                                        || (m.traces?.length ?? 0) > 0
                                        || m.content.trim().length > 0;
                                    return hasTraceLines ? (_jsx("div", { className: "flex flex-col gap-1", children: _jsx(TraceGroup, { message: m, animClass: "" }) }, m.id)) : null;
                                }
                                return null;
                            }), fileEdits.length ? _jsx(FileEditGroup, { edits: fileEdits }) : null] }) }) }))] }));
}
function shortFileName(path) {
    return path.split(/[\\/]/).pop() || path;
}
function fileActivityVerb(editing, failed) {
    if (failed)
        return "Failed";
    return editing ? "Editing" : "Edited";
}
function fileActivitySummaryKey(editing, failed) {
    if (failed)
        return "message.fileActivityFailedOne";
    return editing ? "message.fileActivityEditingOne" : "message.fileActivityEditedOne";
}
function fileActivityManySummaryKey(editing, failed) {
    if (failed)
        return "message.fileActivityFailedMany";
    return editing ? "message.fileActivityEditingMany" : "message.fileActivityEditedMany";
}
function fileEditCallKey(edit) {
    if (edit.call_id)
        return `${edit.call_id}|${edit.tool}`;
    return `${edit.tool}|${edit.path}`;
}
function collectFileEdits(messages) {
    const edits = [];
    for (const message of messages) {
        if (message.kind === "trace" && message.fileEdits?.length) {
            edits.push(...message.fileEdits);
        }
    }
    return edits;
}
function latestFileEditEvents(edits) {
    const order = [];
    const byKey = new Map();
    for (const edit of edits) {
        const key = fileEditCallKey(edit);
        if (!byKey.has(key))
            order.push(key);
        byKey.set(key, edit);
    }
    return order.map((key) => byKey.get(key)).filter(Boolean);
}
function summarizeFileEdits(edits, active) {
    const order = [];
    const byPath = new Map();
    for (const edit of latestFileEditEvents(edits)) {
        const key = edit.path || edit.call_id || edit.tool;
        let summary = byPath.get(key);
        if (!summary) {
            summary = {
                key,
                path: edit.path || "",
                absolute_path: edit.absolute_path,
                added: 0,
                deleted: 0,
                approximate: false,
                binary: false,
                pending: false,
                hasSuccessfulChange: false,
                hasActiveEditing: false,
                hasFailed: false,
            };
            byPath.set(key, summary);
            order.push(key);
        }
        if (edit.path && !summary.path) {
            summary.path = edit.path;
        }
        if (edit.absolute_path) {
            summary.absolute_path = edit.absolute_path;
        }
        summary.pending = summary.pending || !!edit.pending || !edit.path;
        if (active && edit.status === "editing") {
            summary.hasActiveEditing = true;
            summary.binary = summary.binary || !!edit.binary;
            summary.approximate = summary.approximate || !!edit.approximate;
            if (!edit.binary) {
                summary.added += edit.added;
                summary.deleted += edit.deleted;
            }
            continue;
        }
        if (edit.status === "error") {
            summary.hasFailed = true;
            summary.error = edit.error ?? summary.error;
            continue;
        }
        summary.hasSuccessfulChange = true;
        summary.binary = summary.binary || !!edit.binary;
        summary.approximate = active && (summary.approximate || !!edit.approximate);
        if (!edit.binary) {
            summary.added += edit.added;
            summary.deleted += edit.deleted;
        }
    }
    return order.map((key) => {
        const summary = byPath.get(key);
        const status = summary.hasActiveEditing
            ? "editing"
            : summary.hasSuccessfulChange
                ? "done"
                : summary.hasFailed
                    ? "error"
                    : "done";
        return {
            key: summary.key,
            path: summary.path,
            absolute_path: summary.absolute_path,
            added: summary.added,
            deleted: summary.deleted,
            approximate: summary.approximate,
            binary: summary.binary,
            status,
            pending: summary.pending && !summary.path,
            error: summary.error,
        };
    });
}
function FileEditGroup({ edits }) {
    if (edits.length === 0)
        return null;
    return (_jsx("ul", { className: "space-y-1 border-l border-muted-foreground/15 pl-3", children: edits.map((edit) => (_jsx(FileEditRow, { edit: edit }, edit.key))) }));
}
function FileEditRow({ edit }) {
    const { t } = useTranslation();
    const editing = edit.status === "editing";
    const failed = edit.status === "error";
    const hasCountedDiff = !failed && !edit.binary;
    return (_jsxs("li", { className: "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-md px-2 py-1.5 text-xs", children: [_jsxs("div", { className: "flex min-w-0 items-center gap-2", children: [edit.pending && !edit.path ? (_jsx(StreamingLabelSheen, { active: editing, className: "min-w-0 text-[12px] font-medium text-muted-foreground", children: t("message.fileEditPreparing", { defaultValue: "Preparing file edit…" }) })) : (_jsx(FileReferenceChip, { path: edit.path, tooltipPath: edit.absolute_path, display: "path", active: editing, className: "min-w-0", textClassName: "text-[12px]", testId: "activity-file-reference" })), failed ? (_jsxs("span", { className: "inline-flex shrink-0 items-center gap-1 text-[10.5px] font-medium text-destructive/75", children: [_jsx(AlertCircle, { className: "h-3 w-3", "aria-hidden": true }), t("message.fileEditFailed", { defaultValue: "Failed" })] })) : null, edit.approximate && !failed ? (_jsx("span", { className: "shrink-0 text-[10.5px] font-medium text-muted-foreground/55", children: t("message.fileEditApproximate", { defaultValue: "estimated" }) })) : null] }), hasCountedDiff ? (_jsx(DiffPair, { added: edit.added, deleted: edit.deleted })) : null] }));
}
function DiffPair({ added, deleted }) {
    return (_jsxs("span", { className: "inline-flex shrink-0 translate-y-[0.055em] items-center gap-1.5 tabular-nums", children: [_jsx(DiffValue, { sign: "+", value: added, className: "text-emerald-600/75 dark:text-emerald-300/75" }), _jsx(DiffValue, { sign: "-", value: deleted, className: "text-rose-600/70 dark:text-rose-300/75" })] }));
}
function DiffValue({ sign, value, className }) {
    const safeValue = Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
    return (_jsxs("span", { className: cn("inline-flex", className), "aria-label": `${sign}${safeValue}`, children: [_jsxs("span", { className: "inline-flex", "aria-hidden": true, children: [sign, _jsx(AnimatedNumber, { value: safeValue })] }), _jsxs("span", { className: "sr-only", children: [sign, safeValue] })] }));
}
function AnimatedNumber({ value }) {
    const safeValue = Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
    const [display, setDisplay] = useState(0);
    const displayRef = useRef(0);
    const setAnimatedDisplay = useCallback((next) => {
        displayRef.current = next;
        setDisplay(next);
    }, []);
    useEffect(() => {
        const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
        if (reduceMotion) {
            setAnimatedDisplay(safeValue);
            return;
        }
        const start = displayRef.current;
        const delta = safeValue - start;
        if (delta === 0) {
            setAnimatedDisplay(safeValue);
            return;
        }
        const duration = 260;
        const startedAt = performance.now();
        let frame = 0;
        const tick = (now) => {
            const progress = Math.min(1, (now - startedAt) / duration);
            const eased = 1 - Math.pow(1 - progress, 3);
            setAnimatedDisplay(Math.round(start + delta * eased));
            if (progress < 1) {
                frame = window.requestAnimationFrame(tick);
                return;
            }
            displayRef.current = safeValue;
        };
        frame = window.requestAnimationFrame(tick);
        return () => window.cancelAnimationFrame(frame);
    }, [safeValue, setAnimatedDisplay]);
    return _jsx(RollingNumber, { value: display });
}
function RollingNumber({ value }) {
    const digits = String(value).split("");
    return (_jsx("span", { className: "inline-flex h-[1em] overflow-hidden align-[-0.13em]", "aria-hidden": true, children: digits.map((digit, index) => (_jsx(RollingDigit, { digit: Number(digit) }, `${digits.length}-${index}`))) }));
}
function RollingDigit({ digit }) {
    const safeDigit = Number.isFinite(digit) ? Math.min(9, Math.max(0, digit)) : 0;
    return (_jsx("span", { className: "relative inline-block h-[1em] w-[0.62em] overflow-hidden", children: _jsx("span", { className: "flex flex-col transition-transform duration-200 ease-out will-change-transform", style: { transform: `translateY(-${safeDigit}em)` }, children: Array.from({ length: 10 }, (_, n) => (_jsx("span", { className: "block h-[1em] leading-none", children: n }, n))) }) }));
}
//# sourceMappingURL=AgentActivityCluster.js.map