/**
 * CommandContext — 命令处理器的输入
 *
 * 参考 learnbuddy/command/router.py CommandContext
 */
import type { InboundMessage } from "@learnbuddy/shared";

export interface CommandContext {
  msg: InboundMessage;
  sessionKey: string;
  raw: string;   // 原始输入（保留大小写）
  args: string;  // 参数部分（Router 填充）
  loop: CommandLoopAPI;  // AgentLoop 的只读视图，避免循环依赖
}

/**
 * AgentLoop 暴露给命令处理器的只读 API。
 * AgentLoop 实现此接口即可。
 */
export interface CommandLoopAPI {
  readonly model: string;
  readonly modelPresets: Record<string, string>;
  readonly uptime: number;
  readonly activeSessionCount: number;
  readonly workspace: string;
  setModelPreset(name: string): void;
  cancelSession(sessionKey: string): Promise<number>;

  readonly sessions: {
    getOrCreate(key: string): { metadata?: Record<string, unknown> };
    clear(key: string): void;
    getHistory(key: string, opts?: { maxMessages?: number }): Array<{
      role: string;
      content: string;
    }>;
  };

  readonly tools: {
    readonly toolNames: string[];
  };

  readonly consolidator: {
    compactIdleSession(key: string, keepRecent: number): Promise<string | null>;
  };
}
