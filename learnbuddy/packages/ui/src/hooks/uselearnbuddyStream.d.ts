import type { StreamError } from "@learnbuddy/client";
import type { OutboundImageGeneration, OutboundMedia, GoalStateWsPayload, UIImage, UIMessage } from "@learnbuddy/shared";
/**
 * Subscribe to a chat by ID. Returns the in-memory message list for the chat,
 * a streaming flag, and a ``send`` function. Initial history must be seeded
 * separately (e.g. via ``fetchWebuiThread``) since the server only replays
 * live events.
 */
/** Payload passed to ``send`` when the user attaches one or more images.
 *
 * ``media`` is handed to the wire client verbatim; ``preview`` powers the
 * optimistic user bubble (blob URLs so the preview appears before the server
 * acks the frame). Keeping the two separate lets the bubble re-use the local
 * blob URL even after the server persists the file under a different name. */
export interface SendImage {
    media: OutboundMedia;
    preview: UIImage;
}
export interface SendOptions {
    imageGeneration?: OutboundImageGeneration;
}
export declare function uselearnbuddyStream(chatId: string | null, initialMessages?: UIMessage[], hasPendingToolCalls?: boolean, onTurnEnd?: () => void): {
    messages: UIMessage[];
    isStreaming: boolean;
    /** Unix epoch seconds when the current user turn started (WebSocket ``goal_status``). */
    runStartedAt: number | null;
    /** Latest sustained goal for this ``chatId`` (``goal_state`` WS events). */
    goalState: GoalStateWsPayload | undefined;
    send: (content: string, images?: SendImage[], options?: SendOptions) => void;
    stop: () => void;
    setMessages: React.Dispatch<React.SetStateAction<UIMessage[]>>;
    /** Latest transport-level fault raised since the last ``dismissStreamError``.
     * ``null`` when there is nothing to show. */
    streamError: StreamError | null;
    /** Clear the current ``streamError`` (e.g. after the user dismisses the
     * notification or starts a fresh action). */
    dismissStreamError: () => void;
};
//# sourceMappingURL=uselearnbuddyStream.d.ts.map