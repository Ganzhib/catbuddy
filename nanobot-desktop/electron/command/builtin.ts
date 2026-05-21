/**
 * 内置命令注册 + 命令元数据
 *
 * 参考 nanobot/command/builtin.py
 */
import type { CommandSpec } from "./types";
import { CommandRouter } from "./router";
import { cmdStop } from "./handlers/stop";
import { cmdNew } from "./handlers/new";
import { cmdStatus } from "./handlers/status";
import { cmdHistory } from "./handlers/history";
import { cmdModel } from "./handlers/model";
import { cmdCompact } from "./handlers/compact";
import { cmdHelp } from "./handlers/help";

export const COMMAND_SPECS: CommandSpec[] = [
  {
    command: "/new",
    title: "新对话",
    description: "清除当前会话历史，开始新对话",
    icon: "square-pen",
  },
  {
    command: "/stop",
    title: "停止任务",
    description: "取消当前正在运行的 Agent 任务",
    icon: "square",
  },
  {
    command: "/status",
    title: "运行状态",
    description: "显示模型、运行时间、活跃会话等状态",
    icon: "activity",
  },
  {
    command: "/model",
    title: "切换模型",
    description: "显示或切换模型预设",
    icon: "brain",
    argHint: "[preset]",
  },
  {
    command: "/history",
    title: "历史记录",
    description: "查看最近 N 条会话消息",
    icon: "history",
    argHint: "[n]",
  },
  {
    command: "/compact",
    title: "压缩上下文",
    description: "手动触发上下文压缩（摘要历史消息）",
    icon: "folder-down",
  },
  {
    command: "/help",
    title: "帮助",
    description: "列出所有可用命令",
    icon: "circle-help",
  },
];

export function registerBuiltinCommands(router: CommandRouter): void {
  // Priority：在会话锁外处理（未来实现 bus.run() 时需要）
  router.priority("/stop", cmdStop);

  // Exact：精确匹配
  router.exact("/new", cmdNew);
  router.exact("/status", cmdStatus);
  router.exact("/help", cmdHelp);
  router.exact("/compact", cmdCompact);

  // Prefix：带参数的命令（例如 /model gpt-4）
  router.prefix("/model ", cmdModel);
  router.prefix("/model", cmdModel); // 无参也匹配
  router.prefix("/history ", cmdHistory);
  router.prefix("/history", cmdHistory); // 无参也匹配
}
