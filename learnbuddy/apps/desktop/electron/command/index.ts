/**
 * Command 模块 — 斜杠命令路由
 */
export { CommandRouter } from "./router";
export type { CommandHandler } from "./router";
export type { CommandContext, CommandLoopAPI } from "./context";
export type { CommandSpec } from "./types";
export { registerBuiltinCommands, COMMAND_SPECS } from "./builtin";
