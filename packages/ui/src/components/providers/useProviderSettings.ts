import { useCallback, useEffect, useState } from "react";
import { fetchSettings } from "@catbuddy/platform";

import type { ProviderSettingsPayload } from "./provider-contract";

export function useProviderSettings(token: string) {
  const [settings, setSettings] = useState<ProviderSettingsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const payload = (await fetchSettings(token)) as ProviderSettingsPayload;
      setSettings(payload);
      setError(null);
      return payload;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
      return null;
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { settings, setSettings, loading, error, refresh };
}
