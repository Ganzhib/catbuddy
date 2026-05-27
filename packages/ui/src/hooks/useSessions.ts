import { useCallback, useEffect, useRef, useState } from "react";

import { useClient } from "@/providers/ClientProvider";
import i18n from "@/i18n";
import {
  ApiError,
  createSession as apiCreateSession,
  deleteSession as apiDeleteSession,
  fetchWebuiThread,
  listSessions,
} from "@catbuddy/platform";
import { deriveTitle } from "@/lib/format";
import {
  mergeChatSummaries,
  normalizeChatSummary,
  toSessionKey,
  type ChatSummary,
  type UIMessage,
} from "@catbuddy/shared";

const EMPTY_MESSAGES: UIMessage[] = [];

/** Sidebar state: fetches the full session list and exposes create / delete actions. */
export function useSessions(): {
  sessions: ChatSummary[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  createChat: (workspaceFolderId?: string | null) => Promise<string>;
  deleteChat: (key: string) => Promise<void>;
} {
  const { client, token } = useClient();
  const [sessions, setSessions] = useState<ChatSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const tokenRef = useRef(token);
  tokenRef.current = token;

  const refresh = useCallback(async (replace = false) => {
    try {
      setLoading(true);
      const rows = await listSessions(tokenRef.current);
      if (replace) {
        setSessions(rows.map((row) => normalizeChatSummary(row)));
      } else {
        setSessions((prev) => mergeChatSummaries(rows, prev));
      }
      setError(null);
    } catch (e) {
      const msg =
        e instanceof ApiError ? `HTTP ${e.status}` : (e as Error).message;
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    void refresh();
    return () => {
      if (refreshDebounceRef.current) clearTimeout(refreshDebounceRef.current);
    };
  }, [refresh]);

  useEffect(() => {
    const onWorkspaceChanged = () => void refresh(true);
    window.addEventListener("catbuddy:workspace-changed", onWorkspaceChanged);
    return () =>
      window.removeEventListener("catbuddy:workspace-changed", onWorkspaceChanged);
  }, [refresh]);

  useEffect(() => {
    return client.onSessionUpdate((_chatId, scope) => {
      // metadata：桌面 sessions_sync；focus：桌面新建/切换会话；deleted：跨端删除
      if (scope === "deleted") {
        const key = _chatId.includes(":") ? _chatId : toSessionKey(_chatId);
        setSessions((prev) => prev.filter((s) => s.key !== key));
        return;
      }
      if (scope !== "metadata" && scope !== "focus") return;
      if (refreshDebounceRef.current) clearTimeout(refreshDebounceRef.current);
      refreshDebounceRef.current = setTimeout(() => {
        refreshDebounceRef.current = null;
        void refresh();
      }, 600);
    });
  }, [client, refresh]);

  const createChat = useCallback(async (workspaceFolderId?: string | null): Promise<string> => {
    const created = await apiCreateSession(tokenRef.current, undefined, undefined, workspaceFolderId);
    const row = normalizeChatSummary(created);
    client.attach(row.chatId, row.workspaceFolderId ?? workspaceFolderId ?? null);
    setSessions((prev) => [
      row,
      ...prev.filter((s) => toSessionKey(s.key) !== row.key),
    ]);
    return row.chatId;
  }, [client]);

  const deleteChat = useCallback(
    async (key: string) => {
      await apiDeleteSession(tokenRef.current, key);
      setSessions((prev) => prev.filter((s) => s.key !== key));
    },
    [],
  );

  return { sessions, loading, error, refresh, createChat, deleteChat };
}

/** Lazy-load a session's on-disk messages the first time the UI displays it. */
export function useSessionHistory(key: string | null): {
  messages: UIMessage[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
  version: number;
  /** ``true`` when the replayed transcript ends with a trace row (turn still in flight). */
  hasPendingToolCalls: boolean;
} {
  const { token } = useClient();
  const [refreshSeq, setRefreshSeq] = useState(0);
  const refresh = useCallback(() => {
    setRefreshSeq((value) => value + 1);
  }, []);
  const [state, setState] = useState<{
    key: string | null;
    messages: UIMessage[];
    loading: boolean;
    error: string | null;
    hasPendingToolCalls: boolean;
    version: number;
  }>({
    key: null,
    messages: [],
    loading: false,
    error: null,
    hasPendingToolCalls: false,
    version: 0,
  });

  useEffect(() => {
    if (!key) {
      setState({
        key: null,
        messages: [],
        loading: false,
        error: null,
        hasPendingToolCalls: false,
        version: 0,
      });
      return;
    }
    let cancelled = false;
    // Mark the new key as loading immediately so callers never see stale
    // messages from the previous session during the render right after a switch.
    setState((prev) => prev.key === key
      ? { ...prev, loading: true, error: null }
      : {
          key,
          messages: [],
          loading: true,
          error: null,
          hasPendingToolCalls: false,
          version: 0,
        });
    (async () => {
      try {
        const body = await fetchWebuiThread(token, key);
        if (cancelled) return;
        if (!body?.messages?.length) {
          setState((prev) => ({
            key,
            messages: [],
            loading: false,
            error: null,
            hasPendingToolCalls: false,
            version: prev.key === key ? prev.version + 1 : 1,
          }));
          return;
        }
        const ui: UIMessage[] = body.messages.map((m, idx) => ({
          ...m,
          id: m.id ?? `hist-${idx}`,
          createdAt: typeof m.createdAt === "number" ? m.createdAt : Date.now(),
        }));
        // 历史回放的数据都是已完成的，不存在"进行中"的中间状态。
        // hasPendingToolCalls 仅在实时 WebSocket 推送场景有意义（页面热刷新时
        // Agent 仍在执行）。应用重启后所有会话均为纯历史数据，始终为 false。
        setState((prev) => ({
          key,
          messages: ui,
          loading: false,
          error: null,
          hasPendingToolCalls: false,
          version: prev.key === key ? prev.version + 1 : 1,
        }));
      } catch (e) {
        if (cancelled) return;
        if (e instanceof ApiError && e.status === 404) {
          setState((prev) => ({
            key,
            messages: [],
            loading: false,
            error: null,
            hasPendingToolCalls: false,
            version: prev.key === key ? prev.version + 1 : 1,
          }));
        } else {
          setState((prev) => ({
            key,
            messages: [],
            loading: false,
            error: (e as Error).message,
            hasPendingToolCalls: false,
            version: prev.key === key ? prev.version : 0,
          }));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [key, token, refreshSeq]);

  if (!key) {
    return {
      messages: EMPTY_MESSAGES,
      loading: false,
      error: null,
      refresh,
      version: 0,
      hasPendingToolCalls: false,
    };
  }

  // Even before the effect above commits its loading state, never surface the
  // previous session's payload for a brand-new key.
  if (state.key !== key) {
    return {
      messages: EMPTY_MESSAGES,
      loading: true,
      error: null,
      refresh,
      version: 0,
      hasPendingToolCalls: false,
    };
  }

  return {
    messages: state.messages,
    loading: state.loading,
    error: state.error,
    refresh,
    version: state.version,
    hasPendingToolCalls: state.hasPendingToolCalls,
  };
}

/** Produce a compact display title for a session. */
export function sessionTitle(
  session: ChatSummary,
  firstUserMessage?: string,
): string {
  return deriveTitle(
    session.title || firstUserMessage || session.preview,
    i18n.t("chat.newChat"),
  );
}
