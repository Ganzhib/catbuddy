import { AlertTriangle, MonitorOff, X } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { StreamError } from "@learnbuddy/client";

interface StreamErrorNoticeProps {
  error: StreamError;
  onDismiss: () => void;
}

type NoticeTone = "hint" | "warning" | "error";

/**
 * Dismissible banner that surfaces transport-level faults the user needs to
 * know about. Rendered above the composer so the message the fault referred
 * to remains in view just above.
 */
export function StreamErrorNotice({ error, onDismiss }: StreamErrorNoticeProps) {
  const { t } = useTranslation();

  const { title, body } = resolveCopy(error, t);
  const tone = resolveTone(error);
  const isHint = tone === "hint";

  return (
    <div
      role={isHint ? "status" : "alert"}
      aria-live={isHint ? "polite" : "assertive"}
      className={cn(
        "mx-auto mb-3 flex w-full max-w-[58rem] items-start gap-3",
        "animate-in fade-in-0 slide-in-from-bottom-1 duration-300",
        isHint
          ? cn(
              "rounded-[20px] border border-black/[0.035] border-l-[3px] border-l-sky-400/55",
              "bg-card bg-gradient-to-r from-sky-500/[0.045] to-transparent px-4 py-3.5",
              "shadow-[0_10px_28px_rgba(15,23,42,0.06)]",
              "dark:border-white/[0.06] dark:border-l-sky-400/45 dark:from-sky-400/[0.06] dark:shadow-[0_12px_28px_rgba(0,0,0,0.22)]",
            )
          : cn(
              "rounded-xl border px-3 py-2.5",
              tone === "warning"
                ? "border-amber-500/25 bg-amber-500/[0.07] text-amber-950 dark:text-amber-100"
                : "border-destructive/30 bg-destructive/10 text-destructive",
            ),
      )}
    >
      <NoticeIcon tone={tone} />
      <div className="min-w-0 flex-1 pt-0.5">
        <p
          className={cn(
            "font-medium leading-snug",
            isHint ? "text-[14px] text-foreground/90" : "text-[13px]",
          )}
        >
          {title}
        </p>
        <p
          className={cn(
            "mt-1 leading-relaxed",
            isHint
              ? "text-[13px] text-muted-foreground"
              : tone === "warning"
                ? "text-[12px] text-amber-900/75 dark:text-amber-100/80"
                : "text-[12px] text-destructive/80",
          )}
        >
          {body}
        </p>
      </div>
      <Button
        variant="ghost"
        size="icon"
        onClick={onDismiss}
        aria-label={t("common.dismiss")}
        className={cn(
          "h-7 w-7 shrink-0 rounded-full",
          isHint
            ? "text-sky-700/55 hover:bg-sky-500/10 hover:text-sky-700/80 dark:text-sky-300/50 dark:hover:text-sky-300/75"
            : tone === "warning"
              ? "text-amber-800/70 hover:bg-amber-500/15 hover:text-amber-900 dark:text-amber-200/70 dark:hover:text-amber-100"
              : "text-destructive hover:bg-destructive/15 hover:text-destructive",
        )}
      >
        <X className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

function NoticeIcon({ tone }: { tone: NoticeTone }) {
  if (tone === "hint") {
    return (
      <span
        aria-hidden
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
          "bg-sky-500/10 ring-1 ring-inset ring-sky-500/15",
        )}
      >
        <MonitorOff
          className="h-[18px] w-[18px] text-sky-600/75 dark:text-sky-400/85"
          strokeWidth={1.75}
        />
      </span>
    );
  }

  return (
    <AlertTriangle
      className={cn(
        "mt-0.5 h-4 w-4 shrink-0",
        tone === "warning" ? "text-amber-600 dark:text-amber-400" : undefined,
      )}
      aria-hidden
    />
  );
}

function resolveTone(error: StreamError): NoticeTone {
  switch (error.kind) {
    case "gateway_desktop_offline":
      return "hint";
    case "message_too_big":
      return "warning";
    default:
      return "error";
  }
}

function resolveCopy(
  error: StreamError,
  t: (key: string) => string,
): { title: string; body: string } {
  switch (error.kind) {
    case "message_too_big":
      return {
        title: t("errors.messageTooBig.title"),
        body: t("errors.messageTooBig.body"),
      };
    case "gateway_desktop_offline":
      return {
        title: t("errors.gatewayDesktopOffline.title"),
        body: t("errors.gatewayDesktopOffline.body"),
      };
    default:
      return { title: t("errors.generic.title"), body: t("errors.generic.body") };
  }
}
