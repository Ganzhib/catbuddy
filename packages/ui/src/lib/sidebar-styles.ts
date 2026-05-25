/** 侧边栏视觉规范 — 对齐、间距、配色统一 */
export const sb = {
  /** 页面背景 #F9FAFB */
  shell: "bg-[#F9FAFB] text-[#333] dark:bg-sidebar dark:text-sidebar-foreground",
  /** 浅灰表面 #F5F5F5 */
  surface: "bg-[#F5F5F5] dark:bg-sidebar-accent/50",
  surfaceHover: "hover:bg-[#EEEEEE] dark:hover:bg-sidebar-accent/70",
  /** 聊天气泡 hover #F0F0F0 */
  bubbleHover: "hover:bg-[#F0F0F0] dark:hover:bg-sidebar-accent/55",
  border: "border-[#E0E0E0] dark:border-sidebar-border/60",
  text: "text-[#333] dark:text-sidebar-foreground",
  textSecondary: "text-[#666] dark:text-sidebar-foreground/85",
  textMuted: "text-[#999] dark:text-muted-foreground",
  icon: "text-[#666] dark:text-muted-foreground/80",
  iconMuted: "text-[#999] dark:text-muted-foreground/70",
  iconHover: "hover:text-[#666] dark:hover:text-sidebar-foreground",
  accentGreen: "bg-[#4CAF50]",
  px: "px-4",
  /** 8px 倍数间距 */
  gapSm: "gap-2",
  gapMd: "gap-3",
  gapLg: "gap-4",
  /** 功能区行：与搜索/远程控制左对齐 */
  row: "flex w-full items-center gap-2 px-0",
} as const;

export const sbInput =
  "h-10 w-full rounded-lg border bg-[#F5F5F5] pl-9 pr-3 text-[14px] text-[#333] outline-none transition-colors placeholder:text-[#999] focus:border-[#E0E0E0] focus:ring-1 focus:ring-[#E0E0E0]/80 dark:bg-sidebar-accent/40 dark:text-sidebar-foreground dark:placeholder:text-muted-foreground";

export const sbSectionTitle =
  "text-[14px] font-semibold text-[#333] dark:text-sidebar-foreground";

export const sbGroupLabel =
  "text-[12px] font-semibold text-[#999] dark:text-muted-foreground/75";
