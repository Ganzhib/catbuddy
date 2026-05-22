import { useState } from 'react'
import { Eye, EyeOff, Loader2, Mail, ShieldCheck, Sparkles } from 'lucide-react'
import { BrandMark } from '@/components/BrandMark'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  loginWithPassword,
  registerWithPassword,
  resolveGatewayHttpBase,
} from '@learnbuddy/platform'

type AuthMode = 'login' | 'register'

const FEATURES = [
  {
    icon: ShieldCheck,
    title: '安全省心',
    desc: '邮箱与密码登录，账号信息安全保存。',
  },
  {
    icon: Mail,
    title: '登录 · 注册',
    desc: '已有账号用密码登录；新用户注册时需设置密码。',
  },
  {
    icon: Sparkles,
    title: '多端同步',
    desc: '网页与桌面应用共用账号，学习对话与进度无缝衔接。',
  },
] as const

export function EmailLoginScreen({ onSuccess }: { onSuccess: () => void }) {
  const [mode, setMode] = useState<AuthMode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const base = resolveGatewayHttpBase()

  const canSubmit =
    email.includes('@')
    && password.length >= 8
    && (mode === 'login' || password === confirmPassword)

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (mode === 'register' && password !== confirmPassword) {
      setError('两次输入的密码不一致')
      return
    }
    setBusy(true)
    try {
      if (mode === 'login') {
        await loginWithPassword(email.trim(), password, base)
      } else {
        await registerWithPassword(email.trim(), password, base)
      }
      onSuccess()
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
            {mode === 'login' ? '登录' : '注册'}
          </h2>

          <ModeTabs
            mode={mode}
            onChange={(m) => {
              setMode(m)
              setError(null)
            }}
          />

          <p className="mb-5 mt-5 text-sm text-muted-foreground">
            {mode === 'login'
              ? '使用已注册邮箱与密码登录。未注册或密码错误将提示具体原因。'
              : '填写邮箱并设置密码（至少 8 位），注册成功后自动进入应用。'}
          </p>

          <form className="space-y-4" onSubmit={(e) => void onSubmit(e)}>
            <div className="space-y-2">
              <label htmlFor="login-email" className="text-sm font-medium">
                邮箱地址
              </label>
              <input
                id="login-email"
                type="email"
                autoComplete="email"
                placeholder="you@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={glassInput}
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="login-password" className="text-sm font-medium">
                密码
              </label>
              <div className="relative">
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  placeholder={mode === 'register' ? '至少 8 位' : '请输入密码'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={cn(glassInput, 'pr-10')}
                />
                <button
                  type="button"
                  tabIndex={-1}
                  aria-label={showPassword ? '隐藏密码' : '显示密码'}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-muted-foreground hover:bg-black/5 dark:hover:bg-white/10"
                  onClick={() => setShowPassword((v) => !v)}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {mode === 'register' ? (
              <div className="space-y-2">
                <label htmlFor="login-password-confirm" className="text-sm font-medium">
                  确认密码
                </label>
                <input
                  id="login-password-confirm"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  placeholder="再次输入密码"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className={glassInput}
                />
              </div>
            ) : null}

            {error ? (
              <p
                role="alert"
                className="rounded-xl border border-destructive/25 bg-destructive/10 px-3 py-2.5 text-xs text-destructive backdrop-blur-sm"
              >
                {error}
              </p>
            ) : null}

            <Button type="submit" className="w-full shadow-md" size="lg" disabled={busy || !canSubmit}>
              {busy ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {mode === 'login' ? '登录中…' : '注册中…'}
                </>
              ) : (
                mode === 'login' ? '登录' : '注册'
              )}
            </Button>

            {mode === 'login' ? (
              <p className="text-center text-xs text-muted-foreground">
                还没有账号？
                <button
                  type="button"
                  className="ml-1 font-medium text-foreground underline-offset-2 hover:underline"
                  onClick={() => {
                    setMode('register')
                    setError(null)
                  }}
                >
                  去注册
                </button>
              </p>
            ) : (
              <p className="text-center text-xs text-muted-foreground">
                已有账号？
                <button
                  type="button"
                  className="ml-1 font-medium text-foreground underline-offset-2 hover:underline"
                  onClick={() => {
                    setMode('login')
                    setError(null)
                    setConfirmPassword('')
                  }}
                >
                  去登录
                </button>
              </p>
            )}
          </form>
        </div>

        <p className="mt-6 max-w-[420px] text-center text-[11px] leading-relaxed text-muted-foreground/90">
          继续即表示您同意 learnbuddy 的服务条款与隐私政策。
        </p>
      </main>
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
              ? 'bg-white/90 text-foreground shadow-sm dark:bg-white/15'
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
      <div className="absolute inset-0 bg-gradient-to-br from-slate-100 via-blue-50/80 to-indigo-100/60 dark:from-neutral-950 dark:via-slate-900 dark:to-indigo-950/40" />
      <div className="absolute -left-24 top-1/4 h-72 w-72 rounded-full bg-sky-300/40 blur-3xl dark:bg-sky-500/20" />
      <div className="absolute right-0 top-0 h-96 w-96 rounded-full bg-violet-300/35 blur-3xl dark:bg-violet-600/15" />
      <div className="absolute bottom-0 left-1/3 h-80 w-80 rounded-full bg-amber-200/30 blur-3xl dark:bg-amber-500/10" />
    </div>
  )
}

const glassPanel = cn(
  'border border-white/60 dark:border-white/[0.12]',
  'bg-white/55 dark:bg-neutral-900/45',
  'backdrop-blur-2xl backdrop-saturate-150',
  'shadow-[0_8px_40px_rgba(15,23,42,0.08)]',
  'rounded-2xl',
)

const glassChip = cn(
  'border border-white/50 dark:border-white/10',
  'bg-white/40 dark:bg-white/5',
  'backdrop-blur-xl',
)

const glassInput = cn(
  'flex h-11 w-full rounded-xl px-3 py-2 text-sm transition-all',
  'border border-white/70 bg-white/50 dark:border-white/15 dark:bg-white/5',
  'backdrop-blur-md placeholder:text-muted-foreground/70',
  'shadow-inner shadow-black/[0.03]',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent',
)
