const STORAGE_KEY = 'catbuddy-webui.theme'

export function isAppPathname(pathname: string): boolean {
  return pathname === '/app' || pathname.startsWith('/app/')
}

/** Landing 固定暗色；/app 读取用户偏好，无记录时默认浅色。 */
export function applyWebShellTheme(showApp: boolean): void {
  const root = document.documentElement
  if (!showApp) {
    root.classList.add('dark')
    return
  }
  try {
    let stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) {
      localStorage.setItem(STORAGE_KEY, 'light')
      stored = 'light'
    }
    root.classList.toggle('dark', stored === 'dark')
  } catch {
    root.classList.remove('dark')
  }
}
