import { useCallback, useEffect, useState } from "react";
import { Radio } from "lucide-react";
import { useTranslation } from "react-i18next";

import { cn } from "@/lib/utils";

type RemoteState = {
  enabled: boolean;
  envConfigured: boolean;
  connected: boolean;
};

export function GatewayRemoteSwitch() {
  const { t } = useTranslation();
  const [state, setState] = useState<RemoteState | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const api = window.learnbuddy?.getGatewayRemoteEnabled;
    if (!api) return;
    try {
      setState(await api());
    } catch {
      setState(null);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const id = setInterval(() => void refresh(), 3000);
    return () => clearInterval(id);
  }, [refresh]);

  if (!window.learnbuddy?.getGatewayRemoteEnabled) return null;

  const onToggle = async () => {
    if (!state || busy) return;
    setBusy(true);
    try {
      const next = await window.learnbuddy!.setGatewayRemoteEnabled!(!state.enabled);
      setState((prev) => ({
        enabled: next.enabled,
        envConfigured: prev?.envConfigured ?? true,
        connected: next.connected,
      }));
    } finally {
      setBusy(false);
    }
  };

  const hint = !state?.envConfigured
    ? t("sidebar.remote.envMissing")
    : state.enabled && state.connected
      ? t("sidebar.remote.connected")
      : state.enabled
        ? t("sidebar.remote.waitingDesktop")
        : t("sidebar.remote.off");

  return (
    <div className="px-1 pb-1.5">
      <button
        type="button"
        role="switch"
        aria-checked={state?.enabled ?? false}
        disabled={busy || !state?.envConfigured}
        onClick={() => void onToggle()}
        className={cn(
          "flex w-full items-center justify-between gap-2.5 rounded-full px-3.5 py-2.5 text-left text-[13px]",
          "text-sidebar-foreground/90 hover:bg-sidebar-accent/75",
          "disabled:pointer-events-none disabled:opacity-50",
        )}
      >
        <span className="flex min-w-0 flex-1 items-center gap-2.5">
          <Radio
            className={cn(
              "h-4 w-4 shrink-0",
              state?.enabled && state.connected
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-muted-foreground/80",
            )}
            aria-hidden
          />
          <span className="font-medium">{t("sidebar.remote.label")}</span>
        </span>
        <span
          className={cn(
            "relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors",
            state?.enabled ? "bg-emerald-500/80" : "bg-muted-foreground/25",
          )}
        >
          <span
            className={cn(
              "absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform",
              state?.enabled ? "translate-x-4" : "translate-x-0.5",
            )}
          />
        </span>
      </button>
      <p className="px-3.5 pb-0.5 pt-1 text-[12px] leading-relaxed text-muted-foreground/80">{hint}</p>
    </div>
  );
}
