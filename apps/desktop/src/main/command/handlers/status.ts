import type { CommandContext } from "../context";
import type { OutboundMessage } from "@catbuddy/shared";

export function cmdStatus(ctx: CommandContext): OutboundMessage {
  const loop = ctx.loop;
  const min = Math.floor(loop.uptime / 60);
  const s = loop.uptime % 60;

  return {
    channel: ctx.msg.channel,
    chatId: ctx.msg.chatId,
    content: [
      "**catbuddy Desktop**",
      `Model: \`${loop.model}\``,
      `Uptime: ${min}m ${s}s`,
      `Active sessions: ${loop.activeSessionCount}`,
      `Tools: ${loop.tools.toolNames.length} (${loop.tools.toolNames.join(", ")})`,
      `Workspace: ${loop.workspace}`,
    ].join("\n"),
    media: [],
    metadata: {},
    buttons: [],
  };
}
