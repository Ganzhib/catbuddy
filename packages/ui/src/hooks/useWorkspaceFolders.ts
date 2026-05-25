import { useCallback, useEffect, useState } from "react";

import {
  fetchWorkspaceFolders,
  importProjectFolder,
  setActiveWorkspaceFolder,
  type WorkspaceFolderStore,
} from "@catbuddy/platform";

export function notifyWorkspaceChanged(): void {
  window.dispatchEvent(new CustomEvent("catbuddy:workspace-changed"));
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
    const onChanged = () => void refresh();
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
    const next = await setActiveWorkspaceFolder(folderId);
    if (next) {
      setStore(next);
      notifyWorkspaceChanged();
    }
  }, []);

  return { store, loading, error, refresh, importFolder, selectFolder };
}
