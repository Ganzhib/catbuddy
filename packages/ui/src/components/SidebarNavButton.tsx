import type { LucideIcon } from "lucide-react";

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
        "flex h-9 w-full items-center gap-2.5 rounded-full px-3.5 text-left text-[13px] font-medium transition-colors",
        active
          ? "bg-sidebar-accent/85 text-sidebar-foreground shadow-[inset_0_0_0_1px_rgba(0,0,0,0.04)]"
          : "text-sidebar-foreground/85 hover:bg-sidebar-accent/75 hover:text-sidebar-foreground",
      )}
    >
      <Icon
        className={cn(
          "h-4 w-4 shrink-0",
          active ? "text-[#4f9de8] dark:text-[#6eb3f5]" : "text-muted-foreground/80",
        )}
        aria-hidden
      />
      <span className="truncate">{label}</span>
    </button>
  );
}
