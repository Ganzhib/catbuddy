import { hasCatbuddyIpc } from './create-platform'

export interface WorkspaceFileResult {
  ok: boolean
  path?: string
  content?: string
  error?: string
}

export async function openWorkspaceFile(
  path: string,
  absolutePath?: string,
): Promise<{ ok: boolean; path?: string; error?: string }> {
  if (!hasCatbuddyIpc() || !window.catbuddy?.openWorkspaceFile) {
    return { ok: false, error: 'not_desktop' }
  }
  return window.catbuddy.openWorkspaceFile(path, absolutePath)
}

export async function readWorkspaceFile(
  path: string,
  absolutePath?: string,
): Promise<WorkspaceFileResult> {
  if (!hasCatbuddyIpc() || !window.catbuddy?.readWorkspaceFile) {
    return { ok: false, error: 'not_desktop' }
  }
  return window.catbuddy.readWorkspaceFile(path, absolutePath)
}

export async function writeWorkspaceFile(
  path: string,
  content: string,
  absolutePath?: string,
): Promise<WorkspaceFileResult> {
  if (!hasCatbuddyIpc() || !window.catbuddy?.writeWorkspaceFile) {
    return { ok: false, error: 'not_desktop' }
  }
  return window.catbuddy.writeWorkspaceFile(path, content, absolutePath)
}

