# Command 模块 - 斜杠命令路由

## 为什么需要从 AgentLoop 分离

你现在的代码在 `AgentLoop._state_command()` 里硬编码了所有命令：

```typescript
// loop.ts 第266-422行 — 硬编码的 if/else
if (raw === "/stop") { /* ... */ }
if (raw === "/new")  { /* ... */ }
if (raw === "/status") { /* ... */ }
if (raw === "/history") { /* ... */ }
if (raw === "/model") { /* ... */ }
```

**问题：**
1. 每个命令 ~20 行，300 行的 `_state_command` 不可维护
2. 新增命令要改 AgentLoop 核心代码
3. 无法让插件注册命令
4. 命令处理逻辑和 Agent 逻辑耦合

nanobot 的解决方案：**CommandRouter** — 独立的路由表，AgentLoop 只负责调度。

## 参考架构

```
┌─────────────────────────────────────────────────┐
│  AgentLoop._state_command()                     │
│                                                 │
│  raw = msg.content                              │
│  ctx = CommandContext(msg, session, key, raw)   │
│                                                 │
│  result = await this.commands.dispatch(ctx) ────┤
│       │                                         │
│       ├── result != null → "shortcut" (跳过LLM) │
│       └── result == null → "dispatch" (走LLM)   │
│                                                 │
└─────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────┐
│  CommandRouter                                  │
│                                                 │
│  priority:  { "/stop": handler, "/status": .. } │
│  exact:     { "/help":  handler, "/new": ...  } │
│  prefix:    [("/model ", handler), ...]         │
│                                                 │
│  dispatch(ctx):                                 │
│    cmd = ctx.raw.toLowerCase()                  │
│    if cmd in exact:      return exact[cmd](ctx) │
│    for prefix in prefixes:                      │
│      if cmd.startsWith(p):                      │
│        ctx.args = raw[len(prefix):]             │
│        return prefix_handler(ctx)               │
│    return null  // 不是命令，走 LLM            │
└─────────────────────────────────────────────────┘
```

## 三层路由

| 层级 | 存储 | 何时匹配 | 示例 | 处理位置 |
|------|------|---------|------|---------|
| **priority** | `Map<string, Handler>` | `run()` 锁**外** | `/stop`, `/restart` | 主循环直接处理 |
| **exact** | `Map<string, Handler>` | `_state_command()` 内 | `/help`, `/new` | 状态机 shortcut |
| **prefix** | `Array<[string, Handler]>` | `_state_command()` 内 | `/model gpt-4` | 状态机 shortcut |

**priority 命令的特殊性：** `/stop` 和 `/restart` 必须在会话锁外处理，因为它们需要取消正在运行的任务或重启进程。

## 目录结构

```
electron/
├── command/
│   ├── index.ts           # 导出
│   ├── router.ts          # CommandRouter 路由表
│   ├── context.ts         # CommandContext 类型
│   ├── builtin.ts         # 内置命令注册
│   ├── handlers/          # 各命令处理器
│   │   ├── stop.ts
│   │   ├── new.ts
│   │   ├── status.ts
│   │   ├── history.ts
│   │   ├── model.ts
│   │   └── help.ts
│   └── types.ts           # 类型定义
```

## 核心实现

### CommandContext

```typescript
// electron/command/context.ts
interface CommandContext {
  msg: InboundMessage;
  session: Session | null;
  key: string;        // session key
  raw: string;        // 原始输入（保留大小写）
  args: string;       // 参数部分（router 填充）
  loop: AgentLoop;    // 引用 AgentLoop 获取 model/status 等
}
```

### CommandRouter

```typescript
// electron/command/router.ts
type Handler = (ctx: CommandContext) => Promise<OutboundMessage | null>;

class CommandRouter {
  private _priority = new Map<string, Handler>();
  private _exact = new Map<string, Handler>();
  private _prefix: Array<[string, Handler]> = [];

  priority(cmd: string, handler: Handler): void {
    this._priority.set(cmd, handler);
  }

  exact(cmd: string, handler: Handler): void {
    this._exact.set(cmd, handler);
  }

  prefix(pattern: string, handler: Handler): void {
    this._prefix.push([pattern, handler]);
    // 最长前缀优先
    this._prefix.sort((a, b) => b[0].length - a[0].length);
  }

  // 是否为优先命令（用于主循环锁外判断）
  isPriority(text: string): boolean {
    return this._priority.has(text.trim().toLowerCase());
  }

  // 是否可调度（用于 pending 队列判断）
  isDispatchableCommand(text: string): boolean {
    const cmd = text.trim().toLowerCase();
    if (this._exact.has(cmd)) return true;
    return this._prefix.some(([p]) => cmd.startsWith(p));
  }

  // 分发优先命令（在 run() 主循环中调用）
  async dispatchPriority(ctx: CommandContext): Promise<OutboundMessage | null> {
    const handler = this._priority.get(ctx.raw.toLowerCase());
    return handler ? handler(ctx) : null;
  }

  // 分发命令（在 _state_command 中调用）
  async dispatch(ctx: CommandContext): Promise<OutboundMessage | null> {
    const cmd = ctx.raw.toLowerCase();

    // 1. 精确匹配
    if (this._exact.has(cmd)) {
      return this._exact.get(cmd)!(ctx);
    }

    // 2. 前缀匹配
    for (const [prefix, handler] of this._prefix) {
      if (cmd.startsWith(prefix)) {
        ctx.args = ctx.raw.slice(prefix.length);
        return handler(ctx);
      }
    }

    return null; // 不是命令，交给 LLM 处理
  }

  // 获取所有注册的命令（用于 /help 和命令面板）
  getCommandList(): CommandSpec[] { /* ... */ }
}
```

### 命令处理器示例

```typescript
// electron/command/handlers/stop.ts
export async function cmdStop(ctx: CommandContext): Promise<OutboundMessage> {
  const total = await ctx.loop.cancelSession(ctx.key);
  return {
    channel: ctx.msg.channel,
    chatId: ctx.msg.chatId,
    content: total ? `Stopped ${total} task(s).` : 'No active task to stop.',
    metadata: { ...ctx.msg.metadata },
  };
}

// electron/command/handlers/model.ts
export async function cmdModel(ctx: CommandContext): Promise<OutboundMessage> {
  if (!ctx.args.trim()) {
    // 无参数：显示当前模型
    return {
      channel: ctx.msg.channel,
      chatId: ctx.msg.chatId,
      content: `Current model: \`${ctx.loop.model}\``,
    };
  }
  // 有参数：切换模型
  ctx.loop.setModelPreset(ctx.args.trim());
  return {
    channel: ctx.msg.channel,
    chatId: ctx.msg.chatId,
    content: `Switched to: ${ctx.loop.model}`,
  };
}
```

### 注册内置命令

```typescript
// electron/command/builtin.ts
import { CommandRouter } from './router';
import { cmdStop } from './handlers/stop';
import { cmdNew } from './handlers/new';
import { cmdStatus } from './handlers/status';
import { cmdModel } from './handlers/model';
import { cmdHistory } from './handlers/history';
import { cmdHelp } from './handlers/help';

export function registerBuiltinCommands(router: CommandRouter): void {
  // Priority: 锁外处理
  router.priority('/stop', cmdStop);
  router.priority('/status', cmdStatus);

  // Exact: 精确匹配
  router.exact('/new', cmdNew);
  router.exact('/help', cmdHelp);

  // Prefix: 带参数
  router.prefix('/model ', cmdModel);  // /model gpt-4
  router.prefix('/model', cmdModel);   // /model (无参)
  router.prefix('/history ', cmdHistory);
  router.prefix('/history', cmdHistory);
}

// 命令元数据（用于帮助文本和 UI 命令面板）
export const COMMAND_SPECS: CommandSpec[] = [
  { command: '/new',     title: '新对话',   description: '开始一个全新会话',         icon: 'square-pen' },
  { command: '/stop',    title: '停止任务', description: '取消当前的 Agent 处理',    icon: 'square' },
  { command: '/status',  title: '显示状态', description: '查看模型、会话等运行状态', icon: 'activity' },
  { command: '/model',   title: '切换模型', description: '切换模型预设',             icon: 'brain', argHint: '[preset]' },
  { command: '/history', title: '历史记录', description: '查看最近 N 条对话',        icon: 'history', argHint: '[n]' },
  { command: '/help',    title: '帮助信息', description: '列出所有可用命令',         icon: 'circle-help' },
];
```

### AgentLoop 中的集成

```typescript
// electron/agent/loop.ts — 简化后的 _state_command
private async _state_command(ctx: TurnCtx): Promise<string> {
  const raw = ctx.msg.content.trim();

  const cmdCtx: CommandContext = {
    msg: ctx.msg,
    session: this.sessions.getOrCreate(ctx.sessionKey),
    key: ctx.sessionKey,
    raw,
    args: '',
    loop: this,
  };

  const result = await this.commands.dispatch(cmdCtx);

  if (result !== null) {
    // 命令匹配成功 → 跳过 LLM
    ctx.outbound = result;
    return 'shortcut';  // → DONE
  }

  // 不是命令 → 走正常 LLM 流程
  return 'dispatch';    // → BUILD → RUN → SAVE → RESPOND
}
```

## 对比

| | 当前（硬编码） | 分离后（CommandRouter） |
|---|---|---|
| `_state_command` 行数 | ~160 行 | ~20 行 |
| 新增命令 | 改 loop.ts | 新建 `handlers/xxx.ts` + 一行注册 |
| 测试 | 测整个 AgentLoop | 单独测每个 handler |
| 插件 | 不可能 | `router.exact('/mycmd', handler)` |

## 优先级

**P2** — 先实现 bus（P1），然后分离 command。分离后 AgentLoop 的 `_state_command` 从 160 行降到 20 行。
