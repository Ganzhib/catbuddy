import { type ReactNode } from "react";
import type { UIMessage } from "@learnbuddy/shared";
interface MessageBubbleProps {
    message: UIMessage;
    /** When false, hide the assistant reply copy button (mid-turn text before more agent activity). Default true. */
    showAssistantCopyAction?: boolean;
}
/**
 * Render a single message. Following agent-chat-ui: user turns are a rounded
 * "pill" right-aligned with a muted fill; assistant turns render as bare
 * markdown so prose/code read like a document rather than a chat bubble.
 * Each turn fades+slides in for a touch of motion polish.
 *
 * Trace rows (tool-call hints, progress breadcrumbs) render as a subdued
 * collapsible group so intermediate steps never masquerade as replies.
 */
export declare function MessageBubble({ message, showAssistantCopyAction, }: MessageBubbleProps): import("react/jsx-runtime").JSX.Element;
/** L→R sheen on the glyphs themselves; inactive labels stay solid muted text. */
export declare function StreamingLabelSheen({ children, active, className, }: {
    children: ReactNode;
    active: boolean;
    className?: string;
}): import("react/jsx-runtime").JSX.Element;
interface ReasoningBubbleProps {
    text: string;
    streaming: boolean;
    hasBodyBelow: boolean;
    /** When true, skip the slide-in wrapper (used inside ``AgentActivityCluster``). */
    embeddedInCluster?: boolean;
}
/**
 * Subordinate "thinking" trace shown above an assistant turn.
 *
 * Lifecycle:
 *   - While ``streaming`` is true (``reasoning_delta`` frames still arriving),
 *     the bubble defaults to open and the header shows a sheen + pulse so
 *     the user sees the model "thinking out loud" in real time.
 *   - Expanded reasoning uses the same Markdown pipeline as assistant replies
 *     (deferred while streaming to reduce parser thrash), so headings and
 *     emphasis render instead of leaking raw ``###`` / ``**``.
 *   - On ``reasoning_end`` the bubble auto-collapses for prose density —
 *     the user can re-expand to inspect the chain of thought. The local
 *     toggle persists once the user interacts.
 */
export declare function ReasoningBubble({ text, streaming, hasBodyBelow, embeddedInCluster, }: ReasoningBubbleProps): import("react/jsx-runtime").JSX.Element;
interface TraceGroupProps {
    message: UIMessage;
    animClass: string;
}
/**
 * Collapsible group of tool-call / progress breadcrumbs. Defaults to
 * collapsed because tool traces are supporting evidence, not the answer.
 * A single click expands the exact calls when the user wants details.
 */
export declare function TraceGroup({ message, animClass }: TraceGroupProps): import("react/jsx-runtime").JSX.Element | null;
export {};
//# sourceMappingURL=MessageBubble.d.ts.map