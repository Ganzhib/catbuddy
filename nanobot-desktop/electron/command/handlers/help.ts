import type { CommandContext } from "../context";
import type { OutboundMessage } from "../../../shared/types";
import { COMMAND_SPECS } from "../builtin";

export function cmdHelp(_ctx: CommandContext): OutboundMessage {
  const lines = COMMAND_SPECS.map((spec) => {
    const cmd = spec.argHint ? `${spec.command} ${spec.argHint}` : spec.command;
    return `${cmd} — ${spec.description}`;
  });

  return {
    channel: _ctx.msg.channel,
    chatId: _ctx.msg.chatId,
    content: lines.join("\n"),
    media: [],
    metadata: {},
    buttons: [],
  };
}
