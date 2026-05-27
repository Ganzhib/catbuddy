import { useCallback, useEffect, useState } from "react";

import {
  fetchWorkspaceFolders,
  importProjectFolder,
  removeWorkspaceFolder,
  setActiveWorkspaceFolder,
  type WorkspaceFolderStore,
} from "@catbuddy/platform";

export function notifyWorkspaceChanged(options?: {
  refreshFolders?: boolean;
  refreshSessions?: boolean;
}): void {
  window.dispatchEvent(new CustomEvent("catbuddy:workspace-changed", {
    detail: {
      refreshFolders: options?.refreshFolders ?? true,
      refreshSessions: options?.refreshSessions ?? true,
    },
  }));
}

export function useWorkspaceFolders() {
  const [store, setStore] = useState<WorkspaceFolderStore>({
    activeFolderId: null,
    folders: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const payload = await fetchWorkspaceFolders();
      if (payload) setStore(payload);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const onChanged = (event: Event) => {
      const shouldRefresh = event instanceof CustomEvent
        ? event.detail?.refreshFolders !== false
        : true;
      if (shouldRefresh) void refresh();
    };
    window.addEventListener("catbuddy:workspace-changed", onChanged);
    return () => window.removeEventListener("catbuddy:workspace-changed", onChanged);
  }, [refresh]);

  const importFolder = useCallback(async () => {
    const result = await importProjectFolder();
    if (result.cancelled) return result;
    if (result.ok && result.folders) {
      setStore({
        activeFolderId: result.activeFolderId ?? null,
        folders: result.folders,
      });
      setError(null);
      notifyWorkspaceChanged();
    } else if (!result.ok && result.error) {
      setError(result.error);
    }
    return result;
  }, []);

  const selectFolder = useCallback(async (folderId: string | null) => {
    const previous = store.activeFolderId;
    if (folderId === previous) return;

    setStore((current) => ({ ...current, activeFolderId: folderId }));
    try {
      const next = await setActiveWorkspaceFolder(folderId);
      if (next) {
        setStore(next);
        notifyWorkspaceChanged({ refreshFolders: true, refreshSessions: false });
      }
    } catch (err) {
      setStore((current) => ({ ...current, activeFolderId: previous }));
      setError((err as Error).message);
    }
  }, [store.activeFolderId]);

  const removeFolder = useCallback(async (folderId: string) => {
    const next = await removeWorkspaceFolder(folderId);
    if (next) {
      setStore(next);
      notifyWorkspaceChanged();
    }
  }, []);

  return { store, loading, error, refresh, importFolder, selectFolder, removeFolder };
}
