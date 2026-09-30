import {
  getDesktopReleaseDownloadUrl,
  type DesktopDownloadTarget,
} from '@catbuddy/shared/desktop-download'

import { hasCatbuddyIpc } from './create-platform'
import { useCatbuddyGateway } from './gateway-http'

function defaultDesktopDownloadTarget(): DesktopDownloadTarget {
  if (typeof navigator !== 'undefined' && /Mac/i.test(navigator.userAgent)) return 'macArm64'
  return 'windows'
}

/** Full URL for a desktop installer. Legacy VITE_DESKTOP_DOWNLOAD_URL overrides Windows. */
export function resolveDesktopDownloadUrl(target = defaultDesktopDownloadTarget()): string {
  const overrides: Partial<Record<DesktopDownloadTarget, string | undefined>> = {
    windows: import.meta.env.VITE_DESKTOP_DOWNLOAD_URL_WINDOWS?.trim()
      || import.meta.env.VITE_DESKTOP_DOWNLOAD_URL?.trim(),
    macArm64: import.meta.env.VITE_DESKTOP_DOWNLOAD_URL_MAC_ARM64?.trim(),
    macX64: import.meta.env.VITE_DESKTOP_DOWNLOAD_URL_MAC_X64?.trim(),
  }
  const path = overrides[target] || getDesktopReleaseDownloadUrl(target)
  if (/^https?:\/\//i.test(path)) return path
  if (typeof window !== 'undefined') {
    const normalized = path.startsWith('/') ? path : `/${path}`
    return new URL(normalized, window.location.origin).href
  }
  return path.startsWith('/') ? path : `/${path}`
}

/** True in browser Web UI (not Electron desktop). */
export function shouldOfferDesktopDownload(): boolean {
  return useCatbuddyGateway() && !hasCatbuddyIpc()
}
