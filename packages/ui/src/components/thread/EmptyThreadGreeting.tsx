import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { resolveAuthEmailPrefix } from "@catbuddy/platform";

import { BrandMark } from "@/components/BrandMark";

export function EmptyThreadGreeting({ token }: { token: string }) {
  const { t } = useTranslation();
  const name = useMemo(() => resolveAuthEmailPrefix(token), [token]);
  const greeting = t("thread.empty.greeting");

  return (
    <div className="flex w-full justify-center animate-in fade-in-0 slide-in-from-bottom-2 duration-500">
      <div className="inline-flex max-w-full items-center justify-center gap-3 sm:gap-4">
        <BrandMark
          className="block h-12 w-12 shrink-0 object-contain transition-all duration-300 ease-out hover:scale-105 sm:h-14 sm:w-14"
          alt=""
        />
        <h1 className="min-w-0 text-balance text-[32px] font-normal leading-tight tracking-[-0.045em] text-foreground sm:text-[40px] lg:text-[48px]">
          {name ? (
            <>
              <span>{t("thread.empty.hiLead")}</span>
              <span
                className="bg-gradient-to-r from-[#4f9de8] via-[#a877e7] to-[#f25b8f] bg-clip-text font-medium text-transparent dark:from-[#6eb3f5] dark:via-[#c49df5] dark:to-[#ff7aab]"
              >
                {name}
              </span>
              <span className="whitespace-pre"> </span>
              <span>{greeting}</span>
            </>
          ) : (
            greeting
          )}
        </h1>
      </div>
    </div>
  );
}
