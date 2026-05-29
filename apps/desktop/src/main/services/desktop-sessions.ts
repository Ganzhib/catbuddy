import path from "node:path";

import type { SessionDetail, SessionInfo, WorkspaceFolder } from "@catbuddy/shared";
import { SessionManager } from "../session/session-manager.js";

function managerForWorkspace(workspace: string): SessionManager {
  return new SessionManager(workspace);
}

function workspaceForFolder(folder: WorkspaceFolder): string {
  return path.join(folder.catbuddyDir, "workspace");
}

function withWorkspaceMetadata(info: SessionInfo, folderId: string | null): SessionInfo {
  if (!folderId) return info;
  return {
    ...info,
    metadata: {
      ...info.metadata,
      workspaceFolderId: typeof info.metadata?.workspaceFolderId === "string"
        ? info.metadata.workspaceFolderId
        : folderId,
    },
  };
}

export function listAllDesktopSessions(
  homeWorkspace: string,
  folders: WorkspaceFolder[],
): SessionInfo[] {
  const byKey = new Map<string, SessionInfo>();

  for (const info of managerForWorkspace(homeWorkspace).list()) {
    byKey.set(info.key, withWorkspaceMetadata(info, null));
  }

  for (const folder of folders) {
    const manager = managerForWorkspace(workspaceForFolder(folder));
    for (const info of manager.list()) {
      byKey.set(info.key, withWorkspaceMetadata(info, folder.id));
    }
  }

  return [...byKey.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function getDesktopSessionDetail(
  homeWorkspace: string,
  folders: WorkspaceFolder[],
  key: string,
): SessionDetail | null {
  const homeDetail = managerForWorkspace(homeWorkspace).getDetail(key);
  if (homeDetail) return homeDetail;

  for (const folder of folders) {
    const detail = managerForWorkspace(workspaceForFolder(folder)).getDetail(key);
    if (detail) {
      return withWorkspaceMetadata(detail, folder.id) as SessionDetail;
    }
  }

  return null;
}

export function deleteDesktopSession(
  homeWorkspace: string,
  folders: WorkspaceFolder[],
  key: string,
): boolean {
  let deleted = managerForWorkspace(homeWorkspace).delete(key);
  for (const folder of folders) {
    deleted = managerForWorkspace(workspaceForFolder(folder)).delete(key) || deleted;
  }
  return deleted;
}
