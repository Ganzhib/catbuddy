import { BrandMark } from '@/components/BrandMark'
import { DesktopClientDownload } from '@/components/DesktopClientDownload'
import { cn } from '@/lib/utils'
import { FEATURES } from './constants'
import { MascotHero } from './MascotHero'
import { leftPanel } from './styles'

export function LoginMarketingPanel() {
  return (
    <aside
      className={cn(
        'relative z-10 hidden h-full min-h-0 w-[min(44%,520px)] shrink-0 flex-col justify-between lg:flex',
        leftPanel,
      )}
    >
      <div className="relative flex min-h-0 flex-1 flex-col justify-center px-10 py-8 xl:px-14 xl:py-10">
        <MascotHero showBubble className="mb-6 shrink-0" />
        <div className="mb-6 flex items-center gap-3">
          <BrandMark className="h-9 w-9 object-contain opacity-80" />
          <div>
            <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-[#0EA5E9]/80">
              learnbuddy
            </p>
            <p className="text-lg font-semibold tracking-tight text-[#1E3A8A]/90">
              智能学习助手
            </p>
          </div>
        </div>
        <span className="mb-4 inline-flex w-fit items-center rounded-full border border-sky-200/50 bg-white/60 px-3.5 py-1.5 text-[11px] font-normal text-[#1E3A8A]/70 auth-hide-short">
          每一步，都算数 ✦
        </span>
        <h1 className="max-w-md text-2xl font-semibold leading-relaxed tracking-tight text-[#1E3A8A]/90 xl:text-[26px]">
          你的 AI 学习助手，随时待命
        </h1>
        <p className="auth-clamp-2 mt-3 max-w-sm text-[13px] leading-[1.75] text-[#1E3A8A]/55">
          桌面端负责思考与执行，网页端随身接入——提问、跟进、远程遥控，一套账号打通。
        </p>
        <ul className="mt-7 space-y-3">
          {FEATURES.map(({ icon: Icon, title, desc }) => (
            <li key={title} className="flex items-start gap-3.5 rounded-2xl bg-white/40 px-4 py-3 shadow-none backdrop-blur-sm dark:bg-white/[0.04]">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-sky-50 to-teal-50/50">
                <Icon className="h-[18px] w-[18px] text-[#0EA5E9]" strokeWidth={1.5} />
              </span>
              <div className="min-w-0 pt-0.5">
                <p className="text-[13px] font-medium text-[#1E3A8A]/85">{title}</p>
                <p className="auth-clamp-2 mt-1 text-[12px] leading-[1.65] text-[#1E3A8A]/55">{desc}</p>
              </div>
            </li>
          ))}
        </ul>
        <DesktopClientDownload variant="login" className="auth-hide-short mt-8 max-w-sm" />
      </div>
      <p className="relative shrink-0 px-8 pb-4 text-right text-[10px] text-[#1E3A8A]/50 xl:px-12">
        © learnbuddy · 作者：甘智斌
      </p>
    </aside>
  )
}
