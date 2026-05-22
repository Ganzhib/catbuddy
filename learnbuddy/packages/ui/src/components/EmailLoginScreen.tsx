import { useState } from 'react'
import { Eye, EyeOff, Loader2, Mail, ShieldCheck, Sparkles } from 'lucide-react'
import { BrandMark } from '@/components/BrandMark'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  loginWithPassword,
  requestEmailCode,
  requestRegister,
  resolveGatewayHttpBase,
  verifyRegister,
} from '@learnbuddy/platform'

type AuthMode = 'login' | 'register'
type RegisterStep = 'form' | 'verify'

const FEATURES = [
  {
    icon: ShieldCheck,
    title: '安全省心',
    desc: '注册需邮箱验证码；日常登录使用邮箱与密码。',
  },
  {
    icon: Mail,
    title: '登录 · 注册',
    desc: '新用户注册后验证邮箱；下次登录输入邮箱与密码即可。',
  },
  {
    icon: Sparkles,
    title: '多端同步',
    desc: '网页与桌面应用共用账号，学习对话与进度无缝衔接。',
  },
] as const

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

  const canSubmitVerify = email.includes('@') && code.trim().length >= 4

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

  return (
    <div className="relative flex min-h-full w-full overflow-hidden">
      <AmbientBackground />

      <aside
        className={cn(
          'relative z-10 hidden w-[min(44%,520px)] shrink-0 flex-col justify-between lg:flex',
          glassPanel,
          'rounded-none border-y-0 border-l-0',
        )}
      >
        <div className="relative flex flex-1 flex-col justify-center px-10 py-12 xl:px-14">
          <div className="mb-10 flex items-center gap-3">
            <span className={cn(glassChip, 'p-2')}>
              <BrandMark className="h-10 w-10 object-contain" />
            </span>
            <div>
              <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
                learnbuddy
              </p>
              <p className="text-lg font-semibold tracking-tight">智能学习助手</p>
            </div>
          </div>
          <h1 className="max-w-md text-3xl font-semibold leading-tight tracking-tight xl:text-[2rem]">
            开启你的智能学习之旅
          </h1>
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-muted-foreground">
            learnbuddy 是你的 AI 学习伙伴：答疑、讲解、练习与复盘，一站完成。
          </p>
          <ul className="mt-10 space-y-4">
            {FEATURES.map(({ icon: Icon, title, desc }) => (
              <li key={title} className={cn('flex gap-3 rounded-xl p-3', glassChip)}>
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  <Icon className="h-4 w-4 text-primary" strokeWidth={1.75} />
                </span>
                <div>
                  <p className="text-sm font-medium">{title}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{desc}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
        <p className="relative px-10 pb-8 text-[11px] text-muted-foreground/70 xl:px-14">
          © learnbuddy
        </p>
      </aside>

      <main className="relative z-10 flex flex-1 flex-col items-center justify-center px-6 py-10 sm:px-10">
        <div className="mb-6 flex w-full max-w-[420px] items-center gap-3 lg:hidden">
          <span className={cn(glassChip, 'p-2')}>
            <BrandMark className="h-9 w-9 object-contain" />
          </span>
          <div>
            <p className="text-sm font-semibold">邮箱登录 · 注册</p>
            <p className="text-xs text-muted-foreground">邮箱 + 密码</p>
          </div>
        </div>

        <div className={cn('w-full max-w-[420px] p-8 sm:p-9', glassPanel, 'shadow-2xl shadow-black/5')}>
          <p className="text-center text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            邮箱登录 · 注册
          </p>
          <h2 className="mt-2 text-center text-2xl font-semibold tracking-tight">
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

          <p className="mb-5 mt-5 text-sm text-muted-foreground">
            {mode === 'login'
              ? '使用已注册邮箱与密码登录。登录过期后重新输入即可。'
              : registerStep === 'verify'
                ? `请输入发送到 ${email.trim()} 的 6 位验证码，验证通过后将自动登录。`
                : '填写邮箱并设置密码（至少 8 位），我们将向邮箱发送验证码。'}
          </p>

          {mode === 'login' ? (
            <form className="space-y-4" onSubmit={(e) => void onLoginSubmit(e)}>
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
              <AuthAlerts error={error} hint={null} />
              <Button
                type="submit"
                className="w-full shadow-md"
                size="lg"
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
              <SwitchModeLink
                label="还没有账号？"
                action="去注册"
                onClick={() => {
                  setMode('register')
                  setError(null)
                  resetRegister()
                }}
              />
            </form>
          ) : registerStep === 'form' ? (
            <form className="space-y-4" onSubmit={(e) => void onRegisterFormSubmit(e)}>
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
                <label htmlFor="register-password-confirm" className="text-sm font-medium">
                  确认密码
                </label>
                <input
                  id="register-password-confirm"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  placeholder="再次输入密码"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className={glassInput}
                />
              </div>
              <AuthAlerts error={error} hint={null} />
              <Button
                type="submit"
                className="w-full shadow-md"
                size="lg"
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
              <SwitchModeLink
                label="已有账号？"
                action="去登录"
                onClick={() => {
                  setMode('login')
                  setError(null)
                  resetRegister()
                  setConfirmPassword('')
                }}
              />
            </form>
          ) : (
            <form className="space-y-4" onSubmit={(e) => void onVerifySubmit(e)}>
              <div className="space-y-2">
                <label htmlFor="register-code" className="text-sm font-medium">
                  验证码
                </label>
                <input
                  id="register-code"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="6 位数字"
                  maxLength={8}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                  className={cn(glassInput, 'text-center tracking-[0.35em]')}
                  autoFocus
                />
              </div>
              <AuthAlerts error={error} hint={hint} />
              <Button
                type="submit"
                className="w-full shadow-md"
                size="lg"
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
              <div className="flex flex-col gap-2 text-center text-xs text-muted-foreground">
                <button
                  type="button"
                  className="font-medium text-foreground underline-offset-2 hover:underline disabled:opacity-50"
                  disabled={busy}
                  onClick={() => void resendCode()}
                >
                  重新发送验证码
                </button>
                <button
                  type="button"
                  className="underline-offset-2 hover:underline"
                  onClick={() => {
                    setError(null)
                    setHint(null)
                    setRegisterStep('form')
                    setCode('')
                  }}
                >
                  修改邮箱或密码
                </button>
              </div>
            </form>
          )}
        </div>

        <p className="mt-6 max-w-[420px] text-center text-[11px] leading-relaxed text-muted-foreground/90">
          继续即表示您同意 learnbuddy 的服务条款与隐私政策。
        </p>
      </main>
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
      <label htmlFor={id} className="text-sm font-medium">
        邮箱地址
      </label>
      <input
        id={id}
        type="email"
        autoComplete="email"
        placeholder="you@email.com"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={glassInput}
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
      <label htmlFor={id} className="text-sm font-medium">
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
          className={cn(glassInput, 'pr-10')}
        />
        <button
          type="button"
          tabIndex={-1}
          aria-label={showPassword ? '隐藏密码' : '显示密码'}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-muted-foreground hover:bg-black/5 dark:hover:bg-white/10"
          onClick={onToggleShow}
        >
          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </div>
  )
}

function AuthAlerts({ error, hint }: { error: string | null; hint: string | null }) {
  return (
    <>
      {hint ? (
        <p className="rounded-xl border border-primary/20 bg-primary/5 px-3 py-2.5 text-xs text-muted-foreground backdrop-blur-sm">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p
          role="alert"
          className="rounded-xl border border-destructive/25 bg-destructive/10 px-3 py-2.5 text-xs text-destructive backdrop-blur-sm"
        >
          {error}
        </p>
      ) : null}
    </>
  )
}

function SwitchModeLink({
  label,
  action,
  onClick,
}: {
  label: string
  action: string
  onClick: () => void
}) {
  return (
    <p className="text-center text-xs text-muted-foreground">
      {label}
      <button
        type="button"
        className="ml-1 font-medium text-foreground underline-offset-2 hover:underline"
        onClick={onClick}
      >
        {action}
      </button>
    </p>
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
        'mt-6 flex rounded-xl p-1',
        'bg-black/[0.04] dark:bg-white/[0.06] backdrop-blur-md',
        'border border-white/50 dark:border-white/10',
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
              ? 'bg-card/90 text-foreground shadow-sm dark:bg-white/15'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {m === 'login' ? '登录' : '注册'}
        </button>
      ))}
    </div>
  )
}

function AmbientBackground() {
  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden>
      <div className="absolute inset-0 bg-gradient-to-br from-[hsl(44_38%_96%)] via-[hsl(43_36%_93%)] to-[hsl(40_32%_90%)] dark:from-neutral-950 dark:via-slate-900 dark:to-indigo-950/40" />
      <div className="absolute -left-24 top-1/4 h-72 w-72 rounded-full bg-amber-200/35 blur-3xl dark:bg-sky-500/20" />
      <div className="absolute right-0 top-0 h-96 w-96 rounded-full bg-orange-200/25 blur-3xl dark:bg-violet-600/15" />
      <div className="absolute bottom-0 left-1/3 h-80 w-80 rounded-full bg-yellow-100/40 blur-3xl dark:bg-amber-500/10" />
    </div>
  )
}

const glassPanel = cn(
  'border border-[hsl(40_22%_84%/0.65)] dark:border-white/[0.12]',
  'bg-[hsl(44_42%_97.5%/0.72)] dark:bg-neutral-900/45',
  'backdrop-blur-2xl backdrop-saturate-150',
  'shadow-[0_8px_40px_rgba(92,72,40,0.08)]',
  'rounded-2xl',
)

const glassChip = cn(
  'border border-[hsl(40_22%_84%/0.55)] dark:border-white/10',
  'bg-[hsl(44_38%_96%/0.55)] dark:bg-white/5',
  'backdrop-blur-xl',
)

function otpHint(expiresIn: number, delivery?: 'email' | 'console'): string {
  if (delivery === 'console') {
    return `验证码 ${expiresIn} 秒内有效。未配置邮件服务：请到运行 pnpm gateway:dev 的终端查找「验证码: xxxxxx」，不要查收件箱。`
  }
  return `验证码已发送到邮箱（${expiresIn} 秒内有效）。若未收到，请检查垃圾邮件，或点「重新发送」。`
}

const glassInput = cn(
  'flex h-11 w-full rounded-xl px-3 py-2 text-sm transition-all',
  'border border-[hsl(40_22%_84%/0.7)] bg-[hsl(44_42%_97.5%/0.65)] dark:border-white/15 dark:bg-white/5',
  'backdrop-blur-md placeholder:text-muted-foreground/70',
  'shadow-inner shadow-black/[0.03]',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent',
)
