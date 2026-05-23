import type { CommandContext } from "../context";
import type { OutboundMessage } from "@learnbuddy/shared";

export function cmdNew(ctx: CommandContext): OutboundMessage {
  ctx.loop.sessions.clear(ctx.sessionKey);
  return {
    channel: ctx.msg.channel,
    chatId: ctx.msg.chatId,
    content: "Started a new conversation.",
    media: [],
    metadata: {},
    buttons: [],
  };
}
