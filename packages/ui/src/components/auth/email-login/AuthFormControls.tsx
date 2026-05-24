import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { authSecondaryBtn, authBody } from './styles'
import type { AuthMode } from './types'
import { resolveAuthErrorAction } from './utils'

export function AuthFeedback({
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
        <p className={cn('rounded-xl border border-white/50 bg-white/45 px-3.5 py-2.5 text-xs leading-relaxed backdrop-blur-sm dark:border-sky-500/25 dark:bg-sky-500/10', authBody)}>
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

export function SwitchModeButton({
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

export function ModeTabs({
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
