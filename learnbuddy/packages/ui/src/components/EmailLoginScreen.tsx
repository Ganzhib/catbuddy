import { useState } from 'react'
import { BrandMark } from '@/components/BrandMark'
import {
  requestEmailCode,
  resolveGatewayHttpBase,
  verifyEmailCode,
} from '@learnbuddy/platform'

type Step = 'email' | 'code'

export function EmailLoginScreen({ onSuccess }: { onSuccess: () => void }) {
  const [step, setStep] = useState<Step>('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hint, setHint] = useState<string | null>(null)

  const base = resolveGatewayHttpBase()

  const sendCode = async () => {
    setError(null)
    setHint(null)
    setBusy(true)
    try {
      const res = await requestEmailCode(email.trim(), base)
      setHint(`验证码已发送（${res.expiresIn}s 内有效）。开发环境请查看 gateway 控制台。`)
      setStep('code')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  const submitCode = async () => {
    setError(null)
    setBusy(true)
    try {
      await verifyEmailCode(email.trim(), code.trim(), base)
      onSuccess()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex h-full w-full items-center justify-center px-6">
      <div className="w-full max-w-sm space-y-5">
        <div className="flex flex-col items-center gap-2 text-center">
          <BrandMark className="h-12 w-12 object-contain opacity-90" />
          <h1 className="text-lg font-semibold">登录 learnbuddy</h1>
          <p className="text-xs text-muted-foreground">
            使用邮箱验证码连接 Gateway，远程控制已配对的桌面端。
          </p>
        </div>

        {step === 'email' ? (
          <div className="space-y-3">
            <input
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
            <button
              type="button"
              disabled={busy || !email.includes('@')}
              onClick={() => void sendCode()}
              className="w-full rounded-lg bg-blue-600 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {busy ? '发送中…' : '发送验证码'}
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground truncate">{email}</p>
            {hint ? <p className="text-xs text-green-600 dark:text-green-400">{hint}</p> : null}
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="6 位验证码"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm tracking-widest"
            />
            <button
              type="button"
              disabled={busy || code.length < 4}
              onClick={() => void submitCode()}
              className="w-full rounded-lg bg-blue-600 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {busy ? '验证中…' : '登录'}
            </button>
            <button
              type="button"
              className="w-full text-xs text-muted-foreground hover:underline"
              onClick={() => { setStep('email'); setCode('') }}
            >
              更换邮箱
            </button>
          </div>
        )}

        {error ? <p className="text-xs text-red-500 break-all">{error}</p> : null}
      </div>
    </div>
  )
}
