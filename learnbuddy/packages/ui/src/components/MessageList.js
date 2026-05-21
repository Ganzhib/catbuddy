import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowDown } from "lucide-react";
import { MessageBubble } from "@/components/MessageBubble";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
const NEAR_BOTTOM_PX = 48;
/**
 * Scrollable message log. Auto-sticks to the bottom as new content arrives,
 * but only when the user was already at the bottom — preserving scroll
 * position when they've scrolled up to read earlier turns. A floating
 * "scroll to bottom" button appears whenever we're detached from the bottom.
 */
export function MessageList({ messages, isStreaming }) {
    const scrollRef = useRef(null);
    const [atBottom, setAtBottom] = useState(true);
    const scrollToBottom = useCallback((smooth = false) => {
        const el = scrollRef.current;
        if (!el)
            return;
        el.scrollTo({
            top: el.scrollHeight,
            behavior: smooth ? "smooth" : "auto",
        });
    }, []);
    // Keep the viewport pinned to the bottom as long as the user hasn't
    // scrolled up. During streaming we do instant jumps (smooth scrolling each
    // token fights the incoming animations); on settled updates we animate.
    useEffect(() => {
        if (!atBottom)
            return;
        scrollToBottom(!isStreaming);
    }, [messages, isStreaming, atBottom, scrollToBottom]);
    useEffect(() => {
        const el = scrollRef.current;
        if (!el)
            return;
        const onScroll = () => {
            const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
            setAtBottom(distance < NEAR_BOTTOM_PX);
        };
        el.addEventListener("scroll", onScroll, { passive: true });
        return () => el.removeEventListener("scroll", onScroll);
    }, []);
    if (messages.length === 0) {
        return (_jsx("div", { className: "flex h-full items-center justify-center text-sm text-muted-foreground", children: "Say hi to get started." }));
    }
    return (_jsxs("div", { className: "relative flex min-h-0 flex-1 overflow-hidden", children: [_jsx("div", { ref: scrollRef, className: cn("h-full overflow-y-auto scroll-smooth", "[&::-webkit-scrollbar]:w-1.5", "[&::-webkit-scrollbar-thumb]:rounded-full", "[&::-webkit-scrollbar-thumb]:bg-muted-foreground/30", "[&::-webkit-scrollbar-track]:bg-transparent"), children: _jsx("div", { className: "mx-auto flex w-full max-w-[64rem] flex-col gap-6 px-4 pt-4 pb-8", children: messages.map((m) => (_jsx(MessageBubble, { message: m }, m.id))) }) }), _jsx("div", { "aria-hidden": true, className: "pointer-events-none absolute inset-x-0 top-0 h-6 bg-gradient-to-b from-background to-transparent" }), _jsx("div", { "aria-hidden": true, className: "pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-background to-transparent" }), !atBottom && (_jsx(Button, { variant: "outline", size: "icon", onClick: () => scrollToBottom(true), className: cn("absolute bottom-2 left-1/2 h-8 w-8 -translate-x-1/2 rounded-full shadow-md", "bg-background/90 backdrop-blur", "animate-in fade-in-0 zoom-in-95"), "aria-label": "Scroll to bottom", children: _jsx(ArrowDown, { className: "h-4 w-4" }) }))] }));
}
//# sourceMappingURL=MessageList.js.map