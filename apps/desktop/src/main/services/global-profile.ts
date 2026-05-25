/**
 * Global user profile anchor — always `~/.catbuddy-desktop/workspace`.
 * USER.md and user-level MEMORY persist here across project workspaces.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { getHomeCatbuddyDir } from "./workspace-anchor.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TEMPLATES_DIR = path.resolve(__dirname, "../templates");

const GLOBAL_BOOTSTRAP = ["USER.md"] as const;

export function getGlobalProfileWorkspace(): string {
  return path.join(getHomeCatbuddyDir(), "workspace");
}

export function isLayeredWorkspace(projectWorkspace: string): boolean {
  return (
    path.resolve(projectWorkspace) !== path.resolve(getGlobalProfileWorkspace())
  );
}

export function ensureGlobalProfileBootstrap(): void {
  const workspace = getGlobalProfileWorkspace();
  fs.mkdirSync(workspace, { recursive: true });

  for (const name of GLOBAL_BOOTSTRAP) {
    const dest = path.join(workspace, name);
    if (!fs.existsSync(dest)) {
      const src = path.join(TEMPLATES_DIR, name);
      if (fs.existsSync(src)) fs.copyFileSync(src, dest);
    }
  }

  const memDir = path.join(workspace, "memory");
  fs.mkdirSync(memDir, { recursive: true });
  const memDest = path.join(memDir, "MEMORY.md");
  if (!fs.existsSync(memDest)) {
    const src = path.join(TEMPLATES_DIR, "memory", "MEMORY.md");
    if (fs.existsSync(src)) fs.copyFileSync(src, memDest);
  }
}
