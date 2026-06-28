import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { sb } from "@/lib/sidebar-styles";
import { cn } from "@/lib/utils";
import { useClient } from "@/providers/ClientProvider";
import type { ConnectionStatus } from "@catbuddy/shared";

const COPY: Record<ConnectionStatus, { color: string; dot: string }> = {
  idle: {
    color: "text-muted-foreground",
    dot: "bg-[#999]",
  },
  connecting: {
    color: "text-amber-700 dark:text-amber-300",
    dot: "bg-amber-500",
  },
  open: {
    color: "text-emerald-700 dark:text-emerald-400",
    dot: sb.accentGreen,
  },
  reconnecting: {
    color: "text-amber-700 dark:text-amber-300",
    dot: "bg-amber-500",
  },
  closed: {
    color: "text-muted-foreground",
    dot: "bg-[#999]",
  },
  error: {
    color: "text-destructive",
    dot: "bg-destructive",
  },
};

interface ConnectionBadgeProps {
  /** 底部设置行：仅显示 8px 状态圆点 */
  variant?: "badge" | "dot";
}

export function ConnectionBadge({ variant = "badge" }: ConnectionBadgeProps) {
  const { t } = useTranslation();
  const { client } = useClient();
  const [status, setStatus] = useState<ConnectionStatus>(client.status);

  useEffect(() => client.onStatus(setStatus), [client]);

  const meta = COPY[status];
  const pulsing =
    status === "connecting" ||
    status === "reconnecting" ||
    status === "error";
  const label = t(`connection.${status}`);

  if (variant === "dot") {
    return (
      <span
        className="relative inline-flex h-2 w-2 shrink-0"
        aria-live="polite"
        role="status"
        title={label}
      >
        {pulsing ? (
          <span
            className={cn(
              "absolute inline-flex h-full w-full animate-ping rounded-full opacity-75",
              meta.dot,
            )}
          />
        ) : null}
        <span className={cn("relative inline-flex h-2 w-2 rounded-full", meta.dot)} />
        <span className="sr-only">{label}</span>
      </span>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors",
        "text-muted-foreground/70 hover:bg-sidebar-accent/65",
        meta.color,
      )}
      aria-live="polite"
      role="status"
      title={label}
    >
      <span className="relative flex h-2 w-2" aria-hidden>
        {pulsing && (
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-current opacity-75" />
        )}
        <span className="relative inline-flex h-2 w-2 rounded-full bg-current" />
      </span>
      <span className="sr-only">{label}</span>
    </span>
  );
}
