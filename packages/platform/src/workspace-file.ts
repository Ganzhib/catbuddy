import { hasCatbuddyIpc } from './create-platform'

export async function openWorkspaceFile(
  path: string,
  absolutePath?: string,
): Promise<{ ok: boolean; path?: string; error?: string }> {
  if (!hasCatbuddyIpc() || !window.catbuddy?.openWorkspaceFile) {
    return { ok: false, error: 'not_desktop' }
  }
  return window.catbuddy.openWorkspaceFile(path, absolutePath)
}
