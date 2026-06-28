import { BrandMark } from '@/components/BrandMark'
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
  authSubtle,
  authTitle,
} from '@/components/auth/email-login/styles'
import { DesktopClientDownload } from '@/components/DesktopClientDownload'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { ArrowRight, ArrowUpRight, Check, ChevronDown, ExternalLink, Heart, Plus } from 'lucide-react'
import { type CSSProperties, useEffect, useState } from 'react'
import { LANDING_COPY, LANDING_VIDEO_SRC, type LandingAuthor } from './landing-content'
import { Reveal, useMagnetic, useScrollProgress, useScrolled, useTilt } from './motion'

const APP_HREF = '/app'

/* Warm-light palette — soft cream surfaces, sky/teal with a coral pop. */
const SURFACE = 'border border-[#1E3A8A]/10 bg-white/70 shadow-sm shadow-sky-900/[0.04] backdrop-blur-sm'
const SURFACE_HOVER = 'hover:border-sky-300/70 hover:bg-white/90 hover:shadow-xl hover:shadow-sky-500/10'
const ICON_WRAP = 'bg-gradient-to-br from-sky-100 to-teal-50 ring-1 ring-inset ring-sky-100/80'
const ICON_COLOR = 'text-sky-500'

type LandingCapability = (typeof LANDING_COPY.capabilities)[number]

const NAV_ITEMS = [
  { id: 'landing-home', label: '首页' },
  { id: 'landing-why', label: '为什么本地' },
  { id: 'landing-features', label: '能力' },
  { id: 'landing-steps', label: '如何开始' },
  { id: 'landing-team', label: '关于我们' },
  { id: 'landing-thanks', label: '致谢' },
] as const

function scrollToId(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

/* --------------------------------- chrome --------------------------------- */

function ScrollProgressBar() {
  const progress = useScrollProgress()
  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-50 h-[3px]">
      <div
        className="h-full origin-left bg-gradient-to-r from-sky-400 via-teal-300 to-orange-300 shadow-[0_0_12px_rgba(45,212,191,0.45)] transition-transform duration-150 ease-out"
        style={{ transform: `scaleX(${progress})`, width: '100%' }}
      />
    </div>
  )
}

function LandingNav() {
  const scrolled = useScrolled(12)
  const magnetic = useMagnetic<HTMLAnchorElement>(0.25)

  return (
    <header
      className={cn(
        'sticky top-0 z-40 border-b transition-colors duration-300',
        scrolled ? 'border-[#1E3A8A]/10 bg-[#FFFDF9]/80 backdrop-blur-xl' : 'border-transparent bg-transparent',
      )}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6 sm:py-4">
        <a
          href="/"
          className="group flex min-w-0 items-center gap-2.5"
          onClick={(e) => {
            e.preventDefault()
            scrollToId('landing-home')
          }}
        >
          <BrandMark className="h-8 w-8 shrink-0 object-contain transition-transform duration-300 group-hover:rotate-[8deg] group-hover:scale-110 sm:h-9 sm:w-9" />
          <span className={cn('truncate text-sm sm:text-base', authTitle)}>catbuddy</span>
        </a>

        <nav className="hidden items-center gap-0.5 md:flex" aria-label="Landing">
          {NAV_ITEMS.map(({ id, label }) => (
            <Button key={id} type="button" variant="ghost" className={authNavGhost} onClick={() => scrollToId(id)}>
              {label}
            </Button>
          ))}
        </nav>

        <div className="flex shrink-0 items-center gap-2">
          <a
            ref={magnetic.ref}
            href={APP_HREF}
            onMouseMove={magnetic.onMouseMove}
            onMouseLeave={magnetic.onMouseLeave}
            className="landing-magnetic landing-shine inline-flex h-9 items-center gap-1.5 rounded-xl bg-[#0EA5E9] px-3.5 text-xs font-medium text-white shadow-md shadow-sky-500/25 transition-colors hover:bg-[#0284C7] sm:h-10 sm:px-4 sm:text-sm"
          >
            进入应用
            <ArrowRight className="h-3.5 w-3.5" />
          </a>
        </div>
      </div>
    </header>
  )
}

function LandingBackdrop() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {/* warm cream → peach → soft sky base */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#FFFDF9] via-[#FFF6EC] to-[#EAF5FF]" />
      <div className="landing-grid absolute inset-0 opacity-60" />
      {/* soft pastel aurora */}
      <div className="landing-aurora-blob left-[6%] top-[4%] h-[34rem] w-[34rem] bg-sky-200/55" />
      <div className="landing-aurora-blob right-[0%] top-[0%] h-[30rem] w-[30rem] bg-orange-200/45" style={{ animationDelay: '4s' }} />
      <div className="landing-aurora-blob bottom-[2%] left-[38%] h-[28rem] w-[28rem] bg-teal-200/45" style={{ animationDelay: '8s' }} />
      <div className="landing-aurora-blob right-[16%] bottom-[8%] h-[22rem] w-[22rem] bg-rose-200/40" style={{ animationDelay: '6s' }} />
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-sky-300/50 to-transparent" />
    </div>
  )
}

/* ----------------------------------- CTA ---------------------------------- */

function CtaRow({
  loginLabel,
  centered = false,
  className,
}: {
  loginLabel: string
  centered?: boolean
  className?: string
}) {
  return (
    <div className={cn('space-y-2.5', centered && 'mx-auto max-w-md', className)}>
      <div className={cn('flex flex-col gap-3 sm:flex-row sm:items-stretch', centered && 'sm:justify-center')}>
        <div className="relative sm:flex-1 sm:max-w-[280px]">
          <div className="landing-glow-pulse pointer-events-none absolute -inset-1 rounded-2xl bg-gradient-to-r from-sky-400/40 to-teal-300/40 blur-lg" />
          <DesktopClientDownload variant="login" showHint={false} className="!mt-0 relative w-full sm:min-w-[220px]" />
        </div>
        <a
          href={APP_HREF}
          className={cn(
            'group inline-flex h-11 w-full shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl px-4 text-sm font-medium sm:max-w-[280px] sm:flex-1',
            authOutlineBtn,
          )}
        >
          {loginLabel}
          <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
        </a>
      </div>
      <p className={cn('text-xs leading-relaxed', authMuted, centered && 'text-center')}>{LANDING_COPY.downloadHint}</p>
    </div>
  )
}

/* ---------------------------------- hero ---------------------------------- */

function HeroVideo() {
  const tilt = useTilt<HTMLDivElement>(7)

  return (
    <div
      className="landing-enter relative mx-auto w-full max-w-xl lg:max-w-none"
      style={{ '--enter-delay': '420ms' } as CSSProperties}
    >
      <div ref={tilt.ref} onMouseMove={tilt.onMouseMove} onMouseLeave={tilt.onMouseLeave} className="landing-tilt relative">
        <div className="pointer-events-none absolute -inset-4 rounded-[32px] bg-gradient-to-br from-sky-300/40 via-teal-200/30 to-orange-200/40 blur-2xl" />
        <div className="landing-tilt-layer relative overflow-hidden rounded-3xl border border-white/70 bg-white/70 shadow-xl shadow-sky-900/[0.08] ring-1 ring-inset ring-white/60 backdrop-blur-sm">
          <div className="flex items-center gap-1.5 border-b border-[#1E3A8A]/8 bg-white/50 px-4 py-2.5">
            <span className="h-2.5 w-2.5 rounded-full bg-red-400/80" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-400/80" />
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/80" />
            <span className={cn('ml-2 text-[11px]', authSubtle)}>play with catbuddy</span>
          </div>
          <div className="relative aspect-[4/5] w-full sm:aspect-video">
            <HeroVideoPlayer />
          </div>
          <p className={cn('border-t border-[#1E3A8A]/8 px-4 py-2.5 text-center text-[11px] sm:text-xs', authMuted)}>
            {LANDING_COPY.videoCaption}
          </p>
        </div>

        {/* Floating capability chips */}
        {LANDING_COPY.heroBadges.map((badge, i) => (
          <span
            key={badge}
            className={cn(
              'absolute z-10 rounded-full border border-[#1E3A8A]/10 bg-white/85 px-3 py-1 text-[11px] font-medium shadow-lg shadow-sky-900/[0.06] backdrop-blur-md',
              i === 0 && 'landing-float -left-3 top-[18%]',
              i === 1 && 'landing-float-slow -right-4 top-[12%]',
              i === 2 && 'landing-float -left-2 bottom-[20%]',
              i === 3 && 'landing-float-slow -right-3 bottom-[14%]',
            )}
          >
            <span className="bg-gradient-to-r from-sky-500 to-teal-500 bg-clip-text text-transparent">{badge}</span>
          </span>
        ))}
      </div>
    </div>
  )
}

function HeroVideoPlayer() {
  return (
    <video
      className="absolute inset-0 h-full w-full object-cover"
      src={LANDING_VIDEO_SRC}
      muted
      loop
      playsInline
      autoPlay
      preload="auto"
      aria-label="catbuddy 产品演示"
      ref={(el) => {
        if (el) void el.play().catch(() => {})
      }}
    />
  )
}

function HeroSection() {
  return (
    <section
      id="landing-home"
      className="relative scroll-mt-16 px-4 pb-12 pt-8 sm:px-6 sm:pb-16 sm:pt-12 lg:pb-24 lg:pt-16"
    >
      <div className="mx-auto grid max-w-6xl items-center gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-12 xl:gap-16">
        <div className="order-2 lg:order-1">
          <span
            className={cn('landing-enter landing-shine mb-5 inline-flex', authBadge)}
            style={{ '--enter-delay': '0ms' } as CSSProperties}
          >
            {LANDING_COPY.badge}
          </span>

          <h1
            className={cn(
              'font-alibaba text-3xl font-semibold leading-[1.12] tracking-tight sm:text-4xl lg:text-5xl xl:text-[3.25rem]',
              authTitle,
            )}
          >
            <span className="landing-enter block" style={{ '--enter-delay': '80ms' } as CSSProperties}>
              {LANDING_COPY.headlineLead}
            </span>
            <span
              className="landing-enter landing-gradient-text mt-1 block"
              style={{ '--enter-delay': '200ms' } as CSSProperties}
            >
              {LANDING_COPY.headlineAccent}
            </span>
          </h1>

          <p
            className={cn('landing-enter mt-5 max-w-xl text-sm leading-[1.9] sm:text-base', authBody)}
            style={{ '--enter-delay': '300ms' } as CSSProperties}
          >
            {LANDING_COPY.subhead}
          </p>
          <p
            className={cn('landing-enter mt-3 max-w-xl text-sm leading-[1.85] sm:text-[15px]', authBodyStrong)}
            style={{ '--enter-delay': '360ms' } as CSSProperties}
          >
            {LANDING_COPY.punchline}
          </p>

          <div className="landing-enter" style={{ '--enter-delay': '480ms' } as CSSProperties}>
            <CtaRow loginLabel="网页端体验" className="mt-7" />
          </div>

          <div
            className="landing-enter mt-5 flex flex-wrap gap-x-5 gap-y-2"
            style={{ '--enter-delay': '560ms' } as CSSProperties}
          >
            {LANDING_COPY.trustChips.map((chip) => (
              <span key={chip} className={cn('inline-flex items-center gap-1.5 text-xs', authMuted)}>
                <Check className="h-3.5 w-3.5 text-teal-500" strokeWidth={2.5} />
                {chip}
              </span>
            ))}
          </div>
        </div>

        <div className="order-1 lg:order-2">
          <HeroVideo />
        </div>
      </div>

      <button
        type="button"
        onClick={() => scrollToId('landing-why')}
        className={cn('landing-bob mx-auto mt-12 hidden items-center justify-center lg:flex', authSubtle)}
        aria-label="向下滚动"
      >
        <ChevronDown className="h-6 w-6" />
      </button>
    </section>
  )
}

/* --------------------------------- marquee -------------------------------- */

function MarqueeStrip() {
  const items = [...LANDING_COPY.marquee, ...LANDING_COPY.marquee]
  return (
    <div className="landing-marquee border-y border-[#1E3A8A]/8 bg-white/40 py-4">
      <div className="landing-marquee-track gap-3">
        {items.map((item, i) => (
          <span
            key={`${item}-${i}`}
            className={cn(
              'inline-flex items-center gap-2 rounded-full border border-[#1E3A8A]/10 bg-white/70 px-4 py-1.5 text-[13px]',
              authBody,
            )}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-gradient-to-r from-sky-500 to-teal-400" />
            {item}
          </span>
        ))}
      </div>
    </div>
  )
}

/* --------------------------------- why local ------------------------------ */

function TrustSection() {
  const { trust } = LANDING_COPY
  return (
    <section id="landing-why" className="relative scroll-mt-16 px-4 py-16 sm:px-6 sm:py-20">
      <div className="mx-auto max-w-6xl">
        <Reveal className="mx-auto max-w-2xl text-center">
          <span className={cn('mb-3 inline-flex', authBadge)}>Privacy-first</span>
          <h2 className={cn('text-2xl font-semibold tracking-tight sm:text-3xl', authHeading)}>{trust.title}</h2>
          <p className={cn('mx-auto mt-3 max-w-xl text-sm leading-relaxed sm:text-[15px]', authMuted)}>{trust.sub}</p>
        </Reveal>

        <div className="mt-12 grid gap-5 sm:grid-cols-3">
          {trust.pillars.map((pillar, i) => (
            <Reveal key={pillar.title} delay={i * 110}>
              <article className={cn('landing-card group relative h-full overflow-hidden rounded-3xl p-6', SURFACE, SURFACE_HOVER)}>
                <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-sky-300/20 opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-100" />
                <span className={cn('relative flex h-12 w-12 items-center justify-center rounded-2xl', ICON_WRAP)}>
                  <pillar.icon className={cn('h-5 w-5', ICON_COLOR)} strokeWidth={1.6} />
                </span>
                <h3 className={cn('relative mt-5 text-lg', authBodyStrong)}>{pillar.title}</h3>
                <p className={cn('relative mt-2 text-sm leading-[1.75]', authMuted)}>{pillar.desc}</p>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ------------------------------- capabilities ----------------------------- */

function StageMedia({ cap }: { cap: LandingCapability }) {
  const [failed, setFailed] = useState(false)
  if (failed) {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-gradient-to-br from-sky-50 to-teal-50">
        <cap.icon className="h-12 w-12 text-sky-400" strokeWidth={1.25} />
        <span className={cn('text-sm', authMuted)}>{cap.title}</span>
      </div>
    )
  }
  return (
    <img
      src={cap.media}
      alt={cap.title}
      loading="lazy"
      onError={() => setFailed(true)}
      className="landing-media-in absolute inset-0 h-full w-full object-cover"
    />
  )
}

function CapabilityStage({ cap }: { cap: LandingCapability }) {
  const tilt = useTilt<HTMLDivElement>(5)
  return (
    <div ref={tilt.ref} onMouseMove={tilt.onMouseMove} onMouseLeave={tilt.onMouseLeave} className="landing-tilt relative">
      <div className="pointer-events-none absolute -inset-4 rounded-[32px] bg-gradient-to-br from-sky-300/30 via-teal-200/20 to-orange-200/30 blur-2xl" />
      <div className="landing-tilt-layer relative overflow-hidden rounded-3xl border border-white/70 bg-white/70 shadow-xl shadow-sky-900/[0.08] ring-1 ring-inset ring-white/60 backdrop-blur-sm">
        <div className="flex items-center gap-1.5 border-b border-[#1E3A8A]/8 bg-white/50 px-4 py-2.5">
          <span className="h-2.5 w-2.5 rounded-full bg-red-400/80" />
          <span className="h-2.5 w-2.5 rounded-full bg-amber-400/80" />
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/80" />
          <span className={cn('ml-1.5 flex items-center gap-1.5 text-[11px]', authSubtle)}>
            <cap.icon className="h-3.5 w-3.5" strokeWidth={1.6} />
            catbuddy · {cap.title}
          </span>
        </div>
        <div className="relative aspect-[16/10] w-full overflow-hidden bg-gradient-to-br from-slate-50 to-sky-50/60">
          <StageMedia key={cap.media} cap={cap} />
        </div>
      </div>
    </div>
  )
}

function CapabilitiesSection() {
  const caps = LANDING_COPY.capabilities
  const [active, setActive] = useState(0)
  const [userPicked, setUserPicked] = useState(false)
  const STEP_MS = 3000

  useEffect(() => {
    if (userPicked) return
    const reduce =
      typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (reduce) return
    const timer = setTimeout(() => setActive((a) => (a + 1) % caps.length), STEP_MS)
    return () => clearTimeout(timer)
  }, [active, userPicked, caps.length])

  return (
    <section
      id="landing-features"
      className="relative scroll-mt-16 px-4 py-16 sm:px-6 sm:py-20"
    >
      <div className="mx-auto max-w-6xl">
        <Reveal className="mx-auto max-w-2xl text-center">
          <span className={cn('mb-3 inline-flex', authBadge)}>Capabilities</span>
          <h2 className={cn('text-2xl font-semibold tracking-tight sm:text-3xl', authHeading)}>为你而设计的能力</h2>
          <p className={cn('mx-auto mt-3 max-w-xl text-sm leading-relaxed sm:text-[15px]', authMuted)}>
            从对话到执行，从架构图到技能扩展——一个桌面端，把整套工作流连起来。
          </p>
        </Reveal>

        <div className="mt-12 grid items-center gap-6 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)] lg:gap-10">
          {/* feature list (tabs) */}
          <Reveal variant="left" className="order-2 lg:order-1">
            <ul className="flex flex-col gap-2" role="tablist" aria-label="能力">
              {caps.map((cap, i) => {
                const isActive = i === active
                return (
                  <li key={cap.title}>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={isActive}
                      onClick={() => { setActive(i); setUserPicked(true) }}
                      className={cn(
                        'w-full rounded-2xl border p-4 text-left transition-all duration-300',
                        isActive
                          ? 'border-sky-300/70 bg-white/85 shadow-md shadow-sky-500/10'
                          : 'border-transparent bg-white/40 hover:border-[#1E3A8A]/10 hover:bg-white/60',
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className={cn(
                            'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors',
                            isActive ? ICON_WRAP : 'bg-white/70 ring-1 ring-inset ring-[#1E3A8A]/8',
                          )}
                        >
                          <cap.icon
                            className={cn('h-5 w-5', isActive ? ICON_COLOR : 'text-[#1E3A8A]/40')}
                            strokeWidth={1.6}
                          />
                        </span>
                        <h3 className={cn('flex-1 text-[15px]', isActive ? authBodyStrong : authBody)}>{cap.title}</h3>
                        <span className="rounded-full border border-[#1E3A8A]/12 px-2 py-0.5 text-[10px] uppercase tracking-wider text-[#1E3A8A]/45">
                          {cap.tag}
                        </span>
                      </div>
                      <div
                        className={cn(
                          'grid transition-all duration-500 ease-out',
                          isActive ? 'mt-2.5 grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0',
                        )}
                      >
                        <div className="overflow-hidden">
                          <p className={cn('pl-[52px] text-[13px] leading-[1.7]', authMuted)}>{cap.desc}</p>
                          <div className="ml-[52px] mt-3 h-0.5 overflow-hidden rounded-full bg-[#1E3A8A]/8">
                            <div
                              key={`${active}-${userPicked}`}
                              className={cn(
                                'h-full w-full rounded-full bg-gradient-to-r from-sky-400 to-teal-400',
                                userPicked ? 'origin-left scale-x-0' : 'landing-progress',
                              )}
                              style={{ animationDuration: `${STEP_MS}ms` }}
                            />
                          </div>
                        </div>
                      </div>
                    </button>
                  </li>
                )
              })}
            </ul>
          </Reveal>

          {/* media stage */}
          <Reveal variant="right" className="order-1 lg:order-2">
            <CapabilityStage cap={caps[active]} />
          </Reveal>
        </div>
      </div>
    </section>
  )
}

/* ----------------------------------- steps -------------------------------- */

function StepsSection() {
  return (
    <section id="landing-steps" className="relative scroll-mt-16 px-4 py-16 sm:px-6 sm:py-20">
      <div className="mx-auto max-w-6xl">
        <Reveal className="mx-auto max-w-2xl text-center">
          <span className={cn('mb-3 inline-flex', authBadge)}>Get started</span>
          <h2 className={cn('text-2xl font-semibold tracking-tight sm:text-3xl', authHeading)}>三步上手</h2>
          <p className={cn('mt-3 text-sm leading-relaxed sm:text-[15px]', authMuted)}>桌面负责执行，网页随时接入。</p>
        </Reveal>

        <div className="relative mt-12">
          {/* connecting line */}
          <div className="pointer-events-none absolute left-0 right-0 top-12 hidden h-px bg-gradient-to-r from-transparent via-sky-300/60 to-transparent lg:block" />
          <ol className="grid gap-5 lg:grid-cols-3">
            {LANDING_COPY.steps.map((item, i) => (
              <Reveal key={item.step} delay={i * 130}>
                <li className={cn('landing-card group relative h-full rounded-3xl p-6', SURFACE, SURFACE_HOVER)}>
                  <span className="relative z-10 flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-lg font-semibold tabular-nums text-sky-500 ring-1 ring-inset ring-sky-200 transition-colors group-hover:text-teal-500 group-hover:ring-teal-300">
                    {item.step}
                  </span>
                  <h3 className={cn('mt-5 text-lg', authBodyStrong)}>{item.title}</h3>
                  <p className={cn('mt-2 text-sm leading-[1.75]', authMuted)}>{item.desc}</p>
                </li>
              </Reveal>
            ))}
          </ol>
        </div>
      </div>
    </section>
  )
}

/* ----------------------------------- team --------------------------------- */

function AuthorCard({ author, delay }: { author: LandingAuthor; delay: number }) {
  const tilt = useTilt<HTMLElement>(6)
  const [src, setSrc] = useState(author.avatar)

  return (
    <Reveal delay={delay} className="w-full sm:w-[320px]">
      <article
        ref={tilt.ref}
        onMouseMove={tilt.onMouseMove}
        onMouseLeave={tilt.onMouseLeave}
        className={cn(
          'landing-tilt group relative h-full overflow-hidden rounded-3xl p-7 text-center transition-colors duration-300',
          SURFACE,
          'hover:border-sky-300/70 hover:bg-white/90 hover:shadow-2xl hover:shadow-sky-500/15',
        )}
      >
        <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-sky-300/20 opacity-0 blur-3xl transition-opacity duration-500 group-hover:opacity-100" />

        <div className="landing-tilt-layer relative">
          <div className="landing-ring landing-float-slow mx-auto h-24 w-24 rounded-full">
            <img
              src={src}
              alt={author.name}
              onError={() => setSrc(author.avatarFallback)}
              className="h-full w-full rounded-full object-cover object-[center_25%]"
            />
          </div>

          <h3 className={cn('mt-5 text-lg', authTitle)}>{author.name}</h3>
          <p className={cn('mt-0.5 text-sm', authAccent)}>{author.role}</p>
          <p className={cn('text-xs', authSubtle)}>{author.handle}</p>

          <p className={cn('mt-4 text-sm leading-[1.8]', authBody)}>{author.bio}</p>

          {author.email ? <p className={cn('mt-3 text-xs', authMuted)}>{author.email}</p> : null}

          <div className="mt-5 flex flex-wrap justify-center gap-2">
            {author.links.map((link) => (
              <a
                key={link.href}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className={cn('inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium transition-colors', authOutlineBtn)}
              >
                {link.label}
                <ExternalLink className="h-3 w-3 opacity-70" aria-hidden />
              </a>
            ))}
          </div>
        </div>
      </article>
    </Reveal>
  )
}

function JoinCard({ delay }: { delay: number }) {
  const { joinCard } = LANDING_COPY
  return (
    <Reveal delay={delay} className="w-full sm:w-[320px]">
      <a
        href={joinCard.href}
        className="landing-card group flex h-full min-h-[280px] flex-col items-center justify-center rounded-3xl border border-dashed border-[#1E3A8A]/20 bg-white/50 p-7 text-center backdrop-blur-sm hover:border-teal-400/70 hover:bg-white/70"
      >
        <span className="flex h-16 w-16 items-center justify-center rounded-full border border-[#1E3A8A]/15 bg-white/70 text-[#1E3A8A]/45 transition-all duration-300 group-hover:rotate-90 group-hover:border-teal-400/60 group-hover:text-teal-500">
          <Plus className="h-7 w-7" strokeWidth={1.5} />
        </span>
        <h3 className={cn('mt-5 text-lg', authBodyStrong)}>{joinCard.title}</h3>
        <p className={cn('mt-2 max-w-[14rem] text-sm leading-[1.75]', authMuted)}>{joinCard.desc}</p>
        <span className={cn('mt-4 inline-flex items-center gap-1.5 text-sm font-medium', authAccent)}>
          {joinCard.cta}
          <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
        </span>
      </a>
    </Reveal>
  )
}

function TeamSection() {
  const { team, authors } = LANDING_COPY
  return (
    <section id="landing-team" className="relative scroll-mt-16 px-4 py-16 sm:px-6 sm:py-20">
      <div className="mx-auto max-w-6xl">
        <Reveal className="mx-auto max-w-2xl text-center">
          <span className={cn('mb-3 inline-flex', authBadge)}>About us</span>
          <h2 className={cn('text-2xl font-semibold tracking-tight sm:text-3xl', authHeading)}>{team.title}</h2>
          <p className={cn('mx-auto mt-3 max-w-xl text-sm leading-relaxed sm:text-[15px]', authMuted)}>{team.sub}</p>
        </Reveal>

        <div className="mt-12 flex flex-wrap justify-center gap-6">
          {authors.map((author, i) => (
            <AuthorCard key={author.handle} author={author} delay={i * 100} />
          ))}
          <JoinCard delay={authors.length * 100} />
        </div>
      </div>
    </section>
  )
}

/* -------------------------------- final CTA ------------------------------- */

function FinalCtaSection() {
  return (
    <section className="px-4 pb-12 pt-6 sm:px-6 sm:pb-16 sm:pt-8">
      <div className="mx-auto max-w-6xl">
        <Reveal variant="scale">
          <div className="relative overflow-hidden rounded-[2rem] border border-sky-100 bg-gradient-to-br from-sky-50 via-white/70 to-orange-50/70 px-5 py-12 text-center shadow-xl shadow-sky-500/10 sm:px-8 sm:py-16">
            <div className="landing-aurora-blob left-[20%] top-[-20%] h-72 w-72 bg-sky-200/55" />
            <div className="landing-aurora-blob right-[15%] bottom-[-30%] h-72 w-72 bg-orange-200/45" style={{ animationDelay: '5s' }} />
            <div className="relative">
              <MascotHero showBubble className="mx-auto mb-3" />
              <h2 className={cn('text-2xl font-semibold tracking-tight sm:text-3xl', authHeading)}>{LANDING_COPY.ctaTitle}</h2>
              <p className={cn('mx-auto mt-3 max-w-md text-sm leading-relaxed sm:text-[15px]', authMuted)}>
                {LANDING_COPY.ctaSub}
              </p>
              <CtaRow loginLabel="已有账号？登录" centered className="mt-7" />
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  )
}

/* ------------------------------ acknowledgements -------------------------- */

function AcknowledgementsSection() {
  const { acknowledgements: ack } = LANDING_COPY
  return (
    <section id="landing-thanks" className="relative scroll-mt-16 px-4 py-16 sm:px-6 sm:py-20">
      <div className="mx-auto max-w-6xl">
        <Reveal className="mx-auto max-w-2xl text-center">
          <span className={cn('mb-3 inline-flex', authBadge)}>Acknowledgements</span>
          <h2 className={cn('text-2xl font-semibold tracking-tight sm:text-3xl', authHeading)}>{ack.title}</h2>
          <p className={cn('mx-auto mt-3 max-w-xl text-sm leading-relaxed sm:text-[15px]', authMuted)}>{ack.sub}</p>
        </Reveal>

        <div className="mt-12 space-y-14">
          {/* 理念启发 */}
          <section>
            <Reveal>
              <h3 className={cn('mb-4 text-sm font-semibold tracking-wide uppercase', authSubtle)}>
                理念启发
              </h3>
            </Reveal>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {ack.projects.map((project, i) => (
                <Reveal key={project.name} delay={i * 90}>
                  <a
                    href={project.href}
                    target={project.href.startsWith('http') ? '_blank' : undefined}
                    rel="noopener noreferrer"
                    className={cn('landing-card group flex h-full items-start gap-3.5 rounded-2xl p-5', SURFACE, SURFACE_HOVER)}
                  >
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-sky-100 to-teal-50 text-base font-semibold text-sky-600 ring-1 ring-inset ring-sky-100/80">
                      {project.name.charAt(0).toUpperCase()}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <h4 className={cn('truncate text-[15px]', authBodyStrong)}>{project.name}</h4>
                        <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-[#1E3A8A]/40 transition-all duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-sky-500" />
                      </div>
                      <p className={cn('mt-1 text-[13px] leading-[1.65]', authMuted)}>{project.desc}</p>
                    </div>
                  </a>
                </Reveal>
              ))}
            </div>
          </section>

          {/* 技术开源 */}
          <section>
            <Reveal>
              <h3 className={cn('mb-4 text-sm font-semibold tracking-wide uppercase', authSubtle)}>
                技术开源
              </h3>
            </Reveal>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {ack.techStack.map((tech, i) => (
                <Reveal key={tech.name} delay={i * 70}>
                  <a
                    href={tech.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cn('landing-card group flex h-full items-start gap-3.5 rounded-2xl p-5', SURFACE, SURFACE_HOVER)}
                  >
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-50 to-orange-50 text-base font-semibold text-amber-600 ring-1 ring-inset ring-amber-100/80">
                      {tech.name.charAt(0).toUpperCase()}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <h4 className={cn('truncate text-[15px]', authBodyStrong)}>{tech.name}</h4>
                        <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-[#1E3A8A]/40 transition-all duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-sky-500" />
                      </div>
                      <p className={cn('mt-1 text-[13px] leading-[1.65]', authMuted)}>{tech.desc}</p>
                    </div>
                  </a>
                </Reveal>
              ))}
            </div>
          </section>
        </div>

        <Reveal delay={120}>
          <p className={cn('mt-10 flex items-center justify-center gap-1.5 text-xs', authSubtle)}>
            以及所有未列出的项目与社区 —— 感谢开源
            <Heart className="h-3.5 w-3.5 text-rose-400" fill="currentColor" aria-hidden />
          </p>
        </Reveal>
      </div>
    </section>
  )
}

function LandingFooter() {
  return (
    <footer className="border-t border-[#1E3A8A]/8 px-4 py-7 text-center sm:px-6">
      <p className={cn('text-[11px] sm:text-xs', authSubtle)}>catbuddy · create by catbuddy team</p>
    </footer>
  )
}

export function LandingPage() {
  useEffect(() => {
    document.title = 'catbuddy · 本地 AI 伙伴'
    const meta = document.querySelector('meta[name="description"]')
    if (meta) meta.setAttribute('content', LANDING_COPY.subhead)
  }, [])

  return (
    <div
      id="landing-scroll-root"
      className="relative h-dvh max-h-dvh w-full overflow-x-hidden overflow-y-auto overscroll-y-contain bg-[#FFFDF9] text-[#1E3A8A]"
    >
      <ScrollProgressBar />
      <LandingBackdrop />
      <div className="relative z-10 flex min-h-full flex-col">
        <LandingNav />
        <main className="flex-1">
          <HeroSection />
          <MarqueeStrip />
          <TrustSection />
          <CapabilitiesSection />
          <StepsSection />
          <TeamSection />
          <AcknowledgementsSection />
          <FinalCtaSection />
        </main>
        <LandingFooter />
      </div>
    </div>
  )
}
