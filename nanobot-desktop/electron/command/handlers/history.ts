import type { CommandContext } from "../context";
import type { OutboundMessage } from "../../../shared/types";

const DEFAULT_COUNT = 10;
const MAX_COUNT = 50;
const MAX_CONTENT_CHARS = 100;

export function cmdHistory(ctx: CommandContext): OutboundMessage {
  const args = ctx.args
    ? ctx.args.trim()
    : new URLSearchParams(ctx.raw).toString() || "";
  const n = args
    ? Math.max(1, Math.min(parseInt(args) || DEFAULT_COUNT, MAX_COUNT))
    : DEFAULT_COUNT;

  const msgs = ctx.loop.sessions.getHistory(ctx.sessionKey, {
    maxMessages: n,
  });

  if (msgs.length === 0) {
    return {
      channel: ctx.msg.channel,
      chatId: ctx.msg.chatId,
      content: "(no history)",
      media: [],
      metadata: {},
      buttons: [],
    };
  }

  const lines = msgs.map((m) => {
    const preview = (m.content || "")
      .replace(/\n/g, " ")
      .slice(0, MAX_CONTENT_CHARS);
    return `[${m.role}] ${preview}${
      preview.length >= MAX_CONTENT_CHARS ? "..." : ""
    }`;
  });

  return {
    channel: ctx.msg.channel,
    chatId: ctx.msg.chatId,
    content: lines.join("\n"),
    media: [],
    metadata: {},
    buttons: [],
  };
}
