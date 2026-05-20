/**
 * CommandRouter — 三层命令路由表
 *
 * 参考 nanobot/command/router.py
 * priority > exact > prefix（最长前缀优先）
 */
import type { OutboundMessage } from "../../shared/types";
import type { CommandContext } from "./context";

export type CommandHandler = (
  ctx: CommandContext
) => OutboundMessage | Promise<OutboundMessage>;

export class CommandRouter {
  private _priority = new Map<string, CommandHandler>();
  private _exact = new Map<string, CommandHandler>();
  private _prefix: Array<[string, CommandHandler]> = [];

  /** 注册优先命令（在会话锁外处理） */
  priority(cmd: string, handler: CommandHandler): void {
    this._priority.set(cmd, handler);
  }

  /** 注册精确匹配命令 */
  exact(cmd: string, handler: CommandHandler): void {
    this._exact.set(cmd, handler);
  }

  /** 注册前缀匹配命令（自动按前缀长度降序） */
  prefix(pattern: string, handler: CommandHandler): void {
    this._prefix.push([pattern, handler]);
    this._prefix.sort((a, b) => b[0].length - a[0].length);
  }

  /** 检查是否为优先命令 */
  isPriority(text: string): boolean {
    return this._priority.has(text.trim().toLowerCase());
  }

  /** 检查是否为可调度命令（不含 priority） */
  isDispatchableCommand(text: string): boolean {
    const cmd = text.trim().toLowerCase();
    if (this._exact.has(cmd)) return true;
    return this._prefix.some(([p]) => cmd.startsWith(p));
  }

  /** 分发优先命令 */
  async dispatchPriority(
    ctx: CommandContext
  ): Promise<OutboundMessage | null> {
    const handler = this._priority.get(ctx.raw.toLowerCase());
    if (!handler) return null;
    return handler(ctx);
  }

  /** 分发命令：精确 → 前缀，都不匹配返回 null */
  async dispatch(ctx: CommandContext): Promise<OutboundMessage | null> {
    const cmd = ctx.raw.toLowerCase();

    // 1. 精确匹配
    if (this._exact.has(cmd)) {
      return this._exact.get(cmd)!(ctx);
    }

    // 2. 前缀匹配（最长前缀优先）
    for (const [prefix, handler] of this._prefix) {
      if (cmd.startsWith(prefix)) {
        ctx.args = ctx.raw.slice(prefix.length);
        return handler(ctx);
      }
    }

    return null; // 不是命令 → 交给 LLM
  }

  /** 列出所有已注册命令（用于 /help 和命令面板） */
  get priorityCommands(): string[] {
    return [...this._priority.keys()];
  }

  get exactCommands(): string[] {
    return [...this._exact.keys()];
  }

  get prefixPatterns(): string[] {
    return this._prefix.map(([p]) => p);
  }
}
