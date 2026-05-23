import { useCallback, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { BookOpen, Eye, EyeOff, GraduationCap, Laptop, Loader2, PenLine, ShieldCheck, Sparkles } from 'lucide-react'
import { BrandMark } from '@/components/BrandMark'
import { DesktopClientDownload } from '@/components/DesktopClientDownload'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  loginWithPassword,
  requestEmailCode,
  requestRegister,
  resolveGatewayHttpBase,
  syncDesktopGatewayAccountEmail,
  verifyRegister,
} from '@learnbuddy/platform'

type AuthMode = 'login' | 'register'
type RegisterStep = 'form' | 'verify'

const FEATURES = [
  {
    icon: Sparkles,
    title: '会动手帮你的助手',
    desc: '不只是聊天——它能查资料、读写文件、写代码、整理笔记，按步骤把学习任务做到底。',
  },
  {
    icon: Laptop,
    title: '网页遥控桌面',
    desc: '在浏览器提问，桌面应用替你执行；开启远程控制后，对话与进度实时同步，换设备也能接着聊。',
  },
  {
    icon: ShieldCheck,
    title: '本地执行更安心',
    desc: '助手在你的电脑上运行，学习与文件操作留在本机，同一账号可在网页继续对话。',
  },
] as const

const authSecondaryBtn = cn(
  'rounded-xl border border-teal-200/80 bg-teal-50 text-teal-700',
  'hover:bg-teal-100 hover:border-[#2DD4BF]/60 transition-all duration-200',
  'dark:border-teal-500/30 dark:bg-teal-500/10 dark:text-teal-300 dark:hover:bg-teal-500/20',
)

const authOutlineBtn = cn(
  'rounded-xl border border-white/60 bg-white/50 text-[#1E3A8A]/80 backdrop-blur-sm',
  'hover:bg-white/70 hover:border-white/80 transition-all duration-200',
  'dark:border-white/15 dark:bg-white/10 dark:text-foreground dark:hover:bg-white/15',
)

const authPrimaryBtn = cn(
  'rounded-xl bg-[#0EA5E9] text-white shadow-md shadow-sky-500/25',
  'hover:bg-[#0284C7] hover:shadow-lg hover:shadow-sky-500/30 transition-all duration-200',
  'disabled:opacity-60 disabled:hover:shadow-md',
)

export function EmailLoginScreen({ onSuccess }: { onSuccess: () => void }) {
  const [mode, setMode] = useState<AuthMode>('login')
  const [registerStep, setRegisterStep] = useState<RegisterStep>('form')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [code, setCode] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hint, setHint] = useState<string | null>(null)

  const base = resolveGatewayHttpBase()

  const canSubmitLogin =
    email.includes('@') && password.length >= 8

  const canSubmitRegisterForm =
    email.includes('@')
    && password.length >= 8
    && password === confirmPassword

  const canSubmitVerify = email.includes('@') && code.length === 6

  const resetRegister = () => {
    setRegisterStep('form')
    setCode('')
    setHint(null)
  }

  const onLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      await loginWithPassword(email.trim(), password, base)
      await syncDesktopGatewayAccountEmail()
      onSuccess()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  const onRegisterFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setHint(null)
    if (password !== confirmPassword) {
      setError('两次输入的密码不一致')
      return
    }
    setBusy(true)
    try {
      const res = await requestRegister(email.trim(), password, base)
      setHint(otpHint(res.expiresIn, res.delivery))
      setRegisterStep('verify')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  const onVerifySubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      await verifyRegister(email.trim(), code.trim(), base)
      await syncDesktopGatewayAccountEmail()
      onSuccess()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  const resendCode = async () => {
    setError(null)
    setBusy(true)
    try {
      const res = await requestEmailCode(email.trim(), base, password)
      setHint(otpHint(res.expiresIn, res.delivery))
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  const goToRegister = () => {
    setMode('register')
    setError(null)
    setHint(null)
    resetRegister()
  }

  const goToLogin = () => {
    setMode('login')
    setError(null)
    setHint(null)
    resetRegister()
    setConfirmPassword('')
  }

  const formEyebrow =
    mode === 'login'
      ? '欢迎回来'
      : registerStep === 'verify'
        ? '邮箱验证'
        : '创建账号'

  return (
    <div className="relative h-dvh max-h-dvh w-full overflow-hidden overscroll-none">
      <AmbientBackground />

      <ViewportFitShell fitKey={`${mode}-${registerStep}-${error ?? ''}-${hint ?? ''}`}>
      <aside
        className={cn(
          'relative z-10 hidden h-full min-h-0 w-[min(44%,520px)] shrink-0 flex-col justify-between lg:flex',
          leftPanel,
        )}
      >
        <div className="relative flex min-h-0 flex-1 flex-col justify-center px-8 py-5 xl:px-12 xl:py-6">
          <MascotHero compact showBubble className="mb-3 shrink-0" />
          <div className="mb-4 flex items-center gap-2.5">
            <span className={cn(brandChip, 'p-1.5')}>
              <BrandMark className="h-8 w-8 object-contain" />
            </span>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-[#0EA5E9]">
                learnbuddy
              </p>
              <p className="text-base font-bold tracking-tight text-[#1E3A8A]">
                智能学习助手
              </p>
            </div>
          </div>
          <span className="mb-2 inline-flex w-fit items-center rounded-full border border-sky-200/70 bg-white/80 px-3 py-1 text-[11px] font-medium text-[#1E3A8A]/80 shadow-sm auth-hide-short">
            每一步，都算数 ✦
          </span>
          <h1 className="max-w-md text-xl font-bold leading-snug tracking-tight text-[#1E3A8A] xl:text-2xl">
            你的 AI 学习助手，随时待命
          </h1>
          <p className="auth-clamp-2 mt-2 max-w-sm text-xs leading-relaxed text-[#1E3A8A]/70">
            桌面端负责思考与执行，网页端随身接入——提问、跟进、远程遥控，一套账号打通。
          </p>
          <ul className="mt-4 space-y-2">
            {FEATURES.map(({ icon: Icon, title, desc }) => (
              <li key={title} className={cn('flex items-start gap-3', featureCard)}>
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sky-50">
                  <Icon className="h-4 w-4 text-[#0EA5E9]" strokeWidth={1.75} />
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-[#1E3A8A]">{title}</p>
                  <p className="auth-clamp-2 mt-0.5 text-[11px] leading-snug text-[#1E3A8A]/65">{desc}</p>
                </div>
              </li>
            ))}
          </ul>
          <DesktopClientDownload variant="login" className="auth-hide-short mt-4 max-w-sm" />
        </div>
        <p className="relative shrink-0 px-8 pb-4 text-right text-[10px] text-[#1E3A8A]/50 xl:px-12">
          © learnbuddy · 作者：甘智斌
        </p>
      </aside>

      <main
        className={cn(
          'relative z-10 flex h-full min-h-0 flex-1 flex-col items-center justify-center overflow-hidden',
          authPanel,
          'px-4 py-4 sm:px-6',
        )}
      >
        <MascotHero compact showBubble className="mb-3 shrink-0 lg:hidden" />
        <div className={loginGlassCard}>
          <p className="text-center text-[11px] font-semibold uppercase tracking-[0.2em] text-[#0EA5E9]">
            {formEyebrow}
          </p>
          <h2 className="mt-2 text-center text-2xl font-bold tracking-tight text-[#1E3A8A] dark:text-foreground">
            {mode === 'login'
              ? '登录'
              : registerStep === 'verify'
                ? '验证邮箱'
                : '注册'}
          </h2>

          {mode === 'register' && registerStep === 'verify' ? null : (
            <ModeTabs
              mode={mode}
              onChange={(m) => {
                setMode(m)
                setError(null)
                setHint(null)
                resetRegister()
              }}
            />
          )}

          <p className="mb-5 mt-4 text-center text-xs leading-relaxed text-[#1E3A8A]/60 dark:text-muted-foreground">
            {mode === 'login'
              ? '登录后网页与桌面实时同步。'
              : registerStep === 'verify'
                ? (
                  <>
                    我们已向{' '}
                    <span className="font-medium text-foreground">{email.trim()}</span>
                    {' '}发送验证码，请输入邮件中的 6 位数字完成注册。
                  </>
                )
                : '填写邮箱并设置密码（至少 8 位），我们将向邮箱发送验证码。'}
          </p>

          {mode === 'login' ? (
            <form className="space-y-3.5" onSubmit={(e) => void onLoginSubmit(e)}>
              <EmailField id="login-email" value={email} onChange={setEmail} />
              <PasswordField
                id="login-password"
                label="密码"
                autoComplete="current-password"
                placeholder="请输入密码"
                value={password}
                onChange={setPassword}
                showPassword={showPassword}
                onToggleShow={() => setShowPassword((v) => !v)}
              />
              <AuthFeedback
                error={error}
                hint={null}
                onGoRegister={goToRegister}
                onGoLogin={goToLogin}
              />
              <Button
                type="submit"
                className={cn('w-full', authPrimaryBtn)}
                size="default"
                disabled={busy || !canSubmitLogin}
              >
                {busy ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    登录中…
                  </>
                ) : (
                  '登录'
                )}
              </Button>
              <SwitchModeButton
                label="还没有账号？"
                actionLabel="去注册"
                onClick={goToRegister}
              />
            </form>
          ) : registerStep === 'form' ? (
            <form className="space-y-3.5" onSubmit={(e) => void onRegisterFormSubmit(e)}>
              <EmailField id="register-email" value={email} onChange={setEmail} />
              <PasswordField
                id="register-password"
                label="密码"
                autoComplete="new-password"
                placeholder="至少 8 位"
                value={password}
                onChange={setPassword}
                showPassword={showPassword}
                onToggleShow={() => setShowPassword((v) => !v)}
              />
              <div className="space-y-2">
                <label htmlFor="register-password-confirm" className="text-sm font-medium text-[#1E3A8A] dark:text-foreground">
                  确认密码
                </label>
                <input
                  id="register-password-confirm"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  placeholder="再次输入密码"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className={authInput}
                />
              </div>
              <AuthFeedback
                error={error}
                hint={null}
                onGoRegister={goToRegister}
                onGoLogin={goToLogin}
              />
              <Button
                type="submit"
                className={cn('w-full', authPrimaryBtn)}
                size="default"
                disabled={busy || !canSubmitRegisterForm}
              >
                {busy ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    发送验证码…
                  </>
                ) : (
                  '获取验证码'
                )}
              </Button>
              <SwitchModeButton
                label="已有账号？"
                actionLabel="去登录"
                onClick={goToLogin}
              />
            </form>
          ) : (
            <form className="space-y-3.5" onSubmit={(e) => void onVerifySubmit(e)}>
              <OtpInput value={code} onChange={setCode} disabled={busy} />
              <AuthFeedback
                error={error}
                hint={hint}
                onGoRegister={goToRegister}
                onGoLogin={goToLogin}
              />
              <Button
                type="submit"
                className={cn('w-full', authPrimaryBtn)}
                size="default"
                disabled={busy || !canSubmitVerify}
              >
                {busy ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    验证中…
                  </>
                ) : (
                  '验证并登录'
                )}
              </Button>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <Button
                  type="button"
                  variant="outline"
                  className={cn('w-full', authOutlineBtn)}
                  disabled={busy}
                  onClick={() => void resendCode()}
                >
                  重新发送验证码
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className={cn('w-full', authOutlineBtn)}
                  disabled={busy}
                  onClick={() => {
                    setError(null)
                    setHint(null)
                    setRegisterStep('form')
                    setCode('')
                  }}
                >
                  修改邮箱或密码
                </Button>
              </div>
            </form>
          )}

          <p className="mt-5 text-center text-[10px] leading-relaxed text-[#1E3A8A]/45">
            继续即表示您同意 learnbuddy 的服务条款与隐私政策。
          </p>
          <p className="mt-1 text-center text-[10px] text-[#1E3A8A]/45 lg:hidden">
            © learnbuddy · 作者：甘智斌
          </p>
        </div>
      </main>
      </ViewportFitShell>
    </div>
  )
}

function ViewportFitShell({ children, fitKey }: { children: ReactNode; fitKey?: string }) {
  const outerRef = useRef<HTMLDivElement>(null)
  const innerRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)

  useLayoutEffect(() => {
    const outer = outerRef.current
    const inner = innerRef.current
    if (!outer || !inner) return

    const fit = () => {
      inner.style.transform = 'none'
      const neededH = inner.scrollHeight
      const neededW = inner.scrollWidth
      const availH = outer.clientHeight
      const availW = outer.clientWidth
      const next = Math.min(1, availH / neededH, availW / neededW)
      setScale(Number.isFinite(next) ? Math.max(0.72, next) : 1)
    }

    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(outer)
    ro.observe(inner)
    window.addEventListener('resize', fit)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', fit)
    }
  }, [fitKey])

  return (
    <div
      ref={outerRef}
      className="relative z-10 flex h-full w-full items-center justify-center overflow-hidden"
    >
      <div
        ref={innerRef}
        className="flex h-full w-full max-w-[100vw] origin-center"
        style={{ transform: scale < 1 ? `scale(${scale})` : undefined }}
      >
        {children}
      </div>
    </div>
  )
}

function EmailField({
  id,
  value,
  onChange,
}: {
  id: string
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="text-sm font-medium text-[#1E3A8A] dark:text-foreground">
        邮箱地址
      </label>
      <input
        id={id}
        type="email"
        autoComplete="email"
        placeholder="you@email.com"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={authInput}
        autoFocus
      />
    </div>
  )
}

function PasswordField({
  id,
  label,
  autoComplete,
  placeholder,
  value,
  onChange,
  showPassword,
  onToggleShow,
}: {
  id: string
  label: string
  autoComplete: string
  placeholder: string
  value: string
  onChange: (v: string) => void
  showPassword: boolean
  onToggleShow: () => void
}) {
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="text-sm font-medium text-[#1E3A8A] dark:text-foreground">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={showPassword ? 'text' : 'password'}
          autoComplete={autoComplete}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={cn(authInput, 'pr-10')}
        />
        <button
          type="button"
          tabIndex={-1}
          aria-label={showPassword ? '隐藏密码' : '显示密码'}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-xl p-1.5 text-[#1E3A8A]/40 transition-all duration-150 hover:bg-sky-50 hover:text-[#0EA5E9] dark:hover:bg-sky-500/15 dark:hover:text-sky-400"
          onClick={onToggleShow}
        >
          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </div>
  )
}

function resolveAuthErrorAction(message: string): 'go_register' | 'go_login' | null {
  if (message.includes('尚未注册')) return 'go_register'
  if (message.includes('已注册')) return 'go_login'
  return null
}

function AuthFeedback({
  error,
  hint,
  onGoRegister,
  onGoLogin,
}: {
  error: string | null
  hint: string | null
  onGoRegister?: () => void
  onGoLogin?: () => void
}) {
  const action = error ? resolveAuthErrorAction(error) : null
  const guidance = action === 'go_register' || action === 'go_login'

  return (
    <>
      {hint ? (
        <p className="rounded-xl border border-white/50 bg-white/45 px-3.5 py-2.5 text-xs leading-relaxed text-[#1E3A8A]/70 backdrop-blur-sm dark:border-sky-500/25 dark:bg-sky-500/10 dark:text-muted-foreground">
          {hint}
        </p>
      ) : null}
      {error ? (
        <div
          role="alert"
          className={cn(
            'rounded-xl border px-3.5 py-2.5',
            guidance
              ? 'border-teal-100/80 bg-white/40 backdrop-blur-sm dark:border-teal-500/25 dark:bg-teal-500/10'
              : 'border-red-200 bg-red-50 dark:border-destructive/25 dark:bg-destructive/10',
          )}
        >
          <p
            className={cn(
              'text-xs leading-relaxed',
              guidance ? 'text-muted-foreground' : 'text-destructive',
            )}
          >
            {error}
          </p>
          {action === 'go_register' && onGoRegister ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className={cn('mt-2.5 w-full', authSecondaryBtn)}
              onClick={onGoRegister}
            >
              去注册
            </Button>
          ) : null}
          {action === 'go_login' && onGoLogin ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className={cn('mt-2.5 w-full', authSecondaryBtn)}
              onClick={onGoLogin}
            >
              去登录
            </Button>
          ) : null}
        </div>
      ) : null}
    </>
  )
}

function SwitchModeButton({
  label,
  actionLabel,
  onClick,
}: {
  label: string
  actionLabel: string
  onClick: () => void
}) {
  return (
    <div className="space-y-1.5 pt-1">
      <p className="text-center text-xs text-muted-foreground">{label}</p>
      <Button
        type="button"
        variant="outline"
        className={cn('w-full', authSecondaryBtn)}
        onClick={onClick}
      >
        {actionLabel}
      </Button>
    </div>
  )
}

function ModeTabs({
  mode,
  onChange,
}: {
  mode: AuthMode
  onChange: (m: AuthMode) => void
}) {
  return (
    <div
      className={cn(
        'mt-5 flex rounded-2xl border border-white/50 bg-white/35 p-1 backdrop-blur-sm',
        'dark:border-white/10 dark:bg-white/[0.06]',
      )}
      role="tablist"
      aria-label="登录或注册"
    >
      {(['login', 'register'] as const).map((m) => (
        <button
          key={m}
          type="button"
          role="tab"
          aria-selected={mode === m}
          onClick={() => onChange(m)}
          className={cn(
            'flex-1 rounded-lg py-2.5 text-sm font-medium transition-all duration-200',
            mode === m
              ? 'bg-white/90 text-[#0EA5E9] shadow-sm backdrop-blur-sm dark:bg-white/15 dark:text-sky-400'
              : 'text-[#1E3A8A]/50 hover:text-[#0EA5E9] dark:text-muted-foreground dark:hover:text-sky-400',
          )}
        >
          {m === 'login' ? '登录' : '注册'}
        </button>
      ))}
    </div>
  )
}

function MascotHero({
  compact = false,
  showBubble = !compact,
  className,
}: {
  compact?: boolean
  showBubble?: boolean
  className?: string
}) {
  return (
    <div className={cn('relative flex justify-center', compact ? 'mb-2' : 'mb-6', className)}>
      <div
        className={cn(
          'absolute rounded-full bg-sky-200/30 blur-2xl',
          compact ? 'h-24 w-24' : 'h-32 w-32',
        )}
        aria-hidden
      />
      <div className="auth-mascot-float relative z-10">
        <div
          className={cn(
            'relative rounded-xl border border-sky-100/80 bg-white shadow-lg shadow-sky-900/5',
            compact ? 'p-2.5' : 'p-4',
          )}
        >
          <BrandMark
            className={cn('object-contain drop-shadow-lg', compact ? 'h-14 w-14' : 'h-20 w-20')}
          />
        </div>
        {showBubble ? (
          <p className="auth-mascot-bubble absolute -right-2 -top-10 max-w-[9.5rem] rounded-xl border border-teal-100 bg-white px-2.5 py-1.5 text-[10px] font-medium leading-snug text-[#2DD4BF] shadow-md">
            今天也要好好学习啊，喵~ 喵~ 喵~
          </p>
        ) : null}
      </div>
      <BookOpen
        className={cn(
          'auth-mascot-orbit-a absolute text-[#0EA5E9]/70 drop-shadow-sm',
          compact ? '-left-1 top-1 h-5 w-5' : '-left-3 top-2 h-6 w-6',
        )}
        strokeWidth={1.75}
        aria-hidden
      />
      <GraduationCap
        className={cn(
          'auth-mascot-orbit-b absolute text-[#2DD4BF]/80 drop-shadow-sm',
          compact ? '-right-1 bottom-0 h-5 w-5' : '-right-4 bottom-1 h-6 w-6',
        )}
        strokeWidth={1.75}
        aria-hidden
      />
      <PenLine
        className={cn(
          'auth-mascot-orbit-c absolute text-[#0EA5E9]/60 drop-shadow-sm',
          compact ? 'right-2 top-0 h-4 w-4' : 'right-0 -top-2 h-5 w-5',
        )}
        strokeWidth={1.75}
        aria-hidden
      />
    </div>
  )
}

function AmbientBackground() {
  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden>
      <div className="absolute inset-0 bg-gradient-to-br from-[#EFF6FF] via-[#E8F2FC] to-[#DBEAFE] dark:from-[#0c1929] dark:via-[#0e1f33] dark:to-[#0a1628]" />
      <WavePattern className="auth-wave-drift-a absolute -left-[10%] top-[18%] h-[420px] w-[120%] opacity-[0.035] dark:opacity-[0.06]" />
      <WavePattern className="auth-wave-drift-b absolute -right-[5%] bottom-[12%] h-[380px] w-[110%] opacity-[0.03] dark:opacity-[0.05]" flip />
      <div className="auth-orb-drift-a absolute -left-20 top-[15%] h-80 w-80 rounded-full bg-sky-200/40 blur-3xl dark:bg-sky-500/10" />
      <div className="auth-orb-drift-b absolute right-[-5%] top-[8%] h-96 w-96 rounded-full bg-teal-200/30 blur-3xl dark:bg-teal-500/10" />
      <div className="auth-orb-drift-c absolute bottom-[-10%] left-[35%] h-72 w-72 rounded-full bg-sky-300/20 blur-3xl dark:bg-sky-400/10" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_30%,rgba(14,165,233,0.06),transparent_50%)]" />
    </div>
  )
}

function WavePattern({ className, flip = false }: { className?: string; flip?: boolean }) {
  return (
    <svg
      className={cn(className, flip && 'scale-x-[-1]')}
      viewBox="0 0 1440 320"
      preserveAspectRatio="none"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M0,160 C240,80 480,240 720,160 C960,80 1200,240 1440,160 L1440,320 L0,320 Z"
        fill="#0EA5E9"
      />
      <path
        d="M0,200 C360,120 540,260 900,200 C1080,160 1260,280 1440,220 L1440,320 L0,320 Z"
        fill="#2DD4BF"
        opacity="0.5"
      />
    </svg>
  )
}

const loginGlassCard = cn(
  'auth-glass-card w-full max-w-[400px] rounded-[24px] p-5 sm:p-6',
  'border border-white/55 bg-white/40 shadow-xl shadow-sky-500/[0.08] backdrop-blur-2xl',
  'ring-1 ring-inset ring-white/50',
  'dark:border-white/15 dark:bg-white/[0.08] dark:ring-white/10',
)

const leftPanel = cn(
  'border-r border-sky-100/50',
  'dark:border-white/10',
)

const authPanel = cn(
  'bg-transparent',
)

const brandChip = cn(
  'rounded-xl border border-sky-100/80 bg-white shadow-sm',
  'dark:border-white/15 dark:bg-white/10',
)

const featureCard = cn(
  'rounded-xl border border-sky-100/60 bg-white/90 p-2.5 shadow-sm shadow-sky-900/[0.04]',
  'dark:border-white/10 dark:bg-white/5',
)

const authInput = cn(
  'flex h-10 w-full rounded-xl border border-white/60 bg-white/55 px-3 py-2 text-sm text-[#1E3A8A] backdrop-blur-sm',
  'placeholder:text-[#1E3A8A]/35 transition-all duration-150',
  'focus-visible:outline-none focus-visible:border-[#0EA5E9]/70 focus-visible:bg-white/75 focus-visible:ring-2 focus-visible:ring-[#0EA5E9]/20',
  'dark:border-white/15 dark:bg-white/10 dark:text-foreground dark:placeholder:text-muted-foreground/60',
)

function otpHint(expiresIn: number, delivery?: 'email' | 'console'): string {
  const expiry = formatExpiry(expiresIn)
  if (delivery === 'console') {
    return `验证码 ${expiry} 内有效。当前为开发环境，验证码不会发到邮箱，请向管理员获取或在服务端日志中查看。`
  }
  return `验证码已发送，请查收邮件（${expiry} 内有效）。没收到？看看垃圾箱，或点击下方重新发送。`
}

function formatExpiry(seconds: number): string {
  if (seconds >= 60 && seconds % 60 === 0) {
    return `${seconds / 60} 分钟`
  }
  if (seconds >= 60) {
    return `${Math.ceil(seconds / 60)} 分钟`
  }
  return `${seconds} 秒`
}

const OTP_LENGTH = 6

function OtpInput({
  value,
  onChange,
  disabled,
}: {
  value: string
  onChange: (v: string) => void
  disabled?: boolean
}) {
  const inputsRef = useRef<Array<HTMLInputElement | null>>([])

  const digits = Array.from({ length: OTP_LENGTH }, (_, i) => value[i] ?? '')

  const focusAt = useCallback((index: number) => {
    const el = inputsRef.current[index]
    if (el) {
      el.focus()
      el.select()
    }
  }, [])

  const applyDigits = useCallback(
    (next: string[]) => {
      onChange(next.join('').slice(0, OTP_LENGTH))
    },
    [onChange],
  )

  const handleChange = (index: number, raw: string) => {
    const digit = raw.replace(/\D/g, '').slice(-1)
    const next = [...digits]
    next[index] = digit
    applyDigits(next)
    if (digit && index < OTP_LENGTH - 1) {
      focusAt(index + 1)
    }
  }

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      if (digits[index]) {
        const next = [...digits]
        next[index] = ''
        applyDigits(next)
      } else if (index > 0) {
        focusAt(index - 1)
      }
      e.preventDefault()
      return
    }
    if (e.key === 'ArrowLeft' && index > 0) {
      focusAt(index - 1)
      e.preventDefault()
      return
    }
    if (e.key === 'ArrowRight' && index < OTP_LENGTH - 1) {
      focusAt(index + 1)
      e.preventDefault()
    }
  }

  const handlePaste = (e: React.ClipboardEvent) => {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, OTP_LENGTH)
    if (!pasted) return
    e.preventDefault()
    const next = Array.from({ length: OTP_LENGTH }, (_, i) => pasted[i] ?? '')
    applyDigits(next)
    focusAt(Math.min(pasted.length, OTP_LENGTH) - 1)
  }

  return (
    <fieldset disabled={disabled}>
      <legend className="sr-only">验证码</legend>
      <div className="flex justify-center gap-2.5 sm:gap-3" onPaste={handlePaste}>
        {digits.map((digit, index) => (
          <input
            key={index}
            ref={(el) => {
              inputsRef.current[index] = el
            }}
            type="text"
            inputMode="numeric"
            autoComplete={index === 0 ? 'one-time-code' : 'off'}
            aria-label={`验证码第 ${index + 1} 位`}
            maxLength={1}
            value={digit}
            disabled={disabled}
            autoFocus={index === 0}
            onChange={(e) => handleChange(index, e.target.value)}
            onKeyDown={(e) => handleKeyDown(index, e)}
            onFocus={(e) => e.target.select()}
            className={cn(
              otpCell,
              digit && 'border-[#0EA5E9]/70 bg-white/70 text-[#1E3A8A] dark:bg-sky-500/10',
            )}
          />
        ))}
      </div>
    </fieldset>
  )
}

const otpCell = cn(
  'h-11 w-9 rounded-xl text-center text-base font-semibold tabular-nums sm:h-12 sm:w-11 sm:text-lg',
  'border border-white/60 bg-white/55 text-[#1E3A8A] backdrop-blur-sm dark:border-white/15 dark:bg-white/10',
  'transition-colors duration-150',
  'focus-visible:outline-none focus-visible:border-[#0EA5E9] focus-visible:ring-2 focus-visible:ring-[#0EA5E9]/20',
  'disabled:cursor-not-allowed disabled:opacity-50',
)
