import type { UIMessage } from "@learnbuddy/shared";
interface ThreadMessagesProps {
    messages: UIMessage[];
    /** When true, agent turn still in flight — keeps activity cluster expanded. */
    isStreaming?: boolean;
    hiddenMessageCount?: number;
    onLoadEarlier?: () => void;
}
export type DisplayUnit = {
    type: "cluster";
    messages: UIMessage[];
} | {
    type: "single";
    message: UIMessage;
};
/** True when this unit index is the last assistant text slice before the next user message (or end of thread). */
export declare function isFinalAssistantSliceBeforeNextUser(units: DisplayUnit[], index: number): boolean;
export declare function buildDisplayUnits(messages: UIMessage[]): DisplayUnit[];
export declare function assistantCopyFlags(units: DisplayUnit[]): boolean[];
export declare function ThreadMessages({ messages, isStreaming, hiddenMessageCount, onLoadEarlier, }: ThreadMessagesProps): import("react/jsx-runtime").JSX.Element;
export {};
//# sourceMappingURL=ThreadMessages.d.ts.map