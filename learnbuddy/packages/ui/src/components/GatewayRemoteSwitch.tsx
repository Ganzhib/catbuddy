import { useCallback, useEffect, useState } from "react";
import { Radio } from "lucide-react";
import { useTranslation } from "react-i18next";

import {
  resolveGatewayAccountEmail,
  syncDesktopGatewayAccountEmail,
} from "@learnbuddy/platform";
import { cn } from "@/lib/utils";

type RemoteState = {
  enabled: boolean;
  connected: boolean;
};

function friendlyRemoteHint(
  t: (key: string) => string,
  state: RemoteState,
  lastError: string | undefined,
  loginRequired: boolean,
): string {
  if (loginRequired) return t("sidebar.remote.loginRequired");
  if (!state.enabled) return t("sidebar.remote.off");
  if (state.connected) return t("sidebar.remote.connected");
  if (lastError === "account_email_required") {
    return t("sidebar.remote.loginRequired");
  }
  if (lastError) return t("sidebar.remote.connecting");
  return t("sidebar.remote.connecting");
}

export function GatewayRemoteSwitch() {
  const { t } = useTranslation();
  const [state, setState] = useState<RemoteState | null>(null);
  const [lastError, setLastError] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const [loginRequired, setLoginRequired] = useState(false);

  const refresh = useCallback(async () => {
    const api = window.learnbuddy?.getGatewayRemoteEnabled;
    if (!api) return;
    try {
      const remote = await api();
      setState({
        enabled: remote.enabled,
        connected: remote.connected,
      });
      if (window.learnbuddy?.getGatewayStatus) {
        const st = await window.learnbuddy.getGatewayStatus();
        setLastError(st.lastError);
      }
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
    setLoginRequired(false);
    try {
      if (!state.enabled) {
        const email = resolveGatewayAccountEmail();
        if (!email) {
          setLoginRequired(true);
          return;
        }
        await syncDesktopGatewayAccountEmail();
      }
      const next = await window.learnbuddy!.setGatewayRemoteEnabled!(!state.enabled);
      setState({
        enabled: next.enabled,
        connected: next.connected,
      });
      void refresh();
    } finally {
      setBusy(false);
    }
  };

  const hint =
    state == null
      ? ""
      : friendlyRemoteHint(t, state, lastError, loginRequired);

  return (
    <div className="pb-1.5">
      <button
        type="button"
        role="switch"
        aria-checked={state?.enabled ?? false}
        disabled={busy}
        onClick={() => void onToggle()}
        className={cn(
          "flex h-9 w-full items-center justify-between gap-2.5 rounded-full px-3.5 text-left text-[13px]",
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
      {hint ? (
        <p className="pb-0.5 pl-10 pr-3.5 pt-1 text-[12px] leading-relaxed text-muted-foreground/80">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
