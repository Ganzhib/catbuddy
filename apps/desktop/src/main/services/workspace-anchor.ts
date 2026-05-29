import path from "node:path";
import { app } from "electron";

import type { catbuddyConfig, WorkspaceFolder } from "@catbuddy/shared";
import { AgentLoop } from "../agent/loop.js";
import { SessionManager } from "../session/session-manager.js";
import { saveConfig } from "../config/persist.js";
import {
  CATBUDDY_DIR_NAME,
  ensureCatbuddyDir,
  type WorkspaceProjectInfo,
} from "./workspace-project.js";
import { computeWorkspaceFileAccess } from "../security/index.js";

export interface ProjectAnchor {
  projectRoot: string;
  catbuddyDir: string;
  workspace: string;
  configFile: string;
}

export interface DesktopRuntimeRefs {
  agentLoop: AgentLoop;
  sessions: SessionManager;
  config: catbuddyConfig;
  configFile: string;
}

export function getHomeCatbuddyDir(): string {
  return path.join(app.getPath("home"), CATBUDDY_DIR_NAME);
}

export function getDefaultHomeAnchor(): ProjectAnchor {
  const catbuddyDir = getHomeCatbuddyDir();
  const configFile = path.join(catbuddyDir, "config", "config.json");
  const workspace = path.join(catbuddyDir, "workspace");
  return {
    projectRoot: path.dirname(catbuddyDir),
    catbuddyDir,
    workspace,
    configFile,
  };
}

export function anchorFromFolderPath(folderPath: string): ProjectAnchor {
  const projectRoot = path.resolve(folderPath);
  const catbuddyDir = ensureCatbuddyDir(projectRoot);
  const workspace = projectRoot;
  const configFile = path.join(catbuddyDir, "config", "config.json");
  return { projectRoot, catbuddyDir, workspace, configFile };
}

export function applyProjectAnchor(
  runtime: DesktopRuntimeRefs,
  folder: WorkspaceFolder | null,
): ProjectAnchor {
  const anchor = folder
    ? anchorFromFolderPath(folder.projectRoot)
    : getDefaultHomeAnchor();

  const access = computeWorkspaceFileAccess(folder);
  if (!runtime.config.tools) {
    runtime.config.tools = {
      restrictToWorkspace: access.restrictToWorkspace,
      exec: { enable: true },
      web: { enable: true },
      my: { enable: false, allowSet: false },
      imageGeneration: { enable: false },
    };
  } else {
    runtime.config.tools.restrictToWorkspace = access.restrictToWorkspace;
  }

  runtime.agentLoop.reanchorProject({
    workspace: anchor.workspace,
    projectRoot: anchor.projectRoot,
    catbuddyDir: anchor.catbuddyDir,
    restrictToWorkspace: access.restrictToWorkspace,
  });

  saveConfig(runtime.configFile, runtime.config);
  console.log(
    "[workspace] Active projectRoot=%s catbuddyDir=%s restrictToWorkspace=%s sensitive=%s",
    anchor.projectRoot,
    anchor.catbuddyDir,
    access.restrictToWorkspace,
    access.isSensitiveRegion,
  );
  return anchor;
}

export { computeWorkspaceFileAccess, isSensitiveProjectRoot } from "../security/index.js";

export {
  ensureGlobalProfileBootstrap,
  getGlobalProfileWorkspace,
  isLayeredWorkspace,
} from "./global-profile.js";

export function toProjectInfo(anchor: ProjectAnchor): WorkspaceProjectInfo {
  return {
    projectRoot: anchor.projectRoot,
    catbuddyDir: anchor.catbuddyDir,
    workspace: anchor.workspace,
  };
}
