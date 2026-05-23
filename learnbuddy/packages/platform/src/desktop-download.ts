import { DESKTOP_DOWNLOAD_PATH } from '@learnbuddy/shared/desktop-download'

import { hasLearnbuddyIpc } from './create-platform'
import { useLearnbuddyGateway } from './gateway-http'

/** Full URL for the desktop installer (Web only). Override with VITE_DESKTOP_DOWNLOAD_URL. */
export function resolveDesktopDownloadUrl(): string {
  const custom = import.meta.env.VITE_DESKTOP_DOWNLOAD_URL?.trim()
  const path = custom || DESKTOP_DOWNLOAD_PATH
  if (/^https?:\/\//i.test(path)) return path
  if (typeof window !== 'undefined') {
    const normalized = path.startsWith('/') ? path : `/${path}`
    return new URL(normalized, window.location.origin).href
  }
  return path.startsWith('/') ? path : `/${path}`
}

/** True in browser Web UI (not Electron desktop). */
export function shouldOfferDesktopDownload(): boolean {
  return useLearnbuddyGateway() && !hasLearnbuddyIpc()
}
