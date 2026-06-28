import { cn } from '@/lib/utils'

export const authBrandLabel = cn(
  'text-[9px] font-medium uppercase tracking-[0.18em] text-[#0EA5E9]/80 sm:text-[10px] dark:text-sky-400',
)

export const authHeading = cn('text-[#0F172A] dark:text-slate-100')
export const authTitle = cn('font-semibold tracking-tight text-[#0F172A] dark:text-slate-50')
export const authBody = cn('text-[#334155] dark:text-slate-300')
export const authBodyStrong = cn('font-medium text-[#1E293B] dark:text-slate-200')
export const authMuted = cn('text-[#64748B] dark:text-slate-400')
export const authSubtle = cn('text-[#94A3B8] dark:text-slate-500')

export const authAccent = cn('text-[#0EA5E9] dark:text-sky-400')

export const authBadge = cn(
  'inline-flex items-center rounded-full border border-[#BFDBFE] bg-white/60 px-3 py-1',
  'text-[10px] font-normal text-[#475569] sm:text-[11px]',
  'dark:border-white/10 dark:bg-white/[0.06] dark:text-slate-300',
)

export const authNavGhost = cn(
  'text-[#475569] hover:text-[#0F172A] dark:text-slate-300 dark:hover:text-slate-100',
)

export const authSecondaryBtn = cn(
  'rounded-xl border border-[#0EA5E9]/20 bg-white text-[#0EA5E9]',
  'hover:bg-[#0EA5E9]/5 hover:border-[#0EA5E9]/40 transition-all duration-200',
  'dark:border-sky-500/20 dark:bg-transparent dark:text-sky-400 dark:hover:bg-sky-500/10',
)

export const authOutlineBtn = cn(
  'rounded-xl border border-[#E2E8F0] bg-white text-[#0F172A]',
  'hover:bg-[#F1F5F9] hover:border-[#CBD5E1] transition-all duration-200',
  'dark:border-white/10 dark:bg-white/5 dark:text-foreground dark:hover:bg-white/10',
)

export const authPrimaryBtn = cn(
  // 海蓝渐变 + 高光扫过；语义清晰的禁用态（浅灰底，不再像「坏掉」）
  'auth-cta rounded-xl font-semibold text-white',
  'bg-gradient-to-br from-[#0284C7] to-[#0E7490]',
  'shadow-lg shadow-sky-700/25',
  'transition-[transform,box-shadow,filter] duration-200 ease-out',
  'hover:-translate-y-0.5 hover:shadow-xl hover:shadow-sky-700/30 hover:brightness-[1.07]',
  'active:translate-y-0 active:scale-[0.985] active:brightness-100',
  'motion-reduce:transition-none motion-reduce:hover:translate-y-0',
  'disabled:opacity-100 disabled:bg-none disabled:bg-[#E2E8F0] disabled:text-[#94A3B8]',
  'disabled:shadow-none disabled:cursor-not-allowed disabled:translate-y-0 disabled:brightness-100',
  'dark:from-sky-500 dark:to-cyan-600 dark:shadow-sky-500/25',
  'dark:disabled:bg-white/10 dark:disabled:text-white/40',
)

/** 右侧表单卡片 — 无边框无背景 */
export const formCard = cn(
  'w-full px-1 py-2',
)

/** 输入框 — 极简底线风格；焦点高亮交给下方的渐变下划线（authFieldUnderline） */
export const authInput = cn(
  'flex h-10 w-full border-0 border-b border-[#E2E8F0] bg-transparent px-1 py-2.5 text-sm text-[#0F172A]',
  'placeholder:text-[#94A3B8] transition-colors duration-150',
  'focus-visible:outline-none focus-visible:bg-transparent',
  'dark:border-white/10 dark:bg-transparent dark:text-foreground dark:placeholder:text-muted-foreground/60',
)

/** 字段标签 */
export const authLabel = cn(
  'text-[13px] font-medium text-[#0F172A] sm:text-sm dark:text-foreground',
)

/** 输入框左侧图标 — 聚焦时染成品牌色 */
export const authFieldIcon = cn(
  'pointer-events-none absolute left-0 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]',
  'transition-colors duration-200 peer-focus:text-[#0EA5E9] dark:peer-focus:text-sky-400',
)

/** 聚焦时从左侧生长的渐变下划线 */
export const authFieldUnderline = cn(
  'pointer-events-none absolute -bottom-px left-0 h-[2px] w-full origin-left scale-x-0',
  'bg-gradient-to-r from-[#0EA5E9] to-[#2DD4BF]',
  'transition-transform duration-500 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)]',
  'peer-focus:scale-x-100 motion-reduce:transition-none',
)

export const leftPanel = cn(
  'border-b border-[#BFDBFE]/50 lg:border-b-0 lg:border-r lg:border-[#BFDBFE]/50',
  'dark:border-white/8',
)

export const authPanel = cn('bg-transparent')

export const otpCell = cn(
  'h-10 w-9 text-center text-sm font-semibold tabular-nums sm:h-11 sm:w-10 sm:text-base',
  'border-b-2 border-[#E2E8F0] bg-transparent text-[#0F172A] dark:border-white/10 dark:text-foreground',
  'transition-colors duration-150 rounded-none',
  'focus-visible:outline-none focus-visible:border-b-[#0EA5E9]',
  'dark:focus-visible:border-b-sky-500',
  'disabled:cursor-not-allowed disabled:opacity-50',
)
