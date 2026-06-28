/**
 * 内置命令注册 + 命令元数据
 *
 * 参考 catbuddy/command/builtin.py
 */
import { DESKTOP_BUILTIN_SLASH_COMMANDS } from "@catbuddy/shared";
import type { CommandSpec } from "./types";
import { CommandRouter } from "./router";
import { cmdStop } from "./handlers/stop";
import { cmdNew } from "./handlers/new";
import { cmdStatus } from "./handlers/status";
import { cmdHistory } from "./handlers/history";
import { cmdModel } from "./handlers/model";
import { cmdCompact } from "./handlers/compact";
import { cmdDream, cmdDreamLog } from "./handlers/dream";
import { cmdHeartbeat } from "./handlers/heartbeat";
import { cmdHelp } from "./handlers/help";

export const COMMAND_SPECS: CommandSpec[] = DESKTOP_BUILTIN_SLASH_COMMANDS;

export function registerBuiltinCommands(router: CommandRouter): void {
  // Priority：在会话锁外处理（未来实现 bus.run() 时需要）
  router.priority("/stop", cmdStop);

  // Exact：精确匹配
  router.exact("/new", cmdNew);
  router.exact("/status", cmdStatus);
  router.exact("/help", cmdHelp);
  router.exact("/compact", cmdCompact);
  router.exact("/dream", cmdDream);
  router.exact("/dream-log", cmdDreamLog);
  router.exact("/heartbeat", cmdHeartbeat);

  // Prefix：带参数的命令（例如 /model gpt-4）
  router.prefix("/model ", cmdModel);
  router.prefix("/model", cmdModel); // 无参也匹配
  router.prefix("/history ", cmdHistory);
  router.prefix("/history", cmdHistory); // 无参也匹配
}
