import fs from "node:fs";
import path from "node:path";

import type { WorkspaceFolder } from "@catbuddy/shared";

const STORE_FILE = "workspace-folders.json";

interface WorkspaceFolderStore {
  activeFolderId: string | null;
  folders: WorkspaceFolder[];
}

function defaultStore(): WorkspaceFolderStore {
  return { activeFolderId: null, folders: [] };
}

function storePath(catbuddyDir: string): string {
  return path.join(catbuddyDir, STORE_FILE);
}

function readStore(catbuddyDir: string): WorkspaceFolderStore {
  const fp = storePath(catbuddyDir);
  if (!fs.existsSync(fp)) return defaultStore();
  try {
    const raw = JSON.parse(fs.readFileSync(fp, "utf-8")) as WorkspaceFolderStore;
    return {
      activeFolderId: raw.activeFolderId ?? null,
      folders: Array.isArray(raw.folders) ? raw.folders : [],
    };
  } catch {
    return defaultStore();
  }
}

function writeStore(catbuddyDir: string, store: WorkspaceFolderStore): void {
  const fp = storePath(catbuddyDir);
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

export function listWorkspaceFolders(catbuddyDir: string): WorkspaceFolderStore {
  return readStore(catbuddyDir);
}

export function getActiveWorkspaceFolderId(catbuddyDir: string): string | null {
  return readStore(catbuddyDir).activeFolderId;
}

export function setActiveWorkspaceFolderId(
  catbuddyDir: string,
  folderId: string | null,
): WorkspaceFolderStore {
  const store = readStore(catbuddyDir);
  if (folderId && !store.folders.some((f) => f.id === folderId)) {
    throw new Error(`Unknown workspace folder: ${folderId}`);
  }
  store.activeFolderId = folderId;
  writeStore(catbuddyDir, store);
  return store;
}

export function createWorkspaceFolderFromPath(
  catbuddyDir: string,
  sourcePath: string,
): { store: WorkspaceFolderStore; folder: WorkspaceFolder; created: boolean } {
  const name = path.basename(path.resolve(sourcePath));
  const store = readStore(catbuddyDir);
  const existing = store.folders.find(
    (f) => f.name.toLowerCase() === name.toLowerCase(),
  );
  if (existing) {
    store.activeFolderId = existing.id;
    writeStore(catbuddyDir, store);
    return { store, folder: existing, created: false };
  }

  const folder: WorkspaceFolder = {
    id: uniqueFolderId(name, store.folders),
    name,
    createdAt: new Date().toISOString(),
  };
  store.folders.unshift(folder);
  store.activeFolderId = folder.id;
  writeStore(catbuddyDir, store);
  return { store, folder, created: true };
}

export function getWorkspaceFolderById(
  catbuddyDir: string,
  folderId: string,
): WorkspaceFolder | null {
  return readStore(catbuddyDir).folders.find((f) => f.id === folderId) ?? null;
}
