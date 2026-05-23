import type { CommandContext } from "../context";
import type { OutboundMessage } from "@learnbuddy/shared";

export async function cmdStop(ctx: CommandContext): Promise<OutboundMessage> {
  const total = await ctx.loop.cancelSession(ctx.sessionKey);
  return {
    channel: ctx.msg.channel,
    chatId: ctx.msg.chatId,
    content: total ? `Stopped ${total} task(s).` : "No active task to stop.",
    media: [],
    metadata: {},
    buttons: [],
  };
}
