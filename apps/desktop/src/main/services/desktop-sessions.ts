import type { SessionDetail, SessionInfo, WorkspaceFolder } from "@catbuddy/shared";
import { SessionManager } from "../session/session-manager.js";

function managerForWorkspace(workspace: string): SessionManager {
  return new SessionManager(workspace);
}

function withKnownWorkspaceFolder(
  info: SessionInfo,
  folders: WorkspaceFolder[],
): SessionInfo {
  const folderId = info.metadata?.workspaceFolderId;
  if (typeof folderId !== "string") return info;
  if (!folders.some((folder) => folder.id === folderId)) return info;
  return info;
}

export function listAllDesktopSessions(
  homeWorkspace: string,
  folders: WorkspaceFolder[],
): SessionInfo[] {
  return managerForWorkspace(homeWorkspace)
    .list()
    .map((info) => withKnownWorkspaceFolder(info, folders))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function getDesktopSessionDetail(
  homeWorkspace: string,
  folders: WorkspaceFolder[],
  key: string,
): SessionDetail | null {
  const detail = managerForWorkspace(homeWorkspace).getDetail(key);
  return detail ? (withKnownWorkspaceFolder(detail, folders) as SessionDetail) : null;
}

export function deleteDesktopSession(
  homeWorkspace: string,
  _folders: WorkspaceFolder[],
  key: string,
): boolean {
  return managerForWorkspace(homeWorkspace).delete(key);
}
