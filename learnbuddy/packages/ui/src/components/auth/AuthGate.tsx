import { useCallback, useEffect, useState, type ReactNode } from 'react'
import {
  BootstrapErrorScreen,
  BootstrapLoadingScreen,
} from '@/components/auth/BootstrapFallbackScreen'
import { EmailLoginScreen } from '@/components/EmailLoginScreen'
import {
  BootstrapAuthRequired,
  clearAuthToken,
  clearSavedSecret,
  fetchBootstrap,
  hasAuthToken,
  loadAuthToken,
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
      if (hasLearnbuddyIpc()) {
        await syncDesktopGatewayAccountEmail()
      }
      const storedJwt = loadAuthToken().trim()
      const gatewayToken = useGateway && storedJwt ? storedJwt : boot.token
      const client = createLearnbuddyClient({
        token: gatewayToken,
        wsPath: boot.ws_path,
        transportMode: useGateway ? 'gateway' : undefined,
        gatewayHttpBase: useGateway ? resolveGatewayHttpBase() : undefined,
      })
      client.connect()
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
    if (bootError) {
      return (
        <BootstrapErrorScreen
          error={bootError}
          onRetry={() => setBootAttempts((n) => n + 1)}
        />
      )
    }
    return <BootstrapLoadingScreen />
  }

  return (
    <>
      {children({ ...session, onLogout: handleLogout })}
    </>
  )
}
