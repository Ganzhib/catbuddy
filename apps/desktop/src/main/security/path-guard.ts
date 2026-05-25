/**
 * PathGuard — single enforcement point for agent file/exec path access.
 * Strategy: internal (restricted workspace) vs project (full project root).
 */
import path from "node:path";

import { CATBUDDY_DIR_NAME } from "../services/workspace-project.js";
import {
  fileAccessMode,
  type FileAccessMode,
  type WorkspaceFileAccessPolicy,
} from "./workspace-access.js";

export interface PathGuardRoots {
  /** CatBuddy internal agent dir (`…/.catbuddy/workspace`). */
  workspace: string;
  /** User project root (parent of `.catbuddy`). */
  projectRoot: string;
  /** Reserved metadata dir (`…/.catbuddy`). */
  catbuddyDir: string;
}

export interface PathGuardConfig extends PathGuardRoots {
  policy: WorkspaceFileAccessPolicy;
}

export class PathGuard {
  readonly workspace: string;
  readonly projectRoot: string;
  readonly catbuddyDir: string;
  readonly policy: WorkspaceFileAccessPolicy;
  readonly mode: FileAccessMode;

  constructor(config: PathGuardConfig) {
    this.workspace = path.resolve(config.workspace);
    this.projectRoot = path.resolve(config.projectRoot);
    this.catbuddyDir = path.resolve(config.catbuddyDir);
    this.policy = config.policy;
    this.mode = fileAccessMode(config.policy);
  }

  /** Default cwd / relative-path base for tools. */
  get workRoot(): string {
    return this.mode === "internal" ? this.workspace : this.projectRoot;
  }

  /** Allowed boundary for resolved paths. */
  get boundary(): string {
    return this.mode === "internal" ? this.workspace : this.projectRoot;
  }

  resolve(inputPath: string): string {
    const resolved = path.isAbsolute(inputPath)
      ? path.resolve(inputPath)
      : path.resolve(this.workRoot, inputPath);
    this.assertAllowed(resolved, inputPath);
    return resolved;
  }

  displayPath(resolved: string): string {
    const rel = path.relative(this.projectRoot || this.workspace, resolved);
    if (!rel || rel.startsWith("..")) return resolved.replace(/\\/g, "/");
    return rel.replace(/\\/g, "/");
  }

  assertAllowed(resolved: string, label = resolved): void {
    const p = path.resolve(resolved);
    const boundary = this.boundary;

    if (!p.startsWith(boundary + path.sep) && p !== boundary) {
      const scope =
        this.mode === "internal"
          ? "internal workspace"
          : "project root";
      throw new Error(`Access denied: "${label}" is outside ${scope}`);
    }

    if (p === this.catbuddyDir || p.startsWith(this.catbuddyDir + path.sep)) {
      throw new Error(
        `Access denied: "${label}" is inside ${CATBUDDY_DIR_NAME} (reserved for CatBuddy)`,
      );
    }
  }

  static fromRoots(
    roots: PathGuardRoots,
    restrictToWorkspace: boolean,
  ): PathGuard {
    return new PathGuard({
      ...roots,
      policy: {
        restrictToWorkspace,
        hasSelectedFolder: !restrictToWorkspace,
        isSensitiveRegion: restrictToWorkspace,
      },
    });
  }
}

export function createPathGuard(config: PathGuardConfig): PathGuard {
  return new PathGuard(config);
}
