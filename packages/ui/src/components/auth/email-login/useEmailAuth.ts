import { useState } from 'react'
import {
  loginWithPassword,
  requestEmailCode,
  requestRegister,
  resolveGatewayHttpBase,
  syncDesktopGatewayAccountEmail,
  verifyRegister,
} from '@catbuddy/platform'
import type { AuthMode, RegisterStep } from './types'
import { otpHint } from './utils'

export function useEmailAuth(onSuccess: () => void) {
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

  const canSubmitLogin = email.includes('@') && password.length >= 8

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

  const onModeChange = (m: AuthMode) => {
    setMode(m)
    setError(null)
    setHint(null)
    resetRegister()
  }

  const backToRegisterForm = () => {
    setError(null)
    setHint(null)
    setRegisterStep('form')
    setCode('')
  }

  // const formEyebrow =
  //   mode === 'login'
  //     ? '欢迎回来'
  //     : registerStep === 'verify'
  //       ? '邮箱验证'
  //       : '创建账号'

  const formTitle =
    mode === 'login'
      ? '登录'
      : registerStep === 'verify'
        ? '验证邮箱'
        : '注册'

  // const formDescription =
  //   mode === 'login'
  //     ? '登录后网页与桌面实时同步。'
  //     : registerStep === 'verify'
  //       ? null
  //       : '填写邮箱并设置密码（至少 8 位），我们将向邮箱发送验证码。'

  return {
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
    // formEyebrow,
    formTitle,
    // formDescription,
  }
}

export type EmailAuthState = ReturnType<typeof useEmailAuth>
