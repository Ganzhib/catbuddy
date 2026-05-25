import fs from "node:fs";
import path from "node:path";

import type { WorkspaceFolder } from "@catbuddy/shared";
import { anchorFromFolderPath } from "./workspace-anchor.js";

const STORE_FILE = "workspace-folders.json";

interface WorkspaceFolderStore {
  activeFolderId: string | null;
  folders: WorkspaceFolder[];
}

function defaultStore(): WorkspaceFolderStore {
  return { activeFolderId: null, folders: [] };
}

function storePath(homeCatbuddyDir: string): string {
  return path.join(homeCatbuddyDir, STORE_FILE);
}

function readStore(homeCatbuddyDir: string): WorkspaceFolderStore {
  const fp = storePath(homeCatbuddyDir);
  if (!fs.existsSync(fp)) return defaultStore();
  try {
    const raw = JSON.parse(fs.readFileSync(fp, "utf-8")) as WorkspaceFolderStore;
    return {
      activeFolderId: raw.activeFolderId ?? null,
      folders: (Array.isArray(raw.folders) ? raw.folders : [])
        .filter((f) => typeof f.projectRoot === "string" && f.projectRoot.length > 0)
        .map((f) => ({
          id: f.id,
          name: f.name,
          createdAt: f.createdAt,
          projectRoot: f.projectRoot,
          catbuddyDir: f.catbuddyDir ?? path.join(f.projectRoot, ".catbuddy"),
        })),
    };
  } catch {
    return defaultStore();
  }
}

function writeStore(homeCatbuddyDir: string, store: WorkspaceFolderStore): void {
  const fp = storePath(homeCatbuddyDir);
  fs.mkdirSync(path.dirname(fp), { recursive: true });
  fs.writeFileSync(fp, JSON.stringify(store, null, 2), "utf-8");
}

function slugify(name: string): string {
  const base = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff]+/gi, "-")
    .replace(/^-+|-+$/g, "");
  return base || "workspace";
}

function uniqueFolderId(name: string, existing: WorkspaceFolder[]): string {
  const base = slugify(name);
  if (!existing.some((f) => f.id === base)) return base;
  return `${base}-${Date.now().toString(36)}`;
}

export function listWorkspaceFolders(homeCatbuddyDir: string): WorkspaceFolderStore {
  return readStore(homeCatbuddyDir);
}

export function getActiveWorkspaceFolderId(homeCatbuddyDir: string): string | null {
  return readStore(homeCatbuddyDir).activeFolderId;
}

export function setActiveWorkspaceFolderId(
  homeCatbuddyDir: string,
  folderId: string | null,
): WorkspaceFolderStore {
  const store = readStore(homeCatbuddyDir);
  if (folderId && !store.folders.some((f) => f.id === folderId)) {
    throw new Error(`Unknown workspace folder: ${folderId}`);
  }
  store.activeFolderId = folderId;
  writeStore(homeCatbuddyDir, store);
  return store;
}

export function getWorkspaceFolderById(
  homeCatbuddyDir: string,
  folderId: string,
): WorkspaceFolder | null {
  return readStore(homeCatbuddyDir).folders.find((f) => f.id === folderId) ?? null;
}

export function removeWorkspaceFolder(
  homeCatbuddyDir: string,
  folderId: string,
): WorkspaceFolderStore {
  const store = readStore(homeCatbuddyDir);
  store.folders = store.folders.filter((f) => f.id !== folderId);
  if (store.activeFolderId === folderId) {
    store.activeFolderId = store.folders[0]?.id ?? null;
  }
  writeStore(homeCatbuddyDir, store);
  return store;
}

/** Register a workspace folder at `sourcePath` and create `.catbuddy` inside it. */
export function createWorkspaceFolderFromPath(
  homeCatbuddyDir: string,
  sourcePath: string,
): { store: WorkspaceFolderStore; folder: WorkspaceFolder; created: boolean } {
  const name = path.basename(path.resolve(sourcePath));
  const anchor = anchorFromFolderPath(sourcePath);
  const store = readStore(homeCatbuddyDir);

  const existing = store.folders.find(
    (f) =>
      path.resolve(f.projectRoot).toLowerCase() ===
      anchor.projectRoot.toLowerCase(),
  );

  if (existing) {
    store.activeFolderId = existing.id;
    writeStore(homeCatbuddyDir, store);
    return { store, folder: existing, created: false };
  }

  const folder: WorkspaceFolder = {
    id: uniqueFolderId(name, store.folders),
    name,
    createdAt: new Date().toISOString(),
    projectRoot: anchor.projectRoot,
    catbuddyDir: anchor.catbuddyDir,
  };
  store.folders.unshift(folder);
  store.activeFolderId = folder.id;
  writeStore(homeCatbuddyDir, store);
  return { store, folder, created: true };
}
