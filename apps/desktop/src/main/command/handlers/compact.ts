import type { CommandContext } from "../context";
import type { OutboundMessage } from "@catbuddy/shared";

export async function cmdCompact(ctx: CommandContext): Promise<OutboundMessage> {
  const msgs = ctx.loop.sessions.getHistory(ctx.sessionKey, { maxMessages: 9999 });
  if (msgs.length < 2) {
    return {
      channel: ctx.msg.channel,
      chatId: ctx.msg.chatId,
      content: "(not enough messages to compact)",
      media: [],
      metadata: {},
      buttons: [],
    };
  }

  try {
    const summary = await ctx.loop.consolidator.compactIdleSession(
      ctx.sessionKey,
      Math.max(2, msgs.length - 2)
    );
    return {
      channel: ctx.msg.channel,
      chatId: ctx.msg.chatId,
      content: summary
        ? `Compacted. Summary:\n${summary.slice(0, 500)}`
        : "Nothing to compact.",
      media: [],
      metadata: {},
      buttons: [],
    };
  } catch (err: any) {
    return {
      channel: ctx.msg.channel,
      chatId: ctx.msg.chatId,
      content: `Compact failed: ${err.message}`,
      media: [],
      metadata: {},
      buttons: [],
    };
  }
}
