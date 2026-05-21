import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { MoreHorizontal, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, } from "@/components/ui/dropdown-menu";
import { deriveTitle } from "@/lib/format";
import { cn } from "@/lib/utils";
export function ChatList({ sessions, activeKey, onSelect, onRequestDelete, loading, emptyLabel, }) {
    const { t } = useTranslation();
    if (loading && sessions.length === 0) {
        return (_jsx("div", { className: "px-3 py-6 text-[12px] text-muted-foreground", children: t("chat.loading") }));
    }
    if (sessions.length === 0) {
        return (_jsx("div", { className: "px-3 py-6 text-[12px] leading-5 text-muted-foreground/80", children: emptyLabel ?? t("chat.noSessions") }));
    }
    const groups = groupSessions(sessions, {
        today: t("chat.groups.today"),
        yesterday: t("chat.groups.yesterday"),
        earlier: t("chat.groups.earlier"),
    });
    return (_jsx("div", { className: "h-full min-h-0 min-w-0 overflow-x-hidden overflow-y-auto overscroll-contain", children: _jsx("div", { className: "min-w-0 space-y-3 px-2 py-1.5", children: groups.map((group) => (_jsxs("section", { "aria-label": group.label, children: [_jsx("div", { className: "px-2 pb-1 text-[12px] font-medium text-muted-foreground/65", children: group.label }), _jsx("ul", { className: "space-y-0.5", children: group.sessions.map((s) => {
                            const active = s.key === activeKey;
                            const fallbackTitle = t("chat.fallbackTitle", {
                                id: s.chatId.slice(0, 6),
                            });
                            const generatedTitle = s.title?.trim() || "";
                            const title = generatedTitle || deriveTitle(s.preview, t("chat.newChat"));
                            const tooltipTitle = generatedTitle || deriveTitle(s.preview, fallbackTitle);
                            return (_jsx("li", { className: "min-w-0", children: _jsxs("div", { className: cn("group flex min-h-8 min-w-0 max-w-full items-center gap-2 rounded-xl px-2 text-[13px] transition-colors", active
                                        ? "bg-sidebar-accent/70 text-sidebar-accent-foreground shadow-[inset_0_0_0_1px_hsl(var(--sidebar-border)/0.28)]"
                                        : "text-sidebar-foreground/82 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"), children: [_jsx("button", { type: "button", onClick: () => onSelect(s.key), title: tooltipTitle, className: "min-w-0 flex-1 overflow-hidden py-1.5 text-left", children: _jsx("span", { className: "block w-full truncate font-medium leading-5", children: title }) }), _jsxs(DropdownMenu, { modal: false, children: [_jsx(DropdownMenuTrigger, { className: cn("inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted-foreground/75 opacity-40 transition-opacity", "hover:bg-sidebar-accent hover:text-sidebar-foreground group-hover:opacity-100", "focus-visible:opacity-100", active && "opacity-100"), "aria-label": t("chat.actions", { title }), children: _jsx(MoreHorizontal, { className: "h-3.5 w-3.5" }) }), _jsx(DropdownMenuContent, { align: "end", onCloseAutoFocus: (event) => event.preventDefault(), children: _jsxs(DropdownMenuItem, { onSelect: () => {
                                                            window.setTimeout(() => onRequestDelete(s.key, title), 0);
                                                        }, className: "text-destructive focus:text-destructive", children: [_jsx(Trash2, { className: "mr-2 h-4 w-4" }), t("chat.delete")] }) })] })] }) }, s.key));
                        }) })] }, group.label))) }) }));
}
function groupSessions(sessions, labels) {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const startOfYesterday = startOfToday - 24 * 60 * 60 * 1000;
    const buckets = new Map();
    for (const session of sessions) {
        const timestamp = Date.parse(session.updatedAt ?? session.createdAt ?? "");
        const label = Number.isFinite(timestamp) && timestamp >= startOfToday
            ? labels.today
            : Number.isFinite(timestamp) && timestamp >= startOfYesterday
                ? labels.yesterday
                : labels.earlier;
        const bucket = buckets.get(label) ?? [];
        bucket.push(session);
        buckets.set(label, bucket);
    }
    return [labels.today, labels.yesterday, labels.earlier]
        .map((label) => ({ label, sessions: buckets.get(label) ?? [] }))
        .filter((group) => group.sessions.length > 0);
}
//# sourceMappingURL=ChatList.js.map