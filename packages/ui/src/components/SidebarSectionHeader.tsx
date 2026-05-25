import { useState } from "react";
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
  const [hovered, setHovered] = useState(false);
  const showChrome = !hoverChevron || hovered;

  return (
    <div
      className={cn(
        "flex min-h-10 w-full items-center gap-1",
        hoverChevron ? "px-3" : sb.px,
        className,
      )}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
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
          showChrome ? (
            <ChevronRight
              className={cn(
                "h-4 w-4 shrink-0 transition-transform duration-200",
                sb.icon,
                expanded && "rotate-90",
              )}
              aria-hidden
            />
          ) : null
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
      {trailing && showChrome ? (
        <div className="flex shrink-0 items-center">{trailing}</div>
      ) : null}
    </div>
  );
}
