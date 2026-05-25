import type { ReactNode } from "react";
import { ChevronLeft } from "lucide-react";
import { useTranslation } from "react-i18next";

import { panelCanvas, panelHeader } from "@/lib/panel-styles";
import { cn } from "@/lib/utils";

interface PanelShellProps {
  title: string;
  subtitle?: string;
  onBackToChat: () => void;
  children: ReactNode;
  className?: string;
}

export function PanelShell({
  title,
  subtitle,
  onBackToChat,
  children,
  className,
}: PanelShellProps) {
  const { t } = useTranslation();

  return (
    <div className={cn("flex h-full min-h-0 flex-1 flex-col overflow-hidden", panelCanvas)}>
      <header className={cn("shrink-0 px-4 py-3 sm:px-6", panelHeader)}>
        <button
          type="button"
          onClick={onBackToChat}
          className="mb-2 inline-flex items-center gap-1 rounded-full px-2 py-1 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-white/80 hover:text-foreground dark:hover:bg-muted/70"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden />
          {t("settings.backToChat")}
        </button>
        <h1 className="text-[22px] font-semibold tracking-[-0.035em] text-foreground sm:text-[26px]">
          {title}
        </h1>
        {subtitle ? (
          <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-muted-foreground">
            {subtitle}
          </p>
        ) : null}
      </header>
      <div
        className={cn(
          "min-h-0 flex-1 overflow-y-auto [scrollbar-gutter:stable]",
          className,
        )}
      >
        <div className="mx-auto w-full max-w-[920px] px-4 py-5 sm:px-6 sm:py-8 lg:px-10">
          {children}
        </div>
      </div>
    </div>
  );
}
