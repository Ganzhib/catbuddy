import { BrandMark } from '@/components/BrandMark'
import { DesktopClientDownload } from '@/components/DesktopClientDownload'
import { cn } from '@/lib/utils'
import { FEATURES } from './constants'
import { MascotHero } from './MascotHero'
import {
  authBadge,
  authBodyStrong,
  authBrandLabel,
  authHeading,
  authMuted,
  authSubtle,
  authTitle,
  leftPanel,
} from './styles'

export function LoginMarketingPanel() {
  return (
    <aside
      className={cn(
        'relative z-10 flex w-full shrink-0 flex-col border-b border-sky-100/50 lg:h-full lg:min-h-0 lg:w-[min(44%,520px)] lg:justify-between lg:border-b-0',
        leftPanel,
      )}
    >
      <div className="relative flex min-h-0 flex-1 flex-col justify-center px-5 py-5 sm:px-6 sm:py-6 lg:px-10 lg:py-8 xl:px-14 xl:py-10">
        <MascotHero showBubble className="mb-5 shrink-0 lg:mb-6" />
        <div className="mb-3 flex items-center gap-2.5 sm:mb-4 lg:mb-6 lg:gap-3">
          <BrandMark className="h-7 w-7 object-contain opacity-80 sm:h-8 sm:w-8 lg:h-9 lg:w-9" />
          <div>
            <p className={authBrandLabel}>catbuddy</p>
            <span className={cn('text-[15px] sm:text-base lg:text-lg', authTitle)}>智能学习助手</span>
            <span> </span>
            <span className={cn('text-[10px] sm:text-[11px] lg:text-[12px]', authSubtle)}>create by ganzhibin</span>
          </div>
        </div>
        <span className={cn('mb-3 w-fit lg:mb-4 lg:px-3.5 lg:py-1.5', authBadge)}>每一步，都算数 ✦</span>
        <h1 className={cn('max-w-md text-lg leading-relaxed sm:text-xl lg:text-2xl xl:text-[26px]', authHeading)}>
          你的 AI 学习助手，随时待命
        </h1>
        <p className={cn('mt-2 max-w-sm text-[11px] leading-[1.7] sm:text-xs lg:mt-3 lg:text-[13px] lg:leading-[1.75]', authMuted)}>
          桌面端负责思考与执行，网页端随身接入——提问、跟进、远程遥控，一套账号打通。
        </p>
        <ul className="mt-4 space-y-2 sm:mt-5 lg:mt-7 lg:space-y-3">
          {FEATURES.map(({ icon: Icon, title, desc }) => (
            <li
              key={title}
              className="flex items-start gap-2.5 rounded-xl bg-white/40 px-3 py-2 shadow-none backdrop-blur-sm sm:gap-3 sm:rounded-2xl sm:px-3.5 sm:py-2.5 lg:gap-3.5 lg:px-4 lg:py-3 dark:bg-white/[0.04]"
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-sky-50 to-teal-50/50 sm:h-8 sm:w-8 lg:h-9 lg:w-9 lg:rounded-xl dark:from-sky-500/10 dark:to-teal-500/10">
                <Icon className="h-3.5 w-3.5 text-[#0EA5E9] dark:text-sky-400 sm:h-4 sm:w-4 lg:h-[18px] lg:w-[18px]" strokeWidth={1.5} />
              </span>
              <div className="min-w-0 pt-0.5">
                <p className={cn('text-[11px] sm:text-xs lg:text-[13px]', authBodyStrong)}>{title}</p>
                <p className={cn('auth-clamp-2 mt-0.5 text-[10px] leading-[1.55] sm:text-[11px] sm:leading-[1.6] lg:mt-1 lg:text-[12px] lg:leading-[1.65]', authMuted)}>
                  {desc}
                </p>
              </div>
            </li>
          ))}
        </ul>
        <DesktopClientDownload variant="login" className="auth-hide-short mt-5 max-w-sm lg:mt-8" />
      </div>
      <div className="h-10" />
    </aside>
  )
}
