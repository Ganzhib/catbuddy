import { BrandMark } from '@/components/BrandMark'
import { AmbientBackground } from '@/components/auth/email-login/AmbientBackground'
import { MascotHero } from '@/components/auth/email-login/MascotHero'
import {
  authAccent,
  authBadge,
  authBody,
  authBodyStrong,
  authHeading,
  authMuted,
  authNavGhost,
  authOutlineBtn,
  authPrimaryBtn,
  authSubtle,
  authTitle,
} from '@/components/auth/email-login/styles'
import { DesktopClientDownload } from '@/components/DesktopClientDownload'
import { Button } from '@/components/ui/button'
import { useTheme } from '@/hooks/useTheme'
import { cn } from '@/lib/utils'
import { Moon, Sun } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { LANDING_COPY, LANDING_FEATURES, LANDING_VIDEO_SRC } from './landing-content'

const APP_HREF = '/app'

function LandingCtaRow({
  loginLabel,
  centered = false,
  className,
}: {
  loginLabel: string
  centered?: boolean
  className?: string
}) {
  return (
    <div className={cn('space-y-2', centered && 'mx-auto max-w-md', className)}>
      <div className={cn('flex flex-col gap-3 sm:flex-row sm:items-stretch', centered && 'sm:justify-center')}>
        <DesktopClientDownload
          variant="login"
          showHint={false}
          className="!mt-0 w-full sm:min-w-[220px] sm:max-w-[280px] sm:flex-1"
        />
        <a
          href={APP_HREF}
          className={cn(
            'inline-flex h-11 w-full shrink-0 items-center justify-center whitespace-nowrap rounded-xl px-4 text-sm font-medium sm:max-w-[280px] sm:flex-1',
            authOutlineBtn,
          )}
        >
          {loginLabel}
        </a>
      </div>
      <p className={cn('text-xs leading-relaxed', authMuted, centered && 'text-center')}>
        {LANDING_COPY.downloadHint}
      </p>
    </div>
  )
}

function scrollToId(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

function LandingNav({ onToggleTheme, theme }: { onToggleTheme: () => void; theme: 'light' | 'dark' }) {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const root = document.getElementById('landing-scroll-root')
    if (!root) return
    const onScroll = () => setScrolled(root.scrollTop > 12)
    onScroll()
    root.addEventListener('scroll', onScroll, { passive: true })
    return () => root.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header
      className={cn(
        'sticky top-0 z-30 border-b transition-colors duration-200',
        scrolled
          ? 'border-sky-100/60 bg-white/75 backdrop-blur-xl dark:border-white/10 dark:bg-[#0c1929]/80'
          : 'border-transparent bg-transparent',
      )}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6 sm:py-4">
        <a href="/" className="flex min-w-0 items-center gap-2.5">
          <BrandMark className="h-8 w-8 shrink-0 object-contain sm:h-9 sm:w-9" />
          <span className={cn('truncate text-sm sm:text-base', authTitle)}>catbuddy</span>
        </a>

        <nav className="hidden items-center gap-1 md:flex" aria-label="Landing">
          <Button
            type="button"
            variant="ghost"
            className={authNavGhost}
            onClick={() => scrollToId('landing-roles')}
          >
            产品价值
          </Button>
          <Button
            type="button"
            variant="ghost"
            className={authNavGhost}
            onClick={() => scrollToId('landing-steps')}
          >
            如何开始
          </Button>
          <Button
            type="button"
            variant="ghost"
            className={authNavGhost}
            onClick={() => scrollToId('landing-features')}
          >
            能力
          </Button>
        </nav>

        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={cn('h-9 w-9 rounded-full', authNavGhost)}
            onClick={onToggleTheme}
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>

        </div>
      </div>
    </header>
  )
}

function HeroVideo() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [needsTap, setNeedsTap] = useState(false)

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    const play = () => {
      void video.play().catch(() => setNeedsTap(true))
    }
    play()
    video.addEventListener('loadeddata', play)
    return () => video.removeEventListener('loadeddata', play)
  }, [])

  return (
    <div className="relative mx-auto w-full max-w-xl lg:max-w-none">
      <div className="pointer-events-none absolute -inset-3 rounded-[28px] bg-gradient-to-br from-sky-300/30 via-teal-200/20 to-sky-400/25 blur-2xl dark:from-sky-500/15 dark:via-teal-500/10 dark:to-sky-400/15 sm:-inset-4" />
      <div className="relative overflow-hidden rounded-2xl border border-white/60 bg-white/30 shadow-xl shadow-sky-900/[0.06] ring-1 ring-inset ring-white/50 backdrop-blur-sm dark:border-white/10 dark:bg-white/[0.04] dark:ring-white/10 sm:rounded-3xl">
        <div className="relative aspect-[4/5] w-full sm:aspect-video">
          <video
            ref={videoRef}
            className="absolute inset-0 h-full w-full object-cover"
            src={LANDING_VIDEO_SRC}
            muted
            loop
            playsInline
            autoPlay
            preload="metadata"
            aria-label="catbuddy 产品演示"
          />
          {needsTap ? (
            <button
              type="button"
              className="absolute inset-0 flex items-center justify-center bg-black/20 text-sm font-medium text-white backdrop-blur-[2px]"
              onClick={() => {
                void videoRef.current?.play().then(() => setNeedsTap(false))
              }}
            >
              点击播放
            </button>
          ) : null}
        </div>
        <p className={cn('border-t border-sky-100/60 px-4 py-2.5 text-center text-[11px] dark:border-white/10 sm:text-xs', authMuted)}>
          {LANDING_COPY.videoCaption}
        </p>
      </div>
    </div>
  )
}

function HeroSection() {
  return (
    <section className="relative px-4 pb-10 pt-6 sm:px-6 sm:pb-14 sm:pt-10 lg:pb-20 lg:pt-12">
      <div className="mx-auto grid max-w-6xl items-center gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-12 xl:gap-16">
        <div className="order-2 lg:order-1">
          <span className={cn('mb-4 text-[10px] sm:text-[11px]', authBadge)}>
            {LANDING_COPY.badge}
          </span>
          <h1 className={cn('text-2xl leading-tight sm:text-3xl lg:text-4xl xl:text-[2.5rem] xl:leading-[1.15]', authTitle)}>
            {LANDING_COPY.headline}
          </h1>
          <p className={cn('mt-4 text-sm leading-[1.85] sm:text-[15px] sm:leading-[1.9] lg:mt-5 lg:text-base', authBody)}>
            {LANDING_COPY.story}
          </p>
          <p className={cn('mt-3 text-sm leading-[1.85] sm:text-[15px] lg:text-base', authBodyStrong)}>
            {LANDING_COPY.punchline}
          </p>

          <LandingCtaRow loginLabel="网页端登录" className="mt-6 sm:mt-8" />
        </div>

        <div className="order-1 lg:order-2">
          <HeroVideo />
        </div>
      </div>
    </section>
  )
}

function RolesSection() {
  return (
    <section id="landing-roles" className="scroll-mt-16 px-4 py-10 sm:px-6 sm:py-14">
      <div className="mx-auto max-w-6xl">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className={cn('text-xl sm:text-2xl', authHeading)}>
            两种陪伴，一种信赖
          </h2>
          <p className={cn('mt-2 text-sm leading-relaxed sm:text-[15px]', authMuted)}>
            像真实的猫一样，catbuddy 既懂你的情绪，也帮得上你的忙。
          </p>
        </div>

        <div className="mt-8 grid gap-4 sm:mt-10 sm:grid-cols-2 sm:gap-5">
          {LANDING_COPY.roles.map((role) => (
            <article
              key={role.title}
              className="rounded-2xl border border-sky-100/60 bg-white/45 p-5 shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-white/[0.04] sm:rounded-3xl sm:p-6"
            >
              <h3 className={cn('text-base sm:text-lg', authBodyStrong)}>{role.title}</h3>
              <p className={cn('mt-2 text-sm leading-[1.75]', authMuted)}>{role.desc}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}

function StepsSection() {
  return (
    <section id="landing-steps" className="scroll-mt-16 px-4 py-10 sm:px-6 sm:py-14">
      <div className="mx-auto max-w-6xl">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className={cn('text-xl sm:text-2xl', authHeading)}>
            三步上手
          </h2>
          <p className={cn('mt-2 text-sm leading-relaxed sm:text-[15px]', authMuted)}>
            桌面负责执行，网页随时接入。
          </p>
        </div>

        <ol className="mt-8 space-y-4 sm:mt-10 lg:grid lg:grid-cols-3 lg:gap-5 lg:space-y-0">
          {LANDING_COPY.steps.map((item) => (
            <li
              key={item.step}
              className="relative rounded-2xl border border-sky-100/60 bg-white/40 p-5 backdrop-blur-sm dark:border-white/10 dark:bg-white/[0.04] sm:rounded-3xl sm:p-6"
            >
              <span className={cn('text-[11px] font-semibold tracking-[0.2em]', authAccent)}>{item.step}</span>
              <h3 className={cn('mt-2 text-base', authBodyStrong)}>{item.title}</h3>
              <p className={cn('mt-2 text-sm leading-[1.7]', authMuted)}>{item.desc}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}

function FeaturesSection() {
  return (
    <section id="landing-features" className="scroll-mt-16 px-4 py-10 sm:px-6 sm:py-14">
      <div className="mx-auto max-w-6xl">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className={cn('text-xl sm:text-2xl', authHeading)}>
            为你而设计的能力
          </h2>
        </div>

        <ul className="mt-8 space-y-3 sm:mt-10 lg:grid lg:grid-cols-3 lg:gap-4 lg:space-y-0">
          {LANDING_FEATURES.map(({ icon: Icon, title, desc }) => (
            <li
              key={title}
              className="flex items-start gap-3 rounded-2xl bg-white/40 px-4 py-3.5 backdrop-blur-sm dark:bg-white/[0.04] sm:rounded-3xl sm:px-5 sm:py-4"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-sky-50 to-teal-50/50 dark:from-sky-500/10 dark:to-teal-500/10">
                <Icon className="h-4 w-4 text-[#0EA5E9] dark:text-sky-400" strokeWidth={1.5} />
              </span>
              <div className="min-w-0 pt-0.5">
                <p className={cn('text-sm', authBodyStrong)}>{title}</p>
                <p className={cn('mt-1 text-xs leading-[1.65] sm:text-[13px]', authMuted)}>
                  {desc}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

function FinalCtaSection() {
  return (
    <section className="px-4 pb-8 pt-4 sm:px-6 sm:pb-12 sm:pt-6">
      <div className="mx-auto max-w-6xl">
        <div className="relative overflow-hidden rounded-3xl border border-sky-100/60 bg-gradient-to-br from-white/70 via-sky-50/50 to-teal-50/40 px-5 py-8 text-center shadow-lg shadow-sky-900/[0.04] dark:border-white/10 dark:from-white/[0.06] dark:via-sky-500/[0.06] dark:to-teal-500/[0.04] sm:px-8 sm:py-10">
          <MascotHero showBubble className="mx-auto mb-2 sm:mb-3" />
          <h2 className={cn('text-xl sm:text-2xl', authHeading)}>
            {LANDING_COPY.ctaTitle}
          </h2>
          <p className={cn('mx-auto mt-2 max-w-md text-sm leading-relaxed sm:text-[15px]', authMuted)}>
            {LANDING_COPY.ctaSub}
          </p>
          <LandingCtaRow loginLabel="已有账号？登录" centered className="mt-6" />
        </div>
      </div>
    </section>
  )
}

function LandingFooter() {
  return (
    <footer className="border-t border-sky-100/50 px-4 py-6 text-center dark:border-white/10 sm:px-6">
      <p className={cn('text-[11px] sm:text-xs', authSubtle)}>
        catbuddy · create by ganzhibin
      </p>
    </footer>
  )
}

export function LandingPage() {
  const { theme, toggle } = useTheme()

  useEffect(() => {
    document.title = 'catbuddy · 智能学习助手'
    const meta = document.querySelector('meta[name="description"]')
    if (meta) {
      meta.setAttribute('content', LANDING_COPY.punchline)
    }
  }, [])

  return (
    <div
      id="landing-scroll-root"
      className="relative h-dvh max-h-dvh w-full overflow-x-hidden overflow-y-auto overscroll-y-contain bg-background text-foreground"
    >
      <AmbientBackground />
      <div className="relative z-10 flex min-h-full flex-col">
        <LandingNav onToggleTheme={toggle} theme={theme} />
        <main className="flex-1">
          <HeroSection />
          <RolesSection />
          <StepsSection />
          <FeaturesSection />
          <FinalCtaSection />
        </main>
        <LandingFooter />
      </div>
    </div>
  )
}
