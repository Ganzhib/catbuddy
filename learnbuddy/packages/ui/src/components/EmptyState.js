import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { BrandMark } from "@/components/BrandMark";
import { Button } from "@/components/ui/button";
export function EmptyState({ onNewChat, }) {
    return (_jsxs("div", { className: "flex h-full flex-col items-center justify-center gap-4 text-center", children: [_jsx(BrandMark, { className: "h-14 w-14 object-contain opacity-90" }), _jsxs("div", { className: "space-y-1", children: [_jsx("p", { className: "text-lg font-medium", children: "No chats yet" }), _jsx("p", { className: "max-w-sm text-sm text-muted-foreground", children: "Start a conversation \u2014 your sessions are stored locally on the learnbuddy workspace and stay available across reloads." })] }), _jsx(Button, { onClick: onNewChat, children: "New chat" })] }));
}
//# sourceMappingURL=EmptyState.js.map