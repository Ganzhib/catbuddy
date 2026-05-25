import type { ReactNode } from "react";
import { ChevronLeft } from "lucide-react";
import { useTranslation } from "react-i18next";

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
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-[radial-gradient(circle_at_50%_0%,hsl(var(--muted))_0%,hsl(var(--background))_42%)]">
      <header className="shrink-0 border-b border-border/50 bg-card/55 px-4 py-3 backdrop-blur-xl sm:px-6">
        <button
          type="button"
          onClick={onBackToChat}
          className="mb-2 inline-flex items-center gap-1 rounded-full px-2 py-1 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground"
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
