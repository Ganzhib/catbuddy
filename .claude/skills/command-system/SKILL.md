---
name: command-system
description: 命令系统 — 三层路由表、内置命令、添加新命令指南
---

# 命令系统

斜杠命令模块位于 [apps/desktop/src/main/command/](apps/desktop/src/main/command/)，负责在 Agent 状态机的 `COMMAND` 阶段拦截和处理 `/xxx` 命令。

## 三层路由表

`CommandRouter` 实现三层匹配优先级：

```
priority > exact > prefix（最长前缀优先）
```

| 层级 | 注册方法 | 匹配方式 | 用途 | 示例 |
|------|----------|----------|------|------|
| `priority` | `router.priority()` | Map 精确匹配 | 在会话锁外处理，优先拦截 | `/stop` |
| `exact` | `router.exact()` | Map 精确匹配 | 无参数命令 | `/help`、`/new`、`/status` |
| `prefix` | `router.prefix()` | 最长前缀优先 | 带参数命令 | `/model gpt-4`、`/history 10` |

路由流程：
1. `isPriority(text)` → 是优先命令 → `dispatchPriority()`
2. `isDispatchableCommand(text)` → 是可调度命令 → `dispatch()`
3. 都不是 → 返回 `null`，交给 LLM 处理

## 内置命令 (9个)

| 命令 | 路由类型 | Handler | 说明 |
|------|----------|---------|------|
| `/stop` | priority | `cmdStop` | 停止当前 Agent 生成 |
| `/new` | exact | `cmdNew` | 开始新会话 |
| `/status` | exact | `cmdStatus` | 查看当前状态 |
| `/help` | exact | `cmdHelp` | 显示帮助 |
| `/compact` | exact | `cmdCompact` | 手动压缩上下文 |
| `/dream` | exact | `cmdDream` | 手动触发记忆巩固 |
| `/dream-log` | exact | `cmdDreamLog` | 查看最近巩固日志 |
| `/heartbeat` | exact | `cmdHeartbeat` | 立即执行心跳检查 |
| `/model` | prefix | `cmdModel` | 切换模型（带参数） |
| `/history` | prefix | `cmdHistory` | 查看历史（带参数） |

## CommandContext

每个 handler 接收 `CommandContext`：

```typescript
interface CommandContext {
  raw: string          // 原始文本（如 "/model gpt-4"）
  args: string         // 参数部分（prefix 匹配时自动提取）
  sessionKey: string   // 当前会话键
  channel: string      // 来源通道
  senderId: string     // 发送者ID
}
```

Handler 返回 `OutboundMessage`（同步或异步均可）。

## 在状态机中的位置

`AgentLoop` (loop.ts) 在 `COMMAND` 状态执行：

```
RESTORE → COMPACT → COMMAND → BUILD → RUN → ...
                            │
                            ├── /stop → 直接返回 DONE
                            ├── 其他命令 → dispatch → RESPOND → DONE
                            └── 非命令 → 继续 BUILD → RUN
```

## 添加新命令

1. 在 `command/handlers/` 中创建 handler 文件：

```typescript
// handlers/mycommand.ts
import type { CommandContext } from "../context"
import type { OutboundMessage } from "@catbuddy/shared"

export async function cmdMyCommand(ctx: CommandContext): Promise<OutboundMessage> {
  return {
    channel: ctx.channel,
    chatId: ctx.senderId,
    content: `执行了 mycommand，参数: ${ctx.args}`,
    timestamp: Date.now(),
  }
}
```

2. 在 `command/builtin.ts` 中注册：

```typescript
import { cmdMyCommand } from "./handlers/mycommand"

export function registerBuiltinCommands(router: CommandRouter): void {
  // ... 已有注册 ...
  router.exact("/mycommand", cmdMyCommand)
}
```

3. 如需带参数，使用 `prefix` 注册：

```typescript
router.prefix("/mycommand ", cmdMyCommand)
router.prefix("/mycommand", cmdMyCommand)  // 无参也匹配
```

## 关键文件

| 文件 | 作用 |
|------|------|
| [command/router.ts](apps/desktop/src/main/command/router.ts) | 三层路由表实现 |
| [command/builtin.ts](apps/desktop/src/main/command/builtin.ts) | 内置命令注册 |
| [command/context.ts](apps/desktop/src/main/command/context.ts) | CommandContext 类型定义 |
| [command/types.ts](apps/desktop/src/main/command/types.ts) | CommandSpec 等类型 |
| [command/handlers/](apps/desktop/src/main/command/handlers/) | 9个命令处理器 |
