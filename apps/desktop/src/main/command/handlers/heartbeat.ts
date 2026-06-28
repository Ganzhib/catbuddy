import type { OutboundMessage } from "@catbuddy/shared";
import type { CommandContext } from "../context.js";
import { workspaceHasHeartbeatTasks } from "../../heartbeat/tasks.js";

export async function cmdHeartbeat(
  ctx: CommandContext,
): Promise<OutboundMessage> {
  const result = ctx.loop.runHeartbeatOnce?.({ force: true });
  if (!result) {
    return reply(ctx, "Heartbeat 未初始化。");
  }

  switch (result) {
    case "skipped":
      return reply(ctx, "Heartbeat 已禁用或未就绪（检查 config 中 heartbeatEnabled）。");
    case "no-tasks":
      return reply(
        ctx,
        "HEARTBEAT.md 的 Active Tasks 为空，未触发检查。可在该文件中添加周期性任务后再试。",
      );
    case "dispatched":
      return reply(
        ctx,
        workspaceHasHeartbeatTasks(ctx.loop.workspace)
          ? "已触发 Heartbeat 检查，有结果时会推送到当前会话。"
          : "已强制触发 Heartbeat 检查。",
      );
    default:
      return reply(ctx, "Heartbeat 触发失败。");
  }
}

function reply(ctx: CommandContext, content: string): OutboundMessage {
  return {
    channel: ctx.msg.channel,
    chatId: ctx.msg.chatId,
    content,
    media: [],
    metadata: {},
    buttons: [],
  };
}
