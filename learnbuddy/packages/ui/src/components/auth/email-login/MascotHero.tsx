import { BookOpen, GraduationCap, PenLine } from 'lucide-react'
import { BrandMark } from '@/components/BrandMark'
import { cn } from '@/lib/utils'

export function MascotHero({
  showBubble = true,
  className,
}: {
  showBubble?: boolean
  className?: string
}) {
  return (
    <div className={cn('relative mx-auto mb-3 h-[130px] w-[190px] sm:mb-4 sm:h-[160px] sm:w-[260px]', className)}>
      {/* 背景光晕 — 居中 */}
      <div className="absolute left-1/2 top-1/2 z-0 h-20 w-20 -translate-x-1/2 -translate-y-1/2 rounded-full bg-sky-200/25 blur-2xl sm:h-28 sm:w-28" aria-hidden />

      {/* 猫 + 气泡 — 居中一组 */}
      <div className="auth-mascot-float absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2">
        <div className="relative">
          <div className="flex items-center justify-center rounded-2xl border border-sky-100/60 bg-white/70 p-1.5 shadow-md shadow-sky-900/[0.03] backdrop-blur-sm sm:p-2.5 dark:border-white/10 dark:bg-white/10">
            <BrandMark className="h-10 w-10 object-contain drop-shadow-md sm:h-14 sm:w-14" />
          </div>
          {showBubble ? (
            <p className="auth-mascot-bubble absolute -right-2 -top-6 z-20 max-w-[7rem] whitespace-nowrap rounded-xl border border-teal-100/70 bg-white/80 px-1.5 py-0.5 text-[9px] font-normal leading-snug text-[#2DD4BF]/90 shadow-sm backdrop-blur-sm sm:-right-5 sm:-top-8 sm:max-w-[9rem] sm:px-2 sm:py-1 sm:text-[11px] dark:border-teal-500/20 dark:bg-teal-500/10">
              今天也要好好学习啊，喵~ 喵~ 喵~
            </p>
          ) : null}
        </div>
      </div>

      {/* 轨道图标 — 远离中心，散布在容器四角 */}
      <BookOpen
        className="auth-mascot-orbit-a absolute left-0.5 top-5 h-[14px] w-[14px] text-[#0EA5E9]/40 drop-shadow-sm sm:left-1 sm:top-8 sm:h-4 sm:w-4"
        strokeWidth={1.25}
        aria-hidden
      />
      <GraduationCap
        className="auth-mascot-orbit-b absolute bottom-4 right-1.5 h-[14px] w-[14px] text-[#2DD4BF]/45 drop-shadow-sm sm:bottom-6 sm:right-3 sm:h-4 sm:w-4"
        strokeWidth={1.25}
        aria-hidden
      />
      <PenLine
        className="auth-mascot-orbit-c absolute right-4 top-0 h-[13px] w-[13px] text-[#0EA5E9]/35 drop-shadow-sm sm:right-7 sm:top-1 sm:h-4 sm:w-4"
        strokeWidth={1.25}
        aria-hidden
      />
    </div>
  )
}
