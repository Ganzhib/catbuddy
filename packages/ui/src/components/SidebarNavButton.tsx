import type { LucideIcon } from "lucide-react";

import { sb } from "@/lib/sidebar-styles";
import { cn } from "@/lib/utils";

interface SidebarNavButtonProps {
  icon: LucideIcon;
  label: string;
  active?: boolean;
  /** plain：MCP 无背景；filled：Skill 浅灰按钮 */
  variant?: "plain" | "filled";
  onClick: () => void;
}

export function SidebarNavButton({
  icon: Icon,
  label,
  active = false,
  variant = "plain",
  onClick,
}: SidebarNavButtonProps) {
  return (
    <button
      type="button"
      aria-current={active ? "page" : undefined}
      onClick={onClick}
      className={cn(
        sb.row,
        "h-9 text-left text-[14px] transition-colors duration-200",
        variant === "filled" && [
          "rounded",
          sb.surface,
          sb.surfaceHover,
          active && "ring-1 ring-[#E0E0E0]/80",
        ],
        variant === "plain" && "rounded-lg hover:bg-[#F5F5F5]/80 dark:hover:bg-sidebar-accent/45",
        active ? sb.text : sb.textSecondary,
      )}
    >
      <Icon className={cn("h-4 w-4 shrink-0", sb.icon)} aria-hidden />
      <span className="truncate font-normal">{label}</span>
    </button>
  );
}
