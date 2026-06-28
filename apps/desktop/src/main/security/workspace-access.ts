/**
 * Workspace file-access policy — who may touch which directories.
 * Used by PathGuard (enforcement), workspace-anchor (runtime switch), identity.md (prompt).
 */
import { app } from "electron";
import path from "node:path";

import type { WorkspaceFolder } from "@catbuddy/shared";

export interface WorkspaceFileAccessPolicy {
  /** When true, tools are limited to the internal agent workspace directory only. */
  restrictToWorkspace: boolean;
  /** User picked an imported project folder (not the default home anchor). */
  hasSelectedFolder: boolean;
  /** Project root is the user profile directory (sensitive). */
  isSensitiveRegion: boolean;
}

/** Modes exposed to identity.md and logging. */
export type FileAccessMode = "internal" | "project";

export function fileAccessMode(policy: WorkspaceFileAccessPolicy): FileAccessMode {
  return policy.restrictToWorkspace ? "internal" : "project";
}

/**
 * Default home anchor lives under the user profile; sibling folders there are sensitive.
 * An explicitly imported folder (e.g. D:/Projects/foo) is not sensitive — tools may use
 * the full project root (all paths alongside `.catbuddy`).
 */
export function isSensitiveProjectRoot(projectRoot: string): boolean {
  const root = path.resolve(projectRoot);
  const userHome = path.resolve(app.getPath("home"));
  return root === userHome;
}

export function computeWorkspaceFileAccess(
  folder: WorkspaceFolder | null,
): WorkspaceFileAccessPolicy {
  if (!folder) {
    return {
      restrictToWorkspace: true,
      hasSelectedFolder: false,
      isSensitiveRegion: true,
    };
  }

  const sensitive = isSensitiveProjectRoot(folder.projectRoot);
  return {
    restrictToWorkspace: sensitive,
    hasSelectedFolder: true,
    isSensitiveRegion: sensitive,
  };
}
