import { useCallback, useEffect, useRef } from "react";
const TITLE_REFRESH_RETRY_DELAYS_MS = [1_000, 3_000, 7_000];
function hasGeneratedTitle(session) {
    return !!session?.title?.trim();
}
/**
 * The server generates WebUI titles after the main turn has already ended.
 * Refresh once immediately, then retry lightly for untitled sessions so the
 * async title appears even if the websocket metadata notification is delayed.
 */
export function useDeferredTitleRefresh(activeSession, refresh, retryDelaysMs = TITLE_REFRESH_RETRY_DELAYS_MS) {
    const activeSessionRef = useRef(activeSession);
    const timersRef = useRef([]);
    activeSessionRef.current = activeSession;
    const clearTimers = useCallback(() => {
        for (const timer of timersRef.current) {
            clearTimeout(timer);
        }
        timersRef.current = [];
    }, []);
    useEffect(() => clearTimers, [clearTimers]);
    useEffect(() => {
        clearTimers();
    }, [activeSession?.key, clearTimers]);
    useEffect(() => {
        if (hasGeneratedTitle(activeSession)) {
            clearTimers();
        }
    }, [activeSession, clearTimers]);
    return useCallback(() => {
        void refresh();
        const sessionAtTurnEnd = activeSessionRef.current;
        if (!sessionAtTurnEnd || hasGeneratedTitle(sessionAtTurnEnd)) {
            return;
        }
        clearTimers();
        for (const delayMs of retryDelaysMs) {
            const timer = setTimeout(() => {
                const latest = activeSessionRef.current;
                if (!latest ||
                    latest.key !== sessionAtTurnEnd.key ||
                    hasGeneratedTitle(latest)) {
                    return;
                }
                void refresh();
            }, delayMs);
            timersRef.current.push(timer);
        }
    }, [clearTimers, refresh, retryDelaysMs]);
}
//# sourceMappingURL=useDeferredTitleRefresh.js.map