import fs from "node:fs";
import path from "node:path";

const CATBUDDY_DIR_NAME = ".catbuddy";

export { CATBUDDY_DIR_NAME };

export function getCatbuddyDirFromConfigFile(configFile: string): string {
  return path.dirname(path.dirname(configFile));
}

export function getProjectRoot(catbuddyDir: string): string {
  return path.dirname(catbuddyDir);
}

export interface WorkspaceTreeNode {
  name: string;
  path: string;
  relativePath: string;
  isDirectory: boolean;
  isCatbuddyDir: boolean;
  children?: WorkspaceTreeNode[];
}

export interface WorkspaceProjectInfo {
  projectRoot: string;
  catbuddyDir: string;
  workspace: string;
}

export function getWorkspaceProjectInfo(
  configFile: string,
  workspace: string,
): WorkspaceProjectInfo {
  const catbuddyDir = getCatbuddyDirFromConfigFile(configFile);
  return {
    projectRoot: getProjectRoot(catbuddyDir),
    catbuddyDir,
    workspace,
  };
}

function isHidden(name: string): boolean {
  return name.startsWith(".") && name !== CATBUDDY_DIR_NAME;
}

export function listProjectRootEntries(projectRoot: string): WorkspaceTreeNode[] {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(projectRoot, { withFileTypes: true });
  } catch {
    return [];
  }

  return entries
    .filter((entry) => !isHidden(entry.name) || entry.name === CATBUDDY_DIR_NAME)
    .sort((a, b) => {
      if (a.name === CATBUDDY_DIR_NAME) return -1;
      if (b.name === CATBUDDY_DIR_NAME) return 1;
      if (a.isDirectory() !== b.isDirectory()) return a.isDirectory() ? -1 : 1;
      return a.name.localeCompare(b.name);
    })
    .map((entry) => {
      const abs = path.join(projectRoot, entry.name);
      const isCatbuddyDir = entry.name === CATBUDDY_DIR_NAME;
      return {
        name: entry.name,
        path: abs,
        relativePath: entry.name,
        isDirectory: entry.isDirectory(),
        isCatbuddyDir,
      };
    });
}

export function listDirectoryChildren(dirPath: string, projectRoot: string): WorkspaceTreeNode[] {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dirPath, { withFileTypes: true });
  } catch {
    return [];
  }

  return entries
    .filter((entry) => !entry.name.startsWith("."))
    .sort((a, b) => {
      if (a.isDirectory() !== b.isDirectory()) return a.isDirectory() ? -1 : 1;
      return a.name.localeCompare(b.name);
    })
    .map((entry) => {
      const abs = path.join(dirPath, entry.name);
      const relativePath = path.relative(projectRoot, abs).replace(/\\/g, "/");
      return {
        name: entry.name,
        path: abs,
        relativePath,
        isDirectory: entry.isDirectory(),
        isCatbuddyDir: false,
      };
    });
}

export function importFolderToProjectRoot(
  sourcePath: string,
  projectRoot: string,
): { destPath: string; created: boolean } {
  const resolvedSource = path.resolve(sourcePath);
  const folderName = path.basename(resolvedSource);
  const destPath = path.join(projectRoot, folderName);

  if (path.resolve(destPath) === resolvedSource) {
    return { destPath: resolvedSource, created: false };
  }

  if (fs.existsSync(destPath)) {
    throw new Error(`Folder already exists: ${folderName}`);
  }

  fs.cpSync(resolvedSource, destPath, { recursive: true });
  return { destPath, created: true };
}

export function ensureCatbuddyDir(projectRoot: string): string {
  const catbuddyDir = path.join(projectRoot, CATBUDDY_DIR_NAME);
  fs.mkdirSync(path.join(catbuddyDir, "config"), { recursive: true });
  fs.mkdirSync(path.join(catbuddyDir, "workspace"), { recursive: true });
  return catbuddyDir;
}

export function resolveProjectRootForImport(
  selectedPath: string,
  _currentProjectRoot: string,
): string {
  return path.resolve(selectedPath);
}
