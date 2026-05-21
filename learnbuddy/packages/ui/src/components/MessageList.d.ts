import type { UIMessage } from "@learnbuddy/shared";
interface MessageListProps {
    messages: UIMessage[];
    isStreaming: boolean;
}
/**
 * Scrollable message log. Auto-sticks to the bottom as new content arrives,
 * but only when the user was already at the bottom — preserving scroll
 * position when they've scrolled up to read earlier turns. A floating
 * "scroll to bottom" button appears whenever we're detached from the bottom.
 */
export declare function MessageList({ messages, isStreaming }: MessageListProps): import("react/jsx-runtime").JSX.Element;
export {};
//# sourceMappingURL=MessageList.d.ts.map