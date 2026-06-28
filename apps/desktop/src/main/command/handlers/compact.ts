import type { CommandContext } from "../context";
import type { OutboundMessage } from "@catbuddy/shared";

const KEEP_RECENT = 2;

export async function cmdCompact(ctx: CommandContext): Promise<OutboundMessage> {
  const msgs = ctx.loop.sessions.getAllMessages(ctx.sessionKey, {
    maxMessages: 9999,
  });
  if (msgs.length <= KEEP_RECENT) {
    return {
      channel: ctx.msg.channel,
      chatId: ctx.msg.chatId,
      content: `(消息不足：至少需要 ${KEEP_RECENT + 1} 条才会压缩，当前 ${msgs.length} 条)`,
      media: [],
      metadata: {},
      buttons: [],
    };
  }

  try {
    const summary = await ctx.loop.consolidator.compactIdleSession(
      ctx.sessionKey,
      KEEP_RECENT,
    );
    return {
      channel: ctx.msg.channel,
      chatId: ctx.msg.chatId,
      content: summary
        ? `已压缩到 MEMORY.md。\n\n${summary.slice(0, 800)}`
        : "没有可压缩的内容（可能缺少用户消息，或模型未返回摘要）。",
      media: [],
      metadata: {},
      buttons: [],
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      channel: ctx.msg.channel,
      chatId: ctx.msg.chatId,
      content: `压缩失败: ${message}`,
      media: [],
      metadata: {},
      buttons: [],
    };
  }
}
