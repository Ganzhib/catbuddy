import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { BrandMark } from '@/components/BrandMark'
import { EmailLoginScreen } from '@/components/EmailLoginScreen'
import {
  BootstrapAuthRequired,
  clearAuthToken,
  clearSavedSecret,
  fetchBootstrap,
  hasAuthToken,
  hasLearnbuddyIpc,
  requiresEmailLogin,
  resolveGatewayHttpBase,
  syncDesktopGatewayAccountEmail,
} from '@learnbuddy/platform'
import { createLearnbuddyClient, type learnbuddyClient } from '@learnbuddy/client'

export interface AuthGateSession {
  client: learnbuddyClient
  token: string
  modelName: string | null
  onLogout: () => void
}

type BootSession = Pick<AuthGateSession, 'client' | 'token' | 'modelName'>

export function AuthGate({
  children,
  onLogout,
}: {
  children: (session: AuthGateSession) => ReactNode
  onLogout?: () => void
}) {
  const [session, setSession] = useState<BootSession | null>(null)
  const [bootError, setBootError] = useState<string | null>(null)
  const [bootAttempts, setBootAttempts] = useState(0)
  const [needsLogin, setNeedsLogin] = useState(
    () => requiresEmailLogin() && !hasAuthToken(),
  )

  const doBootstrap = useCallback(async () => {
    setBootError(null)
    if (requiresEmailLogin() && !hasAuthToken()) {
      setNeedsLogin(true)
      setSession(null)
      return
    }
    setNeedsLogin(false)
    try {
      const boot = await fetchBootstrap(
        hasLearnbuddyIpc() ? undefined : resolveGatewayHttpBase(),
      )
      const useGateway =
        !hasLearnbuddyIpc()
        && boot.gateway_mode === 'gateway'
      const client = createLearnbuddyClient({
        token: boot.token,
        wsPath: boot.ws_path,
        transportMode: useGateway ? 'gateway' : undefined,
        gatewayHttpBase: useGateway ? resolveGatewayHttpBase() : undefined,
      })
      client.connect()
      if (hasLearnbuddyIpc()) {
        void syncDesktopGatewayAccountEmail()
      }
      setSession({
        client,
        token: boot.token,
        modelName: boot.model_name ?? null,
      })
      setBootError(null)
    } catch (err: unknown) {
      if (err instanceof BootstrapAuthRequired) {
        clearAuthToken()
        setNeedsLogin(true)
        setSession(null)
        return
      }
      let msg = err instanceof Error ? err.message : String(err)
      if (msg.includes('"not_found"') || msg.includes('not_found')) {
        msg += ' — 若使用 gateway 开发，请先停止旧进程后重新运行：pnpm gateway:dev'
      }
      console.error('Bootstrap failed:', msg)
      setBootError(msg)
      setSession(null)
    }
  }, [])

  useEffect(() => {
    void doBootstrap()
  }, [doBootstrap, bootAttempts])

  const handleLogout = useCallback(() => {
    session?.client.close()
    clearSavedSecret()
    clearAuthToken()
    setSession(null)
    setBootError(null)
    if (requiresEmailLogin()) {
      setNeedsLogin(true)
    } else {
      setBootAttempts((n) => n + 1)
    }
    onLogout?.()
  }, [session, onLogout])

  if (needsLogin) {
    return (
      <EmailLoginScreen onSuccess={() => setBootAttempts((n) => n + 1)} />
    )
  }

  if (!session) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        {bootError ? (
          <div className="flex flex-col items-center gap-4 max-w-sm text-center px-6">
            <p className="text-red-500 text-sm font-medium">Connection Failed</p>
            <p className="text-xs text-gray-400 break-all">{bootError}</p>
            <button
              type="button"
              onClick={() => setBootAttempts((n) => n + 1)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors"
            >
              Retry
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 text-sm text-muted-foreground">
            <BrandMark className="h-12 w-12 object-contain opacity-90" />
            <span>Loading learnbuddy…</span>
          </div>
        )}
      </div>
    )
  }

  return (
    <>
      {children({ ...session, onLogout: handleLogout })}
    </>
  )
}
