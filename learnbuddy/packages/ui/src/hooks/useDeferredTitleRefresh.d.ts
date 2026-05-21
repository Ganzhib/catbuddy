import type { ChatSummary } from "@learnbuddy/shared";
/**
 * The server generates WebUI titles after the main turn has already ended.
 * Refresh once immediately, then retry lightly for untitled sessions so the
 * async title appears even if the websocket metadata notification is delayed.
 */
export declare function useDeferredTitleRefresh(activeSession: ChatSummary | null, refresh: () => Promise<void>, retryDelaysMs?: readonly number[]): () => void;
//# sourceMappingURL=useDeferredTitleRefresh.d.ts.map