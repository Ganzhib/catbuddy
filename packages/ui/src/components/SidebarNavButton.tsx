import type { LucideIcon } from "lucide-react";

import { sb } from "@/lib/sidebar-styles";
import { cn } from "@/lib/utils";

interface SidebarNavButtonProps {
  icon: LucideIcon;
  label: string;
  active?: boolean;
  onClick: () => void;
}

export function SidebarNavButton({
  icon: Icon,
  label,
  active = false,
  onClick,
}: SidebarNavButtonProps) {
  return (
    <button
      type="button"
      aria-current={active ? "page" : undefined}
      onClick={onClick}
      className={cn(
        sb.row,
        "h-9 w-full rounded-lg text-left text-[14px] transition-colors duration-200",
        active
          ? cn(sb.active, "font-medium", sb.text)
          : cn(sb.textSecondary, sb.hover),
      )}
    >
      <Icon className={cn("h-4 w-4 shrink-0", sb.icon)} aria-hidden />
      <span className="truncate font-normal">{label}</span>
    </button>
  );
}
