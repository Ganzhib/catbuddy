/**
 * Layered memory — global user profile + per-project context.
 */
import fs from "node:fs";
import path from "node:path";

import {
  ensureGlobalProfileBootstrap,
  getGlobalProfileWorkspace,
  isLayeredWorkspace,
} from "../services/global-profile.js";
import { MemoryStore } from "./memory-store.js";

export interface MemorySectionSplit {
  userProfile: string | null;
  projectContext: string | null;
}

const MEMORY_SPLIT_PROMPT_SUFFIX = `

Return TWO markdown sections using these exact headers:

## User Profile
Facts about the person (name, preferences, communication style, timezone, role) that apply across all projects.

## Project Context
Facts specific to this project (tech stack, repo structure, tasks, code decisions).

If a section has nothing new, write "(nothing)" under that header.`;

export function memoryExtractionPrompt(basePrompt: string): string {
  return basePrompt + MEMORY_SPLIT_PROMPT_SUFFIX;
}

export function splitMemorySections(raw: string): MemorySectionSplit {
  const trimSection = (s: string): string | null => {
    const t = s.trim();
    if (!t || t === "(nothing)") return null;
    return t;
  };

  const userIdx = raw.search(/##\s*User\s*Profile/i);
  const projectIdx = raw.search(/##\s*Project\s*Context/i);

  if (userIdx === -1 && projectIdx === -1) {
    return { userProfile: trimSection(raw), projectContext: null };
  }

  let userProfile: string | null = null;
  let projectContext: string | null = null;

  if (userIdx !== -1) {
    const start = raw.indexOf("\n", userIdx);
    const bodyStart = start === -1 ? userIdx : start + 1;
    const end =
      projectIdx !== -1 && projectIdx > userIdx ? projectIdx : raw.length;
    userProfile = trimSection(raw.slice(bodyStart, end));
  }

  if (projectIdx !== -1) {
    const start = raw.indexOf("\n", projectIdx);
    const bodyStart = start === -1 ? projectIdx : start + 1;
    projectContext = trimSection(raw.slice(bodyStart));
  }

  return { userProfile, projectContext };
}

function appendToMemoryFile(
  workspace: string,
  label: string,
  body: string,
  sectionTitle?: string,
): void {
  const memDir = path.join(workspace, "memory");
  fs.mkdirSync(memDir, { recursive: true });
  const memPath = path.join(memDir, "MEMORY.md");
  let existing = "";
  try {
    existing = fs.readFileSync(memPath, "utf-8");
  } catch {
    /* new file */
  }
  const heading = sectionTitle
    ? `## ${label} — ${sectionTitle}`
    : `## ${label}`;
  const now = new Date().toISOString().slice(0, 10);
  const entry = `\n\n${heading} — ${now}\n${body}\n`;
  fs.writeFileSync(memPath, existing + entry, "utf-8");
}

/** Route a summary to global and/or project MEMORY.md. */
export function appendLayeredMemory(opts: {
  summary: string;
  projectWorkspace: string;
  globalWorkspace?: string;
  label: string;
}): void {
  const globalWorkspace = opts.globalWorkspace ?? getGlobalProfileWorkspace();
  const layered = isLayeredWorkspace(opts.projectWorkspace);
  const { userProfile, projectContext } = splitMemorySections(opts.summary);

  if (!layered) {
    appendToMemoryFile(globalWorkspace, opts.label, opts.summary);
    return;
  }

  if (userProfile) {
    appendToMemoryFile(globalWorkspace, opts.label, userProfile, "User Profile");
  }
  if (projectContext) {
    appendToMemoryFile(
      opts.projectWorkspace,
      opts.label,
      projectContext,
      "Project",
    );
  }

  if (!userProfile && !projectContext) {
    const fallback = opts.summary.trim();
    if (fallback) {
      appendToMemoryFile(globalWorkspace, opts.label, fallback, "User Profile");
    }
  }
}

export class LayeredMemoryStore {
  readonly project: MemoryStore;
  readonly global: MemoryStore;

  constructor(projectWorkspace: string, globalWorkspace?: string) {
    ensureGlobalProfileBootstrap();
    this.project = new MemoryStore(projectWorkspace);
    this.global = new MemoryStore(
      globalWorkspace ?? getGlobalProfileWorkspace(),
    );
  }

  get isLayered(): boolean {
    return isLayeredWorkspace(this.project.workspace);
  }

  appendMemorySummary(summary: string, label: string): void {
    appendLayeredMemory({
      summary,
      projectWorkspace: this.project.workspace,
      globalWorkspace: this.global.workspace,
      label,
    });
  }
}
