import { useCallback, useEffect, useState } from "react";
import { Radio } from "lucide-react";
import { useTranslation } from "react-i18next";

import {
  resolveGatewayAccountEmail,
  syncDesktopGatewayAccountEmail,
} from "@catbuddy/platform";
import { sb } from "@/lib/sidebar-styles";
import { cn } from "@/lib/utils";

type RemoteState = {
  enabled: boolean;
  connected: boolean;
  needsLogin?: boolean;
};

function friendlyRemoteHint(
  t: (key: string) => string,
  state: RemoteState,
  lastError: string | undefined,
  loginRequired: boolean,
): string {
  if (loginRequired || state.needsLogin) return t("sidebar.remote.loginRequired");
  if (!state.enabled) return t("sidebar.remote.off");
  if (state.connected) return t("sidebar.remote.connected");
  if (lastError === "account_email_required") {
    return t("sidebar.remote.loginRequired");
  }
  if (lastError === "unauthorized") {
    return t("sidebar.remote.unauthorized");
  }
  if (lastError) {
    if (lastError.includes("ECONNREFUSED") || lastError.includes("127.0.0.1")) {
      return t("sidebar.remote.localGatewayDown");
    }
    return t("sidebar.remote.error");
  }
  return t("sidebar.remote.connecting");
}

export function GatewayRemoteSwitch() {
  const { t } = useTranslation();
  const [state, setState] = useState<RemoteState | null>(null);
  const [lastError, setLastError] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const [loginRequired, setLoginRequired] = useState(false);

  const refresh = useCallback(async () => {
    const api = window.catbuddy?.getGatewayRemoteEnabled;
    if (!api) return;
    try {
      const remote = await api();
      setState({
        enabled: remote.enabled,
        connected: remote.connected,
        needsLogin: remote.needsLogin,
      });
      if (window.catbuddy?.getGatewayStatus) {
        const st = await window.catbuddy.getGatewayStatus();
        setLastError(st.lastError ?? remote.lastError);
      } else {
        setLastError(remote.lastError);
      }
    } catch {
      setState(null);
    }
  }, []);

  useEffect(() => {
    void (async () => {
      await syncDesktopGatewayAccountEmail();
      await refresh();
    })();
    const id = setInterval(() => void refresh(), 3000);
    const unsub = window.catbuddy?.onGatewayConnectionChanged?.(() => {
      void refresh();
    });
    return () => {
      clearInterval(id);
      unsub?.();
    };
  }, [refresh]);

  if (!window.catbuddy?.getGatewayRemoteEnabled) return null;

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
      const next = await window.catbuddy!.setGatewayRemoteEnabled!(!state.enabled);
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
    <div className="space-y-1">
      <button
        type="button"
        role="switch"
        aria-checked={state?.enabled ?? false}
        disabled={busy}
        onClick={() => void onToggle()}
        className={cn(
          "flex h-10 w-full items-center justify-between gap-3 rounded-lg px-0",
          "transition-colors duration-200 hover:bg-[#F5F5F5]/80 dark:hover:bg-sidebar-accent/40",
          "disabled:pointer-events-none disabled:opacity-50",
        )}
      >
        <span className={cn("flex min-w-0 flex-1 items-center gap-2", sb.text)}>
          <Radio className={cn("h-4 w-4 shrink-0", sb.icon)} aria-hidden />
          <span className="text-[14px] font-normal">{t("sidebar.remote.label")}</span>
        </span>
        <span
          className={cn(
            "relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors duration-200",
            state?.enabled ? sb.accentGreen : "bg-[#E0E0E0] dark:bg-muted-foreground/25",
            !busy && state?.enabled && "hover:brightness-110",
          )}
        >
          <span
            className={cn(
              "absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform duration-200",
              state?.enabled ? "translate-x-4" : "translate-x-0.5",
            )}
          />
        </span>
      </button>
      {hint ? (
        <p className={cn("pl-6 text-[12px] leading-snug", sb.textMuted)}>{hint}</p>
      ) : null}
    </div>
  );
}
