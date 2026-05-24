import { cn } from '@/lib/utils'

export const authSecondaryBtn = cn(
  'rounded-xl border border-teal-200/80 bg-teal-50 text-teal-700',
  'hover:bg-teal-100 hover:border-[#2DD4BF]/60 transition-all duration-200',
  'dark:border-teal-500/30 dark:bg-teal-500/10 dark:text-teal-300 dark:hover:bg-teal-500/20',
)

export const authOutlineBtn = cn(
  'rounded-xl border border-white/60 bg-white/50 text-[#1E3A8A]/80 backdrop-blur-sm',
  'hover:bg-white/70 hover:border-white/80 transition-all duration-200',
  'dark:border-white/15 dark:bg-white/10 dark:text-foreground dark:hover:bg-white/15',
)

export const authPrimaryBtn = cn(
  'rounded-xl bg-[#0EA5E9] text-white shadow-md shadow-sky-500/25',
  'hover:bg-[#0284C7] hover:shadow-lg hover:shadow-sky-500/30 transition-all duration-200',
  'disabled:opacity-60 disabled:hover:shadow-md',
)

export const loginGlassCard = cn(
  'auth-glass-card w-full max-w-[400px] rounded-[20px] p-4 sm:rounded-[24px] sm:p-5 md:p-6',
  'border border-white/55 bg-white/40 shadow-xl shadow-sky-500/[0.08] backdrop-blur-2xl',
  'ring-1 ring-inset ring-white/50',
  'dark:border-white/15 dark:bg-white/[0.08] dark:ring-white/10',
)

export const leftPanel = cn(
  'border-r border-sky-100/50',
  'dark:border-white/10',
)

export const authPanel = cn(
  'bg-transparent',
)

export const authInput = cn(
  'flex h-9 w-full rounded-xl border border-white/60 bg-white/55 px-3 py-2 text-[13px] text-[#1E3A8A] backdrop-blur-sm sm:h-10 sm:text-sm',
  'placeholder:text-[#1E3A8A]/35 transition-all duration-150',
  'focus-visible:outline-none focus-visible:border-[#0EA5E9]/70 focus-visible:bg-white/75 focus-visible:ring-2 focus-visible:ring-[#0EA5E9]/20',
  'dark:border-white/15 dark:bg-white/10 dark:text-foreground dark:placeholder:text-muted-foreground/60',
)

export const otpCell = cn(
  'h-10 w-8 rounded-lg text-center text-sm font-semibold tabular-nums sm:h-12 sm:w-11 sm:rounded-xl sm:text-lg',
  'border border-white/60 bg-white/55 text-[#1E3A8A] backdrop-blur-sm dark:border-white/15 dark:bg-white/10',
  'transition-colors duration-150',
  'focus-visible:outline-none focus-visible:border-[#0EA5E9] focus-visible:ring-2 focus-visible:ring-[#0EA5E9]/20',
  'disabled:cursor-not-allowed disabled:opacity-50',
)
