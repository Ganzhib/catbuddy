import { useCallback, useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import { authMuted } from './styles'
import type { LucideIcon } from 'lucide-react'

interface FeatureItem {
  icon: LucideIcon
  title: string
  desc: string
}

export function FeatureCarousel({
  items,
  interval = 3500,
}: {
  items: readonly FeatureItem[]
  interval?: number
}) {
  const len = items.length
  // 实际索引 0..len-1；渲染时在前面加最后一项克隆、后面加第一项克隆
  const [realIndex, setRealIndex] = useState(0)
  const [hovered, setHovered] = useState(false)
  const [animating, setAnimating] = useState(true)
  const timerRef = useRef<ReturnType<typeof setInterval>>()
  const animTimeoutRef = useRef<ReturnType<typeof setTimeout>>()

  // 平滑前进
  const advance = useCallback(() => {
    setAnimating(true)
    setRealIndex((prev) => prev + 1)
  }, [])

  // 自动轮播
  useEffect(() => {
    if (hovered) return
    timerRef.current = setInterval(() => {
      advance()
    }, interval)
    return () => clearInterval(timerRef.current)
  }, [hovered, interval, advance])

  // 过渡结束 → 判断是否克隆位，瞬间回跳（无动画）
  const onTransitionEnd = () => {
    setRealIndex((prev) => {
      if (prev >= len) return 0      // 过了最后一项克隆 → 跳回首项
      if (prev < 0) return len - 1   // 倒退到第一项克隆之前
      return prev
    })
    setAnimating(false)
  }

  // 点击指示器
  const goTo = (index: number) => {
    clearInterval(timerRef.current)
    clearTimeout(animTimeoutRef.current)
    setAnimating(true)
    setRealIndex(index)
  }

  // 渲染列表：[clone of last, ...items, clone of first]
  const displayItems = [items[len - 1], ...items, items[0]]
  // 翻译量：实际索引 + 1（因为前面多加了一项克隆）
  const translateX = -((realIndex + 1) * 100)

  return (
    <div
      className="w-full max-w-sm"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* 卡片容器 - 无限循环滑动 */}
      <div className="overflow-hidden rounded-xl sm:rounded-2xl">
        <div
          className="flex"
          style={{
            transform: `translateX(${translateX}%)`,
            transition: animating ? 'transform 500ms ease-out' : 'none',
          }}
          onTransitionEnd={onTransitionEnd}
        >
          {displayItems.map(({ icon: ItemIcon, title, desc }, index) => (
            <div
              key={index}
              className="w-full shrink-0 rounded-xl bg-white/60 px-4 py-4 backdrop-blur-sm shadow-sm sm:rounded-2xl sm:px-5 sm:py-5 lg:px-6 lg:py-5 dark:bg-white/[0.06]"
            >
              <div className="flex items-start gap-3 sm:gap-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#0EA5E9]/15 to-[#2DD4BF]/15 sm:h-11 sm:w-11 lg:h-12 lg:w-12 dark:from-sky-500/15 dark:to-teal-500/15">
                  <ItemIcon className="h-5 w-5 text-[#0EA5E9] sm:h-[22px] sm:w-[22px] dark:text-sky-400" strokeWidth={1.5} />
                </span>
                <div className="min-w-0">
                  <p className="text-[12px] font-semibold text-[#1E293B] sm:text-[13px] lg:text-sm dark:text-slate-200">{title}</p>
                  <p className={cn('mt-1 text-[11px] leading-[1.6] sm:text-xs sm:leading-[1.65] lg:text-[13px]', authMuted)}>{desc}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 指示器 — 按真实项数 */}
      <div className="mt-3 flex items-center justify-center gap-2">
        {items.map((_, index) => (
          <button
            key={index}
            type="button"
            onClick={() => goTo(index)}
            aria-label={`第 ${index + 1} 项`}
            className={cn(
              'h-1.5 rounded-full transition-all duration-300',
              index === (realIndex % len)
                ? 'w-6 bg-[#0EA5E9] dark:bg-sky-400'
                : 'w-1.5 bg-[#0EA5E9]/30 hover:bg-[#0EA5E9]/50 dark:bg-sky-400/30 dark:hover:bg-sky-400/50',
            )}
          />
        ))}
      </div>
    </div>
  )
}
