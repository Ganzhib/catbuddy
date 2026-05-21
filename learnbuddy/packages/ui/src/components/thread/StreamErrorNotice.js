import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { AlertTriangle, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
/**
 * Dismissible banner that surfaces transport-level faults the user needs to
 * know about. Rendered above the composer so the message the fault referred
 * to remains in view just above. ``role="alert"`` + ``aria-live="assertive"``
 * ensures screen readers announce the failure.
 */
export function StreamErrorNotice({ error, onDismiss }) {
    const { t } = useTranslation();
    const { title, body } = resolveCopy(error, t);
    return (_jsxs("div", { role: "alert", "aria-live": "assertive", className: cn("mb-2 flex items-start gap-2 rounded-lg border border-destructive/30", "bg-destructive/10 px-3 py-2 text-[12px] leading-5 text-destructive", "animate-in fade-in-0 slide-in-from-bottom-1"), children: [_jsx(AlertTriangle, { className: "mt-0.5 h-4 w-4 shrink-0", "aria-hidden": true }), _jsxs("div", { className: "flex-1", children: [_jsx("p", { className: "font-medium", children: title }), _jsx("p", { className: "mt-0.5 text-destructive/80", children: body })] }), _jsx(Button, { variant: "ghost", size: "icon", onClick: onDismiss, "aria-label": t("common.dismiss"), className: "h-6 w-6 shrink-0 text-destructive hover:bg-destructive/15 hover:text-destructive", children: _jsx(X, { className: "h-3.5 w-3.5" }) })] }));
}
function resolveCopy(error, t) {
    switch (error.kind) {
        case "message_too_big":
            return {
                title: t("errors.messageTooBig.title"),
                body: t("errors.messageTooBig.body"),
            };
        default: {
            // Exhaustiveness guard: if a new StreamError kind is added, TS will
            // complain here until we add a corresponding i18n branch.
            const _exhaustive = error.kind;
            return { title: String(_exhaustive), body: "" };
        }
    }
}
//# sourceMappingURL=StreamErrorNotice.js.map