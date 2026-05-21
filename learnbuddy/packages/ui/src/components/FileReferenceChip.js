import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger, } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
export function FileReferenceChip({ path, tooltipPath, display = "name", active = false, className, textClassName, testId = "inline-file-path", }) {
    const { directory, name } = splitFilePath(path);
    const kind = fileKindForPath(path);
    const displayText = display === "path" ? path.replace(/\\/g, "/") : name;
    const fullPath = tooltipPath || path;
    return (_jsx(TooltipProvider, { delayDuration: 500, skipDelayDuration: 100, children: _jsxs(Tooltip, { children: [_jsx(TooltipTrigger, { asChild: true, children: _jsx("span", { className: cn("not-prose inline-flex max-w-full align-baseline leading-[inherit]", className), children: _jsxs("span", { "data-testid": testId, "aria-label": fullPath, className: cn("inline-flex max-w-full items-center gap-1 font-medium leading-[inherit]", "text-sky-600 transition-colors hover:text-sky-700", "dark:text-sky-300 dark:hover:text-sky-200"), children: [_jsx(FileReferenceIcon, { kind: kind }), _jsx("span", { "data-sheen-text": active ? displayText : undefined, className: cn("min-w-0 max-w-full truncate", active && "streaming-text-sheen file-reference-sheen", textClassName), children: display === "path" && directory ? (_jsxs(_Fragment, { children: [_jsx("span", { className: "text-muted-foreground/65", children: directory }), _jsx("span", { className: "font-semibold text-sky-700 dark:text-sky-200", children: name })] })) : (displayText) })] }) }) }), _jsx(TooltipContent, { side: "top", align: "center", sideOffset: 8, collisionPadding: 12, className: cn("max-w-[min(38rem,calc(100vw-2rem))] rounded-[10px]", "border-border/60 bg-popover/95 px-2.5 py-1.5", "break-all font-mono text-[11px] leading-snug text-popover-foreground", "shadow-lg backdrop-blur"), children: fullPath })] }) }));
}
export function isLikelyFilePath(value) {
    const raw = value.trim();
    if (!raw || raw.includes("\n"))
        return false;
    if (/^[a-z][a-z0-9+.-]*:\/\//i.test(raw))
        return false;
    if (!/[\\/]/.test(raw) && !/^(dockerfile|makefile|readme|package-lock\.json)$/i.test(raw)) {
        return false;
    }
    const normalized = raw.replace(/\\/g, "/");
    const name = normalized.split("/").filter(Boolean).pop() ?? normalized;
    if (!name || name === "." || name === "..")
        return false;
    if (/^(dockerfile|makefile|readme|package-lock\.json)$/i.test(name))
        return true;
    return /\.[a-z0-9][a-z0-9_-]{0,12}$/i.test(name);
}
function splitFilePath(path) {
    const normalized = path.replace(/\\/g, "/");
    const slash = normalized.lastIndexOf("/");
    if (slash < 0)
        return { directory: "", name: path };
    return {
        directory: normalized.slice(0, slash + 1),
        name: normalized.slice(slash + 1) || normalized,
    };
}
function fileKindForPath(path) {
    const normalized = path.toLowerCase();
    const name = normalized.split(/[\\/]/).pop() ?? normalized;
    const ext = name.includes(".") ? name.split(".").pop() ?? "" : "";
    if (name === "dockerfile") {
        return "default";
    }
    switch (ext) {
        case "py":
        case "pyi":
            return "python";
        case "jsx":
        case "tsx":
            return "react";
        case "ts":
            return "typescript";
        case "html":
        case "htm":
            return "html";
        case "css":
        case "scss":
        case "sass":
            return "css";
        case "json":
        case "jsonl":
            return "json";
        case "md":
        case "mdx":
            return "markdown";
        case "ipynb":
            return "notebook";
        default:
            return "default";
    }
}
function FileReferenceIcon({ kind }) {
    if (kind === "react") {
        return (_jsxs("svg", { "aria-hidden": true, className: "h-[0.98em] w-[0.98em] shrink-0 text-sky-500 dark:text-sky-300", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "1.6", strokeLinecap: "round", strokeLinejoin: "round", children: [_jsx("circle", { cx: "12", cy: "12", r: "1.9", fill: "currentColor", stroke: "none" }), _jsx("ellipse", { cx: "12", cy: "12", rx: "9", ry: "3.7" }), _jsx("ellipse", { cx: "12", cy: "12", rx: "9", ry: "3.7", transform: "rotate(60 12 12)" }), _jsx("ellipse", { cx: "12", cy: "12", rx: "9", ry: "3.7", transform: "rotate(120 12 12)" })] }));
    }
    if (kind === "default") {
        return (_jsxs("svg", { "aria-hidden": true, className: "h-[0.98em] w-[0.98em] shrink-0 text-sky-500 dark:text-sky-300", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "1.9", strokeLinecap: "round", strokeLinejoin: "round", children: [_jsx("path", { d: "M14 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7z" }), _jsx("path", { d: "M14 2v5h5" })] }));
    }
    const label = fileKindLabel(kind);
    return (_jsx("span", { "aria-hidden": true, className: cn("inline-flex h-[1.05em] min-w-[1.05em] shrink-0 items-center justify-center", "rounded-[4px] bg-sky-500/12 px-[0.22em] text-[0.58em] font-bold uppercase leading-none", "text-sky-600 dark:bg-sky-400/15 dark:text-sky-300"), children: label }));
}
function fileKindLabel(kind) {
    switch (kind) {
        case "css":
            return "#";
        case "html":
            return "H";
        case "json":
            return "{}";
        case "markdown":
            return "M";
        case "notebook":
            return "N";
        case "python":
            return "PY";
        case "typescript":
            return "TS";
        default:
            return "";
    }
}
//# sourceMappingURL=FileReferenceChip.js.map