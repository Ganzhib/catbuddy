import fs from "node:fs";
import path from "node:path";

export const HEARTBEAT_FILENAME = "HEARTBEAT.md";

const ACTIVE_SECTION = /^##\s+Active Tasks\s*$/im;
const COMPLETED_SECTION = /^##\s+Completed\s*$/im;

/** True when HEARTBEAT.md has at least one real task under "## Active Tasks". */
export function hasActiveHeartbeatTasks(content: string): boolean {
  const match = content.match(ACTIVE_SECTION);
  if (!match || match.index === undefined) return false;

  const after = content.slice(match.index + match[0].length);
  const completedIdx = after.search(COMPLETED_SECTION);
  const section = completedIdx >= 0 ? after.slice(0, completedIdx) : after;

  for (const line of section.split("\n")) {
    const t = line.trim();
    if (!t) continue;
    if (t.startsWith("<!--")) continue;
    if (t.startsWith("#")) continue;
    if (/^[-*]\s*$/.test(t)) continue;
    if (/^[-*]\s+\S/.test(t)) return true;
    if (/^\d+\.\s+\S/.test(t)) return true;
    if (/^[-*]\s+\[[ xX]\]\s+\S/.test(t)) return true;
    if (t.length > 2) return true;
  }
  return false;
}

export function readHeartbeatFile(workspace: string): string | null {
  const filePath = path.join(workspace, HEARTBEAT_FILENAME);
  try {
    return fs.readFileSync(filePath, "utf-8");
  } catch {
    return null;
  }
}

export function workspaceHasHeartbeatTasks(workspace: string): boolean {
  const content = readHeartbeatFile(workspace);
  if (!content) return false;
  return hasActiveHeartbeatTasks(content);
}
