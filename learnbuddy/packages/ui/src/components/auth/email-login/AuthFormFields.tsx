import { useCallback, useRef } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { cn } from '@/lib/utils'
import { authInput, otpCell } from './styles'

export function EmailField({
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

export function PasswordField({
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

const OTP_LENGTH = 6

export function OtpInput({
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
