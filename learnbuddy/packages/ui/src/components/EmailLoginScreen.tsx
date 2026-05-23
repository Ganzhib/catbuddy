import { useCallback, useRef, useState } from 'react'
import { Eye, EyeOff, Laptop, Loader2, ShieldCheck, Sparkles } from 'lucide-react'
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
  'rounded-lg border border-blue-200 bg-blue-50 text-blue-700',
  'hover:bg-blue-100 hover:border-blue-300 transition-all duration-200',
  'dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-300 dark:hover:bg-blue-500/20',
)

const authOutlineBtn = cn(
  'rounded-lg border border-gray-200 bg-white text-gray-700',
  'hover:bg-gray-50 hover:border-gray-300 transition-all duration-200',
  'dark:border-white/15 dark:bg-white/5 dark:text-foreground dark:hover:bg-white/10',
)

const authPrimaryBtn = cn(
  'rounded-lg bg-blue-600 text-white shadow-md',
  'hover:bg-blue-700 hover:shadow-lg transition-all duration-200',
  'disabled:opacity-60 disabled:hover:bg-blue-600 disabled:hover:shadow-md',
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
    <div className="relative flex min-h-full w-full overflow-hidden">
      <AmbientBackground />

      <aside
        className={cn(
          'relative z-10 hidden w-[min(44%,520px)] shrink-0 flex-col justify-between lg:flex',
          leftPanel,
        )}
      >
        <div className="relative flex flex-1 flex-col justify-center px-10 py-12 xl:px-14">
          <div className="mb-10 flex items-center gap-3">
            <span className={cn(brandChip, 'p-2')}>
              <BrandMark className="h-10 w-10 object-contain" />
            </span>
            <div>
              <p className="text-xs font-medium uppercase tracking-widest text-gray-500 dark:text-muted-foreground">
                learnbuddy
              </p>
              <p className="text-lg font-semibold tracking-tight text-gray-800 dark:text-foreground">
                智能学习助手
              </p>
            </div>
          </div>
          <h1 className="max-w-md text-[2rem] font-bold leading-tight tracking-tight text-[#222222] xl:text-[2.25rem] dark:text-foreground">
            你的 AI 学习助手，随时待命
          </h1>
          <p className="mt-4 max-w-sm text-sm font-normal leading-relaxed text-[#666666] dark:text-muted-foreground">
            桌面端负责思考与执行，网页端随身接入——提问、跟进、远程遥控，一套账号打通。
          </p>
          <ul className="mt-10">
            {FEATURES.map(({ icon: Icon, title, desc }) => (
              <li key={title} className={cn('mb-4 flex items-start gap-4 last:mb-0', featureCard)}>
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-500/15">
                  <Icon className="h-[18px] w-[18px] text-blue-600 dark:text-blue-400" strokeWidth={1.75} />
                </span>
                <div className="min-w-0 pt-0.5">
                  <p className="text-sm font-semibold text-gray-800 dark:text-foreground">{title}</p>
                  <p className="mt-1 text-xs leading-relaxed text-gray-500 dark:text-muted-foreground">{desc}</p>
                </div>
              </li>
            ))}
          </ul>
          <DesktopClientDownload variant="login" className="max-w-sm" />
        </div>
        <p className="relative px-10 pb-8 text-right text-xs text-gray-400 xl:px-14">
          © learnbuddy · 作者：甘智斌
        </p>
      </aside>

      <main
        className={cn(
          'relative z-10 flex min-h-full flex-1 flex-col items-center justify-center',
          authPanel,
          'px-8 py-10 sm:px-12',
        )}
      >
        <div className="mb-8 flex w-full flex-col gap-4 lg:hidden">
          <div className="flex items-center gap-3">
            <span className={cn(brandChip, 'p-2')}>
              <BrandMark className="h-9 w-9 object-contain" />
            </span>
            <div>
              <p className="text-sm font-semibold">邮箱登录 · 注册</p>
              <p className="text-xs text-muted-foreground">登录后网页与桌面互通</p>
            </div>
          </div>
          <DesktopClientDownload variant="login" />
        </div>

        <div className="w-full max-w-[420px]">
          <p className="text-center text-[11px] font-semibold uppercase tracking-[0.2em] text-gray-400">
            {formEyebrow}
          </p>
          <h2 className="mt-3 text-center text-3xl font-bold tracking-tight text-[#222222] dark:text-foreground">
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

          <p className="mb-8 mt-6 text-center text-sm font-normal leading-relaxed text-gray-500 dark:text-muted-foreground">
            {mode === 'login'
              ? '登录后即可在网页继续对话；若桌面已开启「远程控制」，两侧会实时同步。'
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
              <AuthFeedback
                error={error}
                hint={null}
                onGoRegister={goToRegister}
                onGoLogin={goToLogin}
              />
              <Button
                type="submit"
                className={cn('w-full', authPrimaryBtn)}
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
              <SwitchModeButton
                label="还没有账号？"
                actionLabel="去注册"
                onClick={goToRegister}
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
                <label htmlFor="register-password-confirm" className="text-sm font-medium text-gray-700 dark:text-foreground">
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
              <SwitchModeButton
                label="已有账号？"
                actionLabel="去登录"
                onClick={goToLogin}
              />
            </form>
          ) : (
            <form className="space-y-5" onSubmit={(e) => void onVerifySubmit(e)}>
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

          <p className="mt-10 text-center text-xs leading-relaxed text-gray-400">
            继续即表示您同意 learnbuddy 的服务条款与隐私政策。
          </p>
          <p className="mt-2 text-center text-xs text-gray-400 lg:hidden">
            © learnbuddy · 作者：甘智斌
          </p>
        </div>
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
      <label htmlFor={id} className="text-sm font-medium text-gray-700 dark:text-foreground">
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
      <label htmlFor={id} className="text-sm font-medium text-gray-700 dark:text-foreground">
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
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-gray-400 transition-all duration-150 hover:scale-110 hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-500/15 dark:hover:text-blue-400"
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
        <p className="rounded-lg border border-blue-200 bg-blue-50 px-3.5 py-2.5 text-xs leading-relaxed text-gray-600 dark:border-blue-500/25 dark:bg-blue-500/10 dark:text-muted-foreground">
          {hint}
        </p>
      ) : null}
      {error ? (
        <div
          role="alert"
          className={cn(
            'rounded-lg border px-3.5 py-2.5',
            guidance
              ? 'border-blue-200 bg-blue-50 dark:border-blue-500/25 dark:bg-blue-500/10'
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
    <div className="space-y-2 pt-2">
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
        'mt-8 flex rounded-lg border border-gray-200 bg-gray-100 p-1',
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
            'flex-1 rounded-md py-2.5 text-sm font-medium transition-all duration-200',
            mode === m
              ? 'bg-white text-blue-600 shadow-sm dark:bg-white/15 dark:text-blue-400'
              : 'text-gray-500 hover:text-gray-700 dark:text-muted-foreground dark:hover:text-foreground',
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
      <div className="absolute inset-0 bg-gray-100 dark:bg-gradient-to-br dark:from-neutral-950 dark:via-slate-900 dark:to-indigo-950/40" />
      <div className="absolute -left-24 top-1/4 h-72 w-72 rounded-full bg-blue-100/50 blur-3xl dark:bg-blue-500/20" />
      <div className="absolute right-0 top-0 h-96 w-96 rounded-full bg-blue-100/45 blur-3xl dark:bg-indigo-600/15" />
      <div className="absolute bottom-0 left-1/3 h-80 w-80 rounded-full bg-violet-100/40 blur-3xl dark:bg-violet-600/10" />
    </div>
  )
}

const leftPanel = cn(
  'border-r border-gray-200/80 bg-gray-100/95',
  'dark:border-white/10 dark:bg-neutral-900/45',
)

const authPanel = cn(
  'bg-white shadow-[0_4px_20px_rgba(0,0,0,0.03)]',
  'dark:bg-neutral-900/60 dark:shadow-none',
)

const brandChip = cn(
  'rounded-xl border border-gray-200/80 bg-white',
  'dark:border-white/10 dark:bg-white/5',
)

const featureCard = cn(
  'rounded-xl border border-gray-200/80 bg-white p-5',
  'dark:border-white/10 dark:bg-white/5',
)

const authInput = cn(
  'flex h-11 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700',
  'placeholder:text-gray-400 transition-all duration-150',
  'focus-visible:outline-none focus-visible:border-blue-600 focus-visible:ring-2 focus-visible:ring-blue-600/20',
  'dark:border-white/15 dark:bg-white/5 dark:text-foreground dark:placeholder:text-muted-foreground/60',
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
              digit && 'border-blue-500 bg-blue-50/50 text-foreground dark:bg-blue-500/10',
            )}
          />
        ))}
      </div>
    </fieldset>
  )
}

const otpCell = cn(
  'h-12 w-10 rounded-lg text-center text-lg font-semibold tabular-nums sm:h-14 sm:w-12 sm:text-xl',
  'border border-gray-300 bg-white dark:border-white/15 dark:bg-white/5',
  'transition-colors duration-150',
  'focus-visible:outline-none focus-visible:border-blue-600 focus-visible:ring-2 focus-visible:ring-blue-600/20',
  'disabled:cursor-not-allowed disabled:opacity-50',
)
