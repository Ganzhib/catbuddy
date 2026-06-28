import fs from "node:fs";
import path from "node:path";

import type { OutboundMessage } from "@catbuddy/shared";
import type { CommandContext } from "../context.js";
import {
  getGlobalProfileWorkspace,
  isLayeredWorkspace,
} from "../../services/global-profile.js";

function lastDreamExcerpt(memoryPath: string): string | null {
  if (!fs.existsSync(memoryPath)) return null;
  const raw = fs.readFileSync(memoryPath, "utf-8");
  const blocks = raw.split(/\n## Dream\b/);
  if (blocks.length < 2) return null;
  const last = blocks[blocks.length - 1]!.trim();
  return last.length > 0 ? last.slice(0, 1200) : null;
}

export async function cmdDream(ctx: CommandContext): Promise<OutboundMessage> {
  if (!ctx.loop.runDreamOnce) {
    return reply(ctx, "Dream 未初始化（需要完整 Agent 配置）。");
  }

  try {
    const summary = await ctx.loop.runDreamOnce();
    if (!summary) {
      return reply(
        ctx,
        "Dream：没有新的 history 可整理。请先正常对话几轮（会自动写入 memory/history.jsonl），或稍后再试。",
      );
    }
    return reply(ctx, `Dream 完成，已写入分层 MEMORY：\n\n${summary.slice(0, 800)}`);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return reply(ctx, `Dream 失败: ${message}`);
  }
}

export async function cmdDreamLog(ctx: CommandContext): Promise<OutboundMessage> {
  const ws = ctx.loop.workspace;
  const globalWs = getGlobalProfileWorkspace();
  const parts: string[] = [];

  const globalExcerpt = lastDreamExcerpt(
    path.join(globalWs, "memory", "MEMORY.md"),
  );
  if (globalExcerpt) {
    parts.push(`### 全局记忆 (~/.catbuddy)\n${globalExcerpt}`);
  }

  if (isLayeredWorkspace(ws)) {
    const projectExcerpt = lastDreamExcerpt(
      path.join(ws, "memory", "MEMORY.md"),
    );
    if (projectExcerpt) {
      parts.push(`### 项目记忆\n${projectExcerpt}`);
    }
  }

  if (parts.length === 0) {
    return reply(ctx, "尚无 Dream 记录。运行 /dream 或等待定时 Dream 后会出现在 MEMORY.md。");
  }

  return reply(ctx, parts.join("\n\n---\n\n"));
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
