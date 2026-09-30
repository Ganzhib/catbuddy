export type DesktopDownloadTarget = 'windows' | 'macArm64' | 'macX64'

export const GITHUB_RELEASE_BASE_URL = 'https://github.com/Ganzhib/catbuddy/releases/latest/download'

export const DESKTOP_RELEASE_ASSETS: Record<DesktopDownloadTarget, string> = {
  windows: 'catbuddy-windows-x64.exe',
  macArm64: 'catbuddy-macos-arm64.dmg',
  macX64: 'catbuddy-macos-x64.dmg',
}

/** Legacy aliases kept for callers that still expect the Windows constants. */
export const DESKTOP_INSTALLER_FILENAME = DESKTOP_RELEASE_ASSETS.windows
export const DESKTOP_DOWNLOAD_ARCHIVE_FILENAME = DESKTOP_RELEASE_ASSETS.windows
export const DESKTOP_DOWNLOAD_PATH = `${GITHUB_RELEASE_BASE_URL}/${DESKTOP_RELEASE_ASSETS.windows}`

export function getDesktopReleaseDownloadUrl(target: DesktopDownloadTarget): string {
  return `${GITHUB_RELEASE_BASE_URL}/${DESKTOP_RELEASE_ASSETS[target]}`
}
