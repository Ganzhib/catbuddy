/** 侧边栏视觉规范 — 浅蓝灰渐变，与主区天蓝同源融合 */
export const sb = {
  /** 页面背景 #F0F8FF — 比主区天蓝稍深，近色渐变 */
  shell: "bg-[#F0F8FF] text-[#333] dark:bg-sidebar dark:text-sidebar-foreground",
  /** 浅蓝表面 #E8F2FC — 与主区渐变中段呼应 */
  surface: "bg-[#E8F2FC] dark:bg-sidebar-accent/50",
  surfaceHover: "hover:bg-[#E0F0FF] dark:hover:bg-sidebar-accent/70",
  /** 聊天气泡 hover / 选中高亮 #E0F0FF */
  bubbleHover: "hover:bg-[#E0F0FF] dark:hover:bg-sidebar-accent/55",
  active: "bg-[#E0F0FF] dark:bg-sidebar-accent/70",
  /** 通用行/按钮 hover */
  hover: "hover:bg-[#E0F0FF]/80 dark:hover:bg-sidebar-accent/45",
  iconButtonHover: "hover:bg-[#E0F0FF] dark:hover:bg-sidebar-accent/55",
  border: "border-[#C8DCF0] dark:border-sidebar-border/60",
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
  "h-10 w-full rounded-lg border bg-[#E8F2FC] pl-9 pr-3 text-[14px] text-[#333] outline-none transition-colors placeholder:text-[#999] focus:border-[#C8DCF0] focus:ring-1 focus:ring-[#C8DCF0]/80 dark:bg-sidebar-accent/40 dark:text-sidebar-foreground dark:placeholder:text-muted-foreground";

export const sbSectionTitle =
  "text-[14px] font-semibold text-[#333] dark:text-sidebar-foreground";

export const sbGroupLabel =
  "text-[12px] font-semibold text-[#999] dark:text-muted-foreground/75";
