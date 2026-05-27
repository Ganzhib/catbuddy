import fs from "node:fs";
import path from "node:path";
import { app } from "electron";

import type { catbuddyConfig, WorkspaceFolder } from "@catbuddy/shared";
import { AgentLoop } from "../agent/loop.js";
import { SessionManager } from "../session/session-manager.js";
import { getDefaultConfig } from "../config/defaults.js";
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
  const workspace = path.join(catbuddyDir, "workspace");
  const configFile = path.join(catbuddyDir, "config", "config.json");
  return { projectRoot, catbuddyDir, workspace, configFile };
}

function ensureConfigFile(
  anchor: ProjectAnchor,
  template?: catbuddyConfig,
): catbuddyConfig {
  fs.mkdirSync(path.dirname(anchor.configFile), { recursive: true });
  if (fs.existsSync(anchor.configFile)) {
    const existing = JSON.parse(
      fs.readFileSync(anchor.configFile, "utf-8"),
    ) as catbuddyConfig;
    existing.workspace = anchor.workspace.replace(/\\/g, "/");
    saveConfig(anchor.configFile, existing);
    return existing;
  }

  const cfg = template
    ? (JSON.parse(JSON.stringify(template)) as catbuddyConfig)
    : getDefaultConfig();
  cfg.workspace = anchor.workspace.replace(/\\/g, "/");
  saveConfig(anchor.configFile, cfg);
  return cfg;
}

export function applyProjectAnchor(
  runtime: DesktopRuntimeRefs,
  folder: WorkspaceFolder | null,
  templateConfig?: catbuddyConfig,
): ProjectAnchor {
  const anchor = folder
    ? anchorFromFolderPath(folder.projectRoot)
    : getDefaultHomeAnchor();

  const config = ensureConfigFile(anchor, templateConfig ?? runtime.config);
  config.workspace = anchor.workspace.replace(/\\/g, "/");

  const access = computeWorkspaceFileAccess(folder);
  if (!config.tools) {
    config.tools = {
      restrictToWorkspace: access.restrictToWorkspace,
      exec: { enable: true },
      web: { enable: true },
      my: { enable: false, allowSet: false },
      imageGeneration: { enable: false },
    };
  } else {
    config.tools.restrictToWorkspace = access.restrictToWorkspace;
  }

  (config as catbuddyConfig & { runtime?: { config_path?: string } }).runtime = {
    config_path: anchor.configFile,
  };

  runtime.configFile = anchor.configFile;
  runtime.config = config;
  const sessions = new SessionManager(anchor.workspace);
  runtime.sessions = sessions;
  runtime.agentLoop.reanchorProject({
    workspace: anchor.workspace,
    projectRoot: anchor.projectRoot,
    catbuddyDir: anchor.catbuddyDir,
    config,
    sessionManager: sessions,
  });

  saveConfig(anchor.configFile, config);
  console.log(
    "[workspace] Anchored projectRoot=%s catbuddyDir=%s restrictToWorkspace=%s sensitive=%s",
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
