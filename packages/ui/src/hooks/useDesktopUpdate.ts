import { useCallback, useEffect, useState } from "react";
import type { DesktopUpdateStatus } from "@catbuddy/shared";

export function useDesktopUpdate() {
  const [status, setStatus] = useState<DesktopUpdateStatus | null>(null);
  const [actionError, setActionError] = useState(false);

  useEffect(() => {
    const api = window.catbuddy;
    if (!api) return;

    let mounted = true;
    let receivedEvent = false;
    const unsubscribe = api.onDesktopUpdateStatus((next) => {
      receivedEvent = true;
      setStatus(next);
    });
    void api.getDesktopUpdateStatus().then((initial) => {
      if (mounted && !receivedEvent) setStatus(initial);
    }).catch(() => {
      if (mounted) setActionError(true);
    });
    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  const check = useCallback(async () => {
    setActionError(false);
    try {
      await window.catbuddy?.checkDesktopUpdate();
    } catch {
      setActionError(true);
    }
  }, []);

  const download = useCallback(async () => {
    setActionError(false);
    try {
      await window.catbuddy?.openDesktopUpdate();
    } catch {
      setActionError(true);
    }
  }, []);

  return { status, actionError, check, download };
}
