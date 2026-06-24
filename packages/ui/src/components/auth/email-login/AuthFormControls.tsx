import { cn } from '@/lib/utils'
import { authBody } from './styles'
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
        <p className={cn('px-1 py-2 text-xs leading-relaxed', authBody)}>
          {hint}
        </p>
      ) : null}
      {error ? (
        <div
          role="alert"
          className="px-1 py-2"
        >
          <p
            className={cn(
              'text-xs leading-relaxed',
              guidance ? 'text-[#0F766E] dark:text-teal-300' : 'text-red-600 dark:text-destructive',
            )}
          >
            {error}
            {action === 'go_register' && onGoRegister ? (
              <span>
                ，<button
                  type="button"
                  onClick={onGoRegister}
                  className="underline underline-offset-2 font-medium hover:text-[#0EA5E9] dark:hover:text-sky-400"
                >
                  去注册
                </button>
              </span>
            ) : null}
            {action === 'go_login' && onGoLogin ? (
              <span>
                ，<button
                  type="button"
                  onClick={onGoLogin}
                  className="underline underline-offset-2 font-medium hover:text-[#0EA5E9] dark:hover:text-sky-400"
                >
                  去登录
                </button>
              </span>
            ) : null}
          </p>
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
    <p className="pt-1 text-center text-xs text-[#94A3B8] dark:text-muted-foreground">
      {label}{' '}
      <button
        type="button"
        onClick={onClick}
        className="font-medium text-[#0EA5E9] hover:text-[#0284C7] hover:underline underline-offset-2 transition-colors dark:text-sky-400 dark:hover:text-sky-300"
      >
        {actionLabel}
      </button>
    </p>
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
      className="mt-5 flex border-b border-[#E2E8F0] dark:border-white/10"
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
            'flex-1 py-2.5 text-sm font-medium transition-all duration-200',
            'border-b-2 -mb-[1px]',
            mode === m
              ? 'border-b-[#0EA5E9] text-[#0EA5E9] dark:border-b-sky-400 dark:text-sky-400'
              : 'border-b-transparent text-[#94A3B8] hover:text-[#64748B] dark:text-muted-foreground dark:hover:text-slate-300',
          )}
        >
          {m === 'login' ? '登录' : '注册'}
        </button>
      ))}
    </div>
  )
}
