import type { ChatSummary, UIMessage } from "@learnbuddy/shared";
/** Sidebar state: fetches the full session list and exposes create / delete actions. */
export declare function useSessions(): {
    sessions: ChatSummary[];
    loading: boolean;
    error: string | null;
    refresh: () => Promise<void>;
    createChat: () => Promise<string>;
    deleteChat: (key: string) => Promise<void>;
};
/** Lazy-load a session's on-disk messages the first time the UI displays it. */
export declare function useSessionHistory(key: string | null): {
    messages: UIMessage[];
    loading: boolean;
    error: string | null;
    refresh: () => void;
    version: number;
    /** ``true`` when the replayed transcript ends with a trace row (turn still in flight). */
    hasPendingToolCalls: boolean;
};
/** Produce a compact display title for a session. */
export declare function sessionTitle(session: ChatSummary, firstUserMessage?: string): string;
//# sourceMappingURL=useSessions.d.ts.map