import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { AuthFeedback, ModeTabs, SwitchModeButton } from './AuthFormControls'
import { EmailField, OtpInput, PasswordField } from './AuthFormFields'
import { authInput, authOutlineBtn, authPanel, authPrimaryBtn, loginGlassCard } from './styles'
import type { EmailAuthState } from './useEmailAuth'

export function EmailAuthPanel({ auth }: { auth: EmailAuthState }) {
  const {
    mode,
    registerStep,
    email,
    setEmail,
    password,
    setPassword,
    confirmPassword,
    setConfirmPassword,
    code,
    setCode,
    showPassword,
    setShowPassword,
    busy,
    error,
    hint,
    canSubmitLogin,
    canSubmitRegisterForm,
    canSubmitVerify,
    onLoginSubmit,
    onRegisterFormSubmit,
    onVerifySubmit,
    resendCode,
    goToRegister,
    goToLogin,
    onModeChange,
    backToRegisterForm,
    formEyebrow,
    formTitle,
    formDescription,
  } = auth

  return (
    <main
      className={cn(
        'relative z-10 flex w-full flex-1 flex-col items-center justify-start lg:h-full lg:min-h-0 lg:justify-center lg:overflow-hidden',
        authPanel,
        'px-3 py-4 sm:px-4 sm:py-5 md:px-6 md:py-6',
      )}
    >
      <div className={loginGlassCard}>
        <p className="text-center text-[11px] font-semibold uppercase tracking-[0.2em] text-[#0EA5E9]">
          {formEyebrow}
        </p>
        <h2 className="mt-2 text-center text-xl font-bold tracking-tight text-[#1E3A8A] sm:text-2xl dark:text-foreground">
          {formTitle}
        </h2>

        {mode === 'register' && registerStep === 'verify' ? null : (
          <ModeTabs mode={mode} onChange={onModeChange} />
        )}

        <p className="mb-5 mt-4 text-center text-xs leading-relaxed text-[#1E3A8A]/60 dark:text-muted-foreground">
          {mode === 'register' && registerStep === 'verify' ? (
            <>
              我们已向{' '}
              <span className="font-medium text-foreground">{email.trim()}</span>
              {' '}发送验证码，请输入邮件中的 6 位数字完成注册。
            </>
          ) : (
            formDescription
          )}
        </p>

        {mode === 'login' ? (
          <LoginForm
            email={email}
            setEmail={setEmail}
            password={password}
            setPassword={setPassword}
            showPassword={showPassword}
            setShowPassword={setShowPassword}
            busy={busy}
            error={error}
            canSubmit={canSubmitLogin}
            onSubmit={onLoginSubmit}
            onGoRegister={goToRegister}
            onGoLogin={goToLogin}
          />
        ) : registerStep === 'form' ? (
          <RegisterForm
            email={email}
            setEmail={setEmail}
            password={password}
            setPassword={setPassword}
            confirmPassword={confirmPassword}
            setConfirmPassword={setConfirmPassword}
            showPassword={showPassword}
            setShowPassword={setShowPassword}
            busy={busy}
            error={error}
            canSubmit={canSubmitRegisterForm}
            onSubmit={onRegisterFormSubmit}
            onGoRegister={goToRegister}
            onGoLogin={goToLogin}
          />
        ) : (
          <VerifyForm
            code={code}
            setCode={setCode}
            busy={busy}
            error={error}
            hint={hint}
            canSubmit={canSubmitVerify}
            onSubmit={onVerifySubmit}
            onResend={() => void resendCode()}
            onBack={backToRegisterForm}
            onGoRegister={goToRegister}
            onGoLogin={goToLogin}
          />
        )}

        <p className="mt-5 text-center text-[10px] leading-relaxed text-[#1E3A8A]/45">
          继续即表示您同意 learnbuddy 的服务条款与隐私政策。
        </p>
      </div>
      <p className="mt-1 text-center text-[10px] text-[#1E3A8A]/45 lg:hidden">
          © learnbuddy · 作者：甘智斌
      </p>
    </main>
  )
}

function LoginForm({
  email,
  setEmail,
  password,
  setPassword,
  showPassword,
  setShowPassword,
  busy,
  error,
  canSubmit,
  onSubmit,
  onGoRegister,
  onGoLogin,
}: {
  email: string
  setEmail: (v: string) => void
  password: string
  setPassword: (v: string) => void
  showPassword: boolean
  setShowPassword: (fn: (v: boolean) => boolean) => void
  busy: boolean
  error: string | null
  canSubmit: boolean
  onSubmit: (e: React.FormEvent) => Promise<void>
  onGoRegister: () => void
  onGoLogin: () => void
}) {
  return (
    <form className="space-y-3.5" onSubmit={(e) => void onSubmit(e)}>
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
      <AuthFeedback error={error} hint={null} onGoRegister={onGoRegister} onGoLogin={onGoLogin} />
      <Button
        type="submit"
        className={cn('w-full', authPrimaryBtn)}
        size="default"
        disabled={busy || !canSubmit}
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
      <SwitchModeButton label="还没有账号？" actionLabel="去注册" onClick={onGoRegister} />
    </form>
  )
}

function RegisterForm({
  email,
  setEmail,
  password,
  setPassword,
  confirmPassword,
  setConfirmPassword,
  showPassword,
  setShowPassword,
  busy,
  error,
  canSubmit,
  onSubmit,
  onGoRegister,
  onGoLogin,
}: {
  email: string
  setEmail: (v: string) => void
  password: string
  setPassword: (v: string) => void
  confirmPassword: string
  setConfirmPassword: (v: string) => void
  showPassword: boolean
  setShowPassword: (fn: (v: boolean) => boolean) => void
  busy: boolean
  error: string | null
  canSubmit: boolean
  onSubmit: (e: React.FormEvent) => Promise<void>
  onGoRegister: () => void
  onGoLogin: () => void
}) {
  return (
    <form className="space-y-3.5" onSubmit={(e) => void onSubmit(e)}>
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
        <label htmlFor="register-password-confirm" className="text-[13px] font-medium text-[#1E3A8A] sm:text-sm dark:text-foreground">
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
      <AuthFeedback error={error} hint={null} onGoRegister={onGoRegister} onGoLogin={onGoLogin} />
      <Button
        type="submit"
        className={cn('w-full', authPrimaryBtn)}
        size="default"
        disabled={busy || !canSubmit}
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
      <SwitchModeButton label="已有账号？" actionLabel="去登录" onClick={onGoLogin} />
    </form>
  )
}

function VerifyForm({
  code,
  setCode,
  busy,
  error,
  hint,
  canSubmit,
  onSubmit,
  onResend,
  onBack,
  onGoRegister,
  onGoLogin,
}: {
  code: string
  setCode: (v: string) => void
  busy: boolean
  error: string | null
  hint: string | null
  canSubmit: boolean
  onSubmit: (e: React.FormEvent) => Promise<void>
  onResend: () => void
  onBack: () => void
  onGoRegister: () => void
  onGoLogin: () => void
}) {
  return (
    <form className="space-y-3.5" onSubmit={(e) => void onSubmit(e)}>
      <OtpInput value={code} onChange={setCode} disabled={busy} />
      <AuthFeedback error={error} hint={hint} onGoRegister={onGoRegister} onGoLogin={onGoLogin} />
      <Button
        type="submit"
        className={cn('w-full', authPrimaryBtn)}
        size="default"
        disabled={busy || !canSubmit}
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
          onClick={onResend}
        >
          重新发送验证码
        </Button>
        <Button
          type="button"
          variant="outline"
          className={cn('w-full', authOutlineBtn)}
          disabled={busy}
          onClick={onBack}
        >
          修改邮箱或密码
        </Button>
      </div>
    </form>
  )
}
