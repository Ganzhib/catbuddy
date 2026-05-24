import App from '@catbuddy/ui'
import { useEffect } from 'react'
import { applyWebShellTheme } from './landing-theme'
import { LandingPage } from './landing/LandingPage'
import { isAppRoute, usePathname } from './usePathname'

export function WebRoot() {
  const pathname = usePathname()
  const showApp = isAppRoute(pathname)

  useEffect(() => {
    document.documentElement.classList.toggle('catbuddy-web-landing', !showApp)
    applyWebShellTheme(showApp)
    return () => document.documentElement.classList.remove('catbuddy-web-landing')
  }, [showApp])

  if (showApp) {
    return <App />
  }

  return (
    <div className="h-dvh max-h-dvh w-full overflow-hidden">
      <LandingPage />
    </div>
  )
}
