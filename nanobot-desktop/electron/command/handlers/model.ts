import type { CommandContext } from "../context";
import type { OutboundMessage } from "../../../shared/types";

export function cmdModel(ctx: CommandContext): OutboundMessage {
  const loop = ctx.loop;
  const presetName = ctx.args.trim();

  if (!presetName) {
    // 无参数：显示当前模型和可用预设
    const presets = Object.keys(loop.modelPresets).join(", ") || "(none)";
    return {
      channel: ctx.msg.channel,
      chatId: ctx.msg.chatId,
      content: `Current model: \`${loop.model}\`\nAvailable presets: ${presets}\nUsage: /model <preset-name>`,
      media: [],
      metadata: {},
      buttons: [],
    };
  }

  // 有参数：切换预设
  if (loop.modelPresets[presetName]) {
    loop.setModelPreset(presetName);
    return {
      channel: ctx.msg.channel,
      chatId: ctx.msg.chatId,
      content: `Model switched to: ${loop.model}`,
      media: [],
      metadata: {},
      buttons: [],
    };
  }

  // 未知预设
  const presets = Object.keys(loop.modelPresets).join(", ") || "(none)";
  return {
    channel: ctx.msg.channel,
    chatId: ctx.msg.chatId,
    content: `Unknown preset: \`${presetName}\`\nAvailable: ${presets}`,
    media: [],
    metadata: {},
    buttons: [],
  };
}
