import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
/**
 * Rounded, shadowed composer with an embedded send button — modeled after the
 * agent-chat-ui input: a single surface that looks like one interactive unit
 * rather than a textarea + button pair.
 */
export function Composer({ onSend, disabled, placeholder = "Type your message…", compact = false, }) {
    const [value, setValue] = useState("");
    const textareaRef = useRef(null);
    // Autofocus on mount — coming back to a chat, switching sessions, or
    // opening the welcome screen should always land the caret in the box.
    useEffect(() => {
        if (disabled)
            return;
        const el = textareaRef.current;
        if (!el)
            return;
        // Defer so layout settles first (important during enter animations).
        const id = requestAnimationFrame(() => el.focus());
        return () => cancelAnimationFrame(id);
    }, [disabled]);
    const submit = useCallback(() => {
        const trimmed = value.trim();
        if (!trimmed || disabled)
            return;
        onSend(trimmed);
        setValue("");
        requestAnimationFrame(() => {
            const el = textareaRef.current;
            if (el) {
                el.style.height = "auto";
                el.focus();
            }
        });
    }, [disabled, onSend, value]);
    const onKeyDown = (e) => {
        if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            submit();
        }
    };
    const onInput = (e) => {
        const el = e.currentTarget;
        el.style.height = "auto";
        el.style.height = `${Math.min(el.scrollHeight, 260)}px`;
    };
    return (_jsx("form", { onSubmit: (e) => {
            e.preventDefault();
            submit();
        }, className: cn("w-full", compact ? "px-0" : "bg-background/95 px-4 pb-4 pt-2 backdrop-blur"), children: _jsxs("div", { className: cn("relative mx-auto flex w-full max-w-[64rem] flex-col overflow-hidden rounded-3xl", "border bg-muted/60 shadow-sm transition-all duration-200", "focus-within:bg-muted focus-within:shadow-md focus-within:ring-1 focus-within:ring-foreground/10", disabled && "opacity-60"), children: [_jsx("textarea", { ref: textareaRef, value: value, onChange: (e) => setValue(e.target.value), onInput: onInput, onKeyDown: onKeyDown, rows: 1, placeholder: placeholder, disabled: disabled, "aria-label": "Message input", className: cn("min-h-[56px] w-full resize-none bg-transparent px-5 pt-4 pb-2 text-sm", "placeholder:text-muted-foreground", "focus:outline-none focus-visible:outline-none", "disabled:cursor-not-allowed") }), _jsxs("div", { className: "flex items-center justify-between gap-2 px-3 pb-2", children: [_jsx("span", { className: "hidden select-none text-[11px] text-muted-foreground/70 sm:inline", children: "Enter to send \u00B7 Shift+Enter for newline" }), _jsx("span", { className: "sm:hidden", "aria-hidden": true }), _jsx(Button, { type: "submit", size: "icon", disabled: disabled || !value.trim(), "aria-label": "Send message", className: cn("h-9 w-9 rounded-full shadow-sm transition-transform", value.trim() && !disabled && "hover:scale-[1.03] active:scale-95"), children: _jsx(ArrowUp, { className: "h-4 w-4" }) })] })] }) }));
}
//# sourceMappingURL=Composer.js.map