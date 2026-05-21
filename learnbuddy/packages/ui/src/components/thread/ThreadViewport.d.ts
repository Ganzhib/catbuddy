import { type ReactNode } from "react";
import type { UIMessage } from "@learnbuddy/shared";
interface ThreadViewportProps {
    messages: UIMessage[];
    isStreaming: boolean;
    composer: ReactNode;
    emptyState?: ReactNode;
    scrollToBottomSignal?: number;
    conversationKey?: string | null;
    showScrollToBottomButton?: boolean;
}
export declare const INITIAL_HISTORY_WINDOW = 160;
export declare const HISTORY_WINDOW_INCREMENT = 120;
export declare function windowMessages(messages: UIMessage[], visibleCount: number): UIMessage[];
export declare function ThreadViewport({ messages, isStreaming, composer, emptyState, scrollToBottomSignal, conversationKey, showScrollToBottomButton, }: ThreadViewportProps): import("react/jsx-runtime").JSX.Element;
export {};
//# sourceMappingURL=ThreadViewport.d.ts.map