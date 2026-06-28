import { memo } from 'react'
import { useTranslation } from 'react-i18next'
import { BrandMark } from '@/components/BrandMark'
import { DesktopClientDownload } from '@/components/DesktopClientDownload'
import { cn } from '@/lib/utils'
import Lightfall from './Lightfall'
import { TextType } from './TextType'
import { WigglyFigures } from './WigglyFigures'
import { authBrandLabel, authSubtle, leftPanel } from './styles'

export const LoginMarketingPanel = memo(function LoginMarketingPanel() {
  const { t } = useTranslation()
  const hint = t('desktopDownload.hint')

  return (
    <aside
      className={cn(
        'relative z-10 flex w-full shrink-0 flex-col lg:h-full lg:min-h-0 lg:w-1/2',
        leftPanel,
      )}
    >
      {/* WebGL 浅蓝流光背景 — 仅左侧面板 */}
      <Lightfall
        colors={['#0EA5E9', '#2DD4BF', '#BAE6FD']}
        backgroundColor="#DBEAFE"
        speed={0.3}
        streakCount={2}
        streakWidth={1}
        streakLength={1.5}
        glow={0.8}
        density={0.4}
        twinkle={0.6}
        zoom={2.5}
        backgroundGlow={0.3}
        opacity={0.7}
        mouseInteraction
        mouseStrength={0.3}
        mouseRadius={1}
      />

      {/* 暗色模式叠加 */}
      <div className="absolute inset-0 pointer-events-none dark:bg-[#0a1628] dark:opacity-100 opacity-0 z-[1]" />

      <div className="relative flex min-h-0 flex-1 flex-col items-center justify-center px-6 py-6 sm:px-8 sm:py-8 lg:px-10 lg:py-10 xl:px-14 z-[2]">
        {/* 品牌信息 */}
        <div className="mb-4 flex flex-col items-center text-center lg:mb-6">
          <BrandMark className="h-10 w-10 object-contain drop-shadow-md sm:h-11 sm:w-11 lg:h-12 lg:w-12" />
          <p className={cn('mt-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#0EA5E9]/80 sm:text-[11px]', authBrandLabel)}>
            智能学习助手
          </p>
          {/* 渐变艺术字标题 */}
          <span
            className={cn(
              'bg-gradient-to-r from-[#0EA5E9] via-[#2DD4BF] to-[#0EA5E9] bg-clip-text text-transparent',
              'text-2xl font-extrabold tracking-tight sm:text-3xl lg:text-4xl',
              'drop-shadow-sm',
            )}
          >
            catbuddy
          </span>
          <span className={cn('mt-1 text-[11px] text-[#475569] sm:text-xs dark:text-slate-400', authSubtle)}>
            create by catbuddy team
          </span>
        </div>

        {/* 小人 - 输入密码时探头 */}
        <div className="mb-5 lg:mb-8">
          <WigglyFigures />
        </div>

        {/* 桌面端下载 + 打字效果提示 */}
        <div className="auth-hide-short w-full max-w-sm">
          <DesktopClientDownload variant="login" showHint={false} className="!mt-0" />
          <p className="mt-2 text-center text-xs leading-relaxed min-h-[3em] text-white">
            <TextType
              texts={[hint]}
              typingSpeed={65}
              pauseDuration={4000}
              showCursor
              cursorCharacter="_"
            />
          </p>
        </div>
      </div>
    </aside>
  )
})
