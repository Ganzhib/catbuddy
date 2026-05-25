import type { WorkspaceFolder } from "@catbuddy/shared";
import { hasCatbuddyIpc } from "./create-platform";

export interface WorkspaceFolderStore {
  activeFolderId: string | null;
  folders: WorkspaceFolder[];
}

export interface WorkspaceImportResult {
  ok: boolean;
  cancelled?: boolean;
  folder?: WorkspaceFolder;
  created?: boolean;
  activeFolderId?: string | null;
  folders?: WorkspaceFolder[];
  error?: string;
}

export async function fetchWorkspaceFolders(): Promise<WorkspaceFolderStore | null> {
  if (!hasCatbuddyIpc() || !window.catbuddy?.listWorkspaceFolders) return null;
  return window.catbuddy.listWorkspaceFolders();
}

export async function setActiveWorkspaceFolder(
  folderId: string | null,
): Promise<WorkspaceFolderStore | null> {
  if (!hasCatbuddyIpc() || !window.catbuddy?.setActiveWorkspaceFolder) return null;
  return window.catbuddy.setActiveWorkspaceFolder(folderId);
}

export async function removeWorkspaceFolder(
  folderId: string,
): Promise<WorkspaceFolderStore | null> {
  if (!hasCatbuddyIpc() || !window.catbuddy?.removeWorkspaceFolder) return null;
  return window.catbuddy.removeWorkspaceFolder(folderId);
}

export async function importProjectFolder(): Promise<WorkspaceImportResult> {
  if (!hasCatbuddyIpc() || !window.catbuddy?.importProjectFolder) {
    return { ok: false, error: "desktop_only" };
  }
  return window.catbuddy.importProjectFolder();
}
