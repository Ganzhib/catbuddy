import { ChevronRight } from "lucide-react";

import { sb, sbSectionTitle } from "@/lib/sidebar-styles";
import { cn } from "@/lib/utils";

interface SidebarSectionHeaderProps {
  title: string;
  expanded: boolean;
  onToggle: () => void;
  /** 展开箭头仅在 hover 时显示（工作空间 / 聊天记录） */
  hoverChevron?: boolean;
  trailing?: React.ReactNode;
  className?: string;
}

export function SidebarSectionHeader({
  title,
  expanded,
  onToggle,
  hoverChevron = true,
  trailing,
  className,
}: SidebarSectionHeaderProps) {
  return (
    <div
      className={cn(
        "group/section flex min-h-10 w-full items-center gap-1",
        hoverChevron ? "px-3" : sb.px,
        className,
      )}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className={cn(
          "flex min-w-0 flex-1 items-center gap-1.5 rounded-lg py-2 text-left",
          sb.hover,
          !hoverChevron && "px-0",
        )}
      >
        <span className={cn("truncate", sbSectionTitle)}>{title}</span>
        {hoverChevron ? (
          <span
            className={cn(
              "hidden w-0 shrink-0 overflow-hidden transition-[width] duration-200",
              "group-hover/section:inline-flex group-hover/section:w-4",
            )}
            aria-hidden
          >
            <ChevronRight
              className={cn(
                "h-4 w-4",
                sb.icon,
                "transition-transform duration-200",
                expanded && "rotate-90",
              )}
            />
          </span>
        ) : (
          <ChevronRight
            className={cn(
              "h-4 w-4 shrink-0 transition-transform duration-200",
              sb.icon,
              expanded && "rotate-90",
            )}
            aria-hidden
          />
        )}
      </button>
      {trailing ? (
        <div
          className={cn(
            "hidden shrink-0 overflow-hidden transition-[width] duration-200",
            hoverChevron && "w-0 group-hover/section:inline-flex group-hover/section:w-8",
            !hoverChevron && "inline-flex",
          )}
        >
          {trailing}
        </div>
      ) : null}
    </div>
  );
}
