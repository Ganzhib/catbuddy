import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { AuthFeedback, ModeTabs, SwitchModeButton } from './AuthFormControls'
import { EmailField, OtpInput, PasswordField } from './AuthFormFields'
import {
  authHeading,
  authOutlineBtn,
  authPanel,
  authPrimaryBtn,
  authMuted,
  authSubtle,
  formCard,
} from './styles'
import type { EmailAuthState } from './useEmailAuth'

/** 表单内的逐项入场——每项依次淡入上移，切换登录/注册时重新播放 */
function Stagger({ index, children }: { index: number; children: React.ReactNode }) {
  return (
    <div className="auth-enter" style={{ animationDelay: `${60 + index * 70}ms` }}>
      {children}
    </div>
  )
}

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
    formTitle,
  } = auth

  return (
    <main
      className={cn(
        'relative z-10 flex w-full flex-1 flex-col items-center justify-start lg:w-1/2 lg:min-h-0 lg:justify-center lg:overflow-hidden',
        'backdrop-blur-md bg-white/40 dark:bg-[#0c1929]/60',
        'px-4 py-5 sm:px-6 sm:py-6 lg:px-16 lg:py-8 xl:px-20 xl:py-10',
        authPanel,
      )}
    >
      <div className="w-full max-w-[380px]">
        <div className={formCard}>
          <h2 className={cn('auth-enter text-center text-xl tracking-tight sm:text-2xl', authHeading)}>
            {formTitle}
          </h2>

          {mode === 'register' && registerStep === 'verify' ? null : (
            <div className="auth-enter" style={{ animationDelay: '70ms' }}>
              <ModeTabs mode={mode} onChange={onModeChange} />
            </div>
          )}

          {mode === 'register' && registerStep === 'verify' ? (
            <p className={cn('auth-pop mb-5 mt-3 text-center text-[11px] leading-relaxed sm:mb-6 sm:mt-4 sm:text-xs', authMuted)}>
              我们已向{' '}
              <span className="font-semibold text-[#0F172A] dark:text-foreground">{email.trim()}</span>
              {' '}发送验证码，请输入邮件中的 6 位数字完成注册。
            </p>
          ) : null}

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

          <p className={cn('auth-enter mt-4 text-center text-[10px] leading-relaxed sm:mt-5', authSubtle)} style={{ animationDelay: '320ms' }}>
            继续即表示您同意 catbuddy 的服务条款与隐私政策。
          </p>
        </div>

        <p className={cn('mt-2 text-center text-[10px] lg:hidden', authSubtle)}>
          © catbuddy · 作者：甘智斌
        </p>
      </div>
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
    <form className="space-y-4" onSubmit={(e) => void onSubmit(e)}>
      <Stagger index={0}>
        <EmailField id="login-email" value={email} onChange={setEmail} />
      </Stagger>
      <Stagger index={1}>
        <PasswordField
          id="login-password"
          label="密码"
          autoComplete="current-password"
          placeholder=""
          value={password}
          onChange={setPassword}
          showPassword={showPassword}
          onToggleShow={() => setShowPassword((v) => !v)}
        />
      </Stagger>
      <AuthFeedback error={error} hint={null} onGoRegister={onGoRegister} onGoLogin={onGoLogin} />
      <Stagger index={2}>
        <Button
          type="submit"
          className={cn('w-full h-11 text-[15px]', authPrimaryBtn)}
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
      </Stagger>
      <Stagger index={3}>
        <SwitchModeButton label="还没有账号？" actionLabel="去注册" onClick={onGoRegister} />
      </Stagger>
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
    <form className="space-y-4" onSubmit={(e) => void onSubmit(e)}>
      <Stagger index={0}>
        <EmailField id="register-email" value={email} onChange={setEmail} />
      </Stagger>
      <Stagger index={1}>
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
      </Stagger>
      <Stagger index={2}>
        <PasswordField
          id="register-password-confirm"
          label="确认密码"
          autoComplete="new-password"
          placeholder="再次输入密码"
          value={confirmPassword}
          onChange={setConfirmPassword}
          showPassword={showPassword}
          onToggleShow={() => setShowPassword((v) => !v)}
        />
      </Stagger>
      <AuthFeedback error={error} hint={null} onGoRegister={onGoRegister} onGoLogin={onGoLogin} />
      <Stagger index={3}>
        <Button
          type="submit"
          className={cn('w-full h-11 text-[15px]', authPrimaryBtn)}
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
      </Stagger>
      <Stagger index={4}>
        <SwitchModeButton label="已有账号？" actionLabel="去登录" onClick={onGoLogin} />
      </Stagger>
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
    <form className="space-y-4" onSubmit={(e) => void onSubmit(e)}>
      <Stagger index={0}>
        <OtpInput value={code} onChange={setCode} disabled={busy} />
      </Stagger>
      <AuthFeedback error={error} hint={hint} onGoRegister={onGoRegister} onGoLogin={onGoLogin} />
      <Stagger index={1}>
        <Button
          type="submit"
          className={cn('w-full h-11 text-[15px]', authPrimaryBtn)}
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
      </Stagger>
      <Stagger index={2}>
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
      </Stagger>
    </form>
  )
}
