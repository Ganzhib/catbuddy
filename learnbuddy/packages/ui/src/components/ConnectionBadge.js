import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { useClient } from "@/providers/ClientProvider";
const COPY = {
    idle: { color: "text-muted-foreground" },
    connecting: {
        color: "text-amber-700 dark:text-amber-300",
    },
    open: {
        color: "text-emerald-700 dark:text-emerald-400",
    },
    reconnecting: {
        color: "text-amber-700 dark:text-amber-300",
    },
    closed: {
        color: "text-muted-foreground",
    },
    error: {
        color: "text-destructive",
    },
};
export function ConnectionBadge() {
    const { t } = useTranslation();
    const { client } = useClient();
    const [status, setStatus] = useState(client.status);
    useEffect(() => client.onStatus(setStatus), [client]);
    const meta = COPY[status];
    const pulsing = status === "connecting" ||
        status === "reconnecting" ||
        status === "error";
    const label = t(`connection.${status}`);
    return (_jsxs("span", { className: cn("inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors", "text-muted-foreground/70 hover:bg-sidebar-accent/65", meta.color), "aria-live": "polite", role: "status", title: label, children: [_jsxs("span", { className: "relative flex h-2 w-2", "aria-hidden": true, children: [pulsing && (_jsx("span", { className: "absolute inline-flex h-full w-full animate-ping rounded-full bg-current opacity-75" })), _jsx("span", { className: "relative inline-flex h-2 w-2 rounded-full bg-current" })] }), _jsx("span", { className: "sr-only", children: label })] }));
}
//# sourceMappingURL=ConnectionBadge.js.map