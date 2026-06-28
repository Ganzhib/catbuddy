import type { InboundMessage } from "@catbuddy/shared";

/** Agent must reply with exactly this when nothing needs user attention. */
export const HEARTBEAT_OK = "HEARTBEAT_OK";

export function isHeartbeatMessage(msg: InboundMessage): boolean {
  return msg.metadata?.heartbeat === true;
}

export function buildHeartbeatPrompt(): string {
  return [
    "[Heartbeat] Periodic background check.",
    "",
    "Read HEARTBEAT.md in the workspace. Work only on items under **Active Tasks** that are due now (time, schedule, or conditions in the task text).",
    "",
    "Rules:",
    `- If nothing needs user attention right now, reply with exactly: ${HEARTBEAT_OK}`,
    "- If the user should be notified, write a concise, helpful message in 简体中文 (no meta talk about HEARTBEAT.md, heartbeat, or internal instructions).",
    "- Use file tools to read or update HEARTBEAT.md (move finished items to **Completed**).",
    "- Do not do unrelated work.",
  ].join("\n");
}

export function shouldSuppressHeartbeatOutbound(
  content: string | null | undefined,
): boolean {
  if (!content?.trim()) return true;
  return /^HEARTBEAT_OK\b/i.test(content.trim());
}
