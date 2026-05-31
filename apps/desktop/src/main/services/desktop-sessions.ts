import type { SessionDetail, SessionInfo, WorkspaceFolder } from "@catbuddy/shared";
import { SessionManager } from "../session/session-manager.js";

const managerCache = new Map<string, SessionManager>();

function managerForWorkspace(workspace: string): SessionManager {
  let mgr = managerCache.get(workspace);
  if (!mgr) {
    mgr = new SessionManager(workspace);
    managerCache.set(workspace, mgr);
  }
  return mgr;
}

function managerForFolder(folder: WorkspaceFolder): SessionManager {
  return managerForWorkspace(folder.dataDir);
}

function folderById(folders: WorkspaceFolder[], id: string): WorkspaceFolder | undefined {
  return folders.find((f) => f.id === id);
}

function enrichWithFolderId(info: SessionInfo, folder: WorkspaceFolder): SessionInfo {
  return {
    ...info,
    metadata: {
      ...info.metadata,
      workspaceFolderId: folder.id,
      workspaceFolderName: folder.name,
    },
  };
}

export function listAllDesktopSessions(
  homeWorkspace: string,
  folders: WorkspaceFolder[],
): SessionInfo[] {
  const homeSessions = managerForWorkspace(homeWorkspace)
    .list()
    .filter((info) => !info.metadata?.workspaceFolderId);

  const projectSessions: SessionInfo[] = [];
  for (const folder of folders) {
    const mgr = managerForFolder(folder);
    for (const info of mgr.list()) {
      projectSessions.push(enrichWithFolderId(info, folder));
    }
  }

  return [...homeSessions, ...projectSessions].sort((a, b) =>
    b.updatedAt.localeCompare(a.updatedAt),
  );
}

export function getDesktopSessionDetail(
  homeWorkspace: string,
  folders: WorkspaceFolder[],
  key: string,
  workspaceFolderId?: string | null,
): SessionDetail | null {
  if (workspaceFolderId) {
    const folder = folderById(folders, workspaceFolderId);
    if (folder) {
      const detail = managerForFolder(folder).getDetail(key);
      return detail ? (enrichWithFolderId(detail, folder) as SessionDetail) : null;
    }
  }
  const detail = managerForWorkspace(homeWorkspace).getDetail(key);
  if (detail) return detail;
  for (const folder of folders) {
    const projectDetail = managerForFolder(folder).getDetail(key);
    if (projectDetail) return enrichWithFolderId(projectDetail, folder) as SessionDetail;
  }
  return null;
}

export function deleteDesktopSession(
  homeWorkspace: string,
  folders: WorkspaceFolder[],
  key: string,
  workspaceFolderId?: string | null,
): boolean {
  if (workspaceFolderId) {
    const folder = folderById(folders, workspaceFolderId);
    if (folder) {
      return managerForFolder(folder).delete(key);
    }
  }
  if (managerForWorkspace(homeWorkspace).delete(key)) return true;
  for (const folder of folders) {
    if (managerForFolder(folder).delete(key)) return true;
  }
  return false;
}

export function getSessionManager(
  homeWorkspace: string,
  folders: WorkspaceFolder[],
  workspaceFolderId?: string | null,
): SessionManager {
  if (workspaceFolderId) {
    const folder = folderById(folders, workspaceFolderId);
    if (folder) {
      return managerForFolder(folder);
    }
  }
  return managerForWorkspace(homeWorkspace);
}
