# 13｜Agent 的文件读写，远不止 `fs.readFile` 那么简单

> 这是 CatBuddy 技术专栏的第 13 篇。上篇讲了命令路由——`/stop`、`/model` 这些斜杠命令怎么在 Agent Loop 里被优先路由和执行。这篇聊聊 Agent 最核心的能力——文件读写。Agent 要帮你改代码，就得读文件、写文件、编辑文件。但直接开个 `fs` 给它用？那跟把家门钥匙交给陌生人有啥区别。本文拆解 `read_file`、`write_file`、`edit_file` 怎么在一个可控的安全边界内工作。

> **核心问题**：Agent 怎么安全地读写用户文件？PathGuard 怎么画边界？`edit_file` 为什么坚持"精确字符串替换"？FileEditEvent 的三阶段通知机制是怎么让 UI 实时看到文件变更的？

> **本文配图**：PathGuard 边界示意图 + FileEditEvent 三阶段时序图 + tools/ 目录结构图

---

## 0. 开篇钩子

你有没有想过一个问题：当 AI 说"我来帮你改这个文件"，它到底经历了什么？

表面上看，Agent 调用了一个叫 `write_file` 的工具。但"写入文件"这件事，在 AI 编程助手里其实是一整套安全机制的组合：路径校验、读写追踪、变更通知、UI 实时反馈。少了任何一环，要么不安全，要么体验糟糕。

CatBuddy 的文件工具系统，代码量不大——三个核心工具加起来不到 300 行——但每一行都是设计决策的结果。这篇就把它拆开看看。

---

## 15.1 工具的"插头"：Factory Pattern + ToolContext

先聊架构。CatBuddy 内置了 15 个工具，全都注册在 `builtin.toolFactories` 这个数组里：

```ts
// apps/desktop/src/main/agent/tools/builtin.ts
export const builtinToolFactories: ToolFactory[] = [
  createReadFileTool,
  createWriteFileTool,
  createEditFileTool,
  createListDirTool,
  createGrepTool,
  createExecTool,
  // ... web_search, web_fetch, exec_session, generate_image 等
]
```

每一个工具都是**工厂函数**，不是直接 new 出来的类。为什么这么设计？因为所有文件工具都依赖同一个运行时上下文——`ToolContext`：

```ts
// apps/desktop/src/main/agent/tools/types.ts
export interface ToolContext {
  readonly workRoot: string              // 工具的工作目录
  readonly workspace: string             // CatBuddy 内部目录
  readonly fileStates: FileStates        // 文件读写状态追踪器
  resolvePath(inputPath: string): string // PathGuard 安全解析
  displayPath(resolved: string): string  // 相对路径显示
  notifyFileEdit(edit: FileEditEvent): Promise<void>  // UI 通知
  lineDelta(before: string, after: string): { added: number; deleted: number }
}
```

这个 `ToolContext` 就是工具的"插头"。工厂函数接到它，马上就能造出一个能用的工具。所有工具共享同一份上下文，但每个工具只关心自己需要的字段。

`ToolRegistry` 在启动时遍历工厂数组，注入上下文，注册到 `Map<string, Tool>` 里。后续 Agent 说"我要调 `read_file`"，`ToolRegistry.execute(call)` 就直接从 Map 里取出工具执行。

> **为什么不用类继承？** 工具之间没有 is-a 关系。`read_file` 不是 `write_file` 的子类。工厂函数 + 接口注入更轻、更灵活——加一个新工具只需要写一个函数文件，然后在数组里加一行。

---

## 15.2 PathGuard：Agent 能碰哪些文件，不归它自己说了算

这是整个文件工具系统里最重要的安全机制。Agent 可以读文件、写文件、跑命令——但如果它想读 `~/.ssh/id_rsa` 或者 `/etc/passwd`，必须被拦住。

CatBuddy 的安全策略分两种模式：

- **project 模式**：Agent 可以访问整个项目根目录（`.catbuddy` 的父目录）。正常使用场景。
- **internal 模式**：Agent 只能访问 `.catbuddy/workspace` 内部。当用户主目录或其他敏感路径被加载时触发。

```ts
// apps/desktop/src/main/security/path-guard.ts
get workRoot(): string {
  return this.mode === "internal" ? this.workspace : this.projectRoot
}

get boundary(): string {
  return this.mode === "internal" ? this.workspace : this.projectRoot
}
```

每次工具执行前，路径都会经过 `PathGuard.resolve()`：

```ts
resolve(inputPath: string): string {
  const resolved = path.isAbsolute(inputPath)
    ? path.resolve(inputPath)
    : path.resolve(this.workRoot, inputPath)
  this.assertAllowed(resolved, inputPath)
  return resolved
}
```

`assertAllowed` 做了两重检查：

1. **边界检查**：解析后的路径必须在 `boundary` 之内。不在？直接抛错 `Access denied`。
2. **猫窝禁区**：`.catbuddy` 元数据目录（存 session、skill 等内部状态）绝对不让 Agent 碰——即使它在 project 根目录下。

```ts
if (insideCatbuddy && (this.mode !== "internal" || !insideInternalWorkspace)) {
  throw new Error(`Access denied: "${label}" is inside ${CATBUDDY_DIR_NAME}`)
}
```

> **一句话总结 PathGuard 的设计哲学**：Agent 能看到的文件系统范围是一个"圈"，圈的大小由安全策略决定，但圈里的 `.catbuddy` 永远是禁区。

---

## 15.3 `read_file`：读可以，但别傻乎乎重复读

`read_file` 看起来简单——打开文件、读内容、返回。但实际上它多做了两件事：**去重**和**状态记录**。

```ts
// apps/desktop/src/main/agent/tools/read-file.ts
const states = currentFileStates(ctx.fileStates)

if (states.isUnchanged(resolved, off, lim)) {
  return 'File unchanged since last read at the same offset/limit.'
}

const content = fs.readFileSync(resolved, 'utf-8')
const lines = content.split('\n')
const slice = lines.slice(off, lim != null ? off + lim : undefined)
states.recordRead(resolved, off, lim)
return slice.join('\n')
```

如果 Agent 短时间内用同样的 offset/limit 参数读了同一个文件，而且文件内容没变——直接返回"文件没变，别重复读了"。这对 LLM 来说既省 token，又避免了它在循环里反复读同一个文件。

`isUnchanged` 的逻辑很严谨：

1. 查有没有这个文件的读记录（`mtime` + `contentHash`）
2. 如果 offset/limit 跟上次不一样 → 不算重复
3. 如果 `mtime` 变了但 hash 一样（比如 `touch` 了一下）→ 算重复，但不再允许后续去重（`canDedup = false`）
4. 如果 `mtime` 没变但 hash 不一样（极罕见）→ 不算重复，返回警告

去重标志 `canDedup` 一旦置为 `false`，整个 session 内这个文件就不再享受去重待遇——宁可多读一次，不能漏掉真正的修改。

---

## 15.4 `write_file`：创建或覆盖，但要通知 UI

`write_file` 的执行流程可以概括为三个阶段，每个阶段都会通过 `notifyFileEdit` 通知 UI：

**阶段 1：start** — "我要开始写了"
```ts
void ctx.notifyFileEdit({
  call_id: call.id,
  tool: 'write_file',
  path: display,
  phase: 'start',
  status: 'editing',
  added: 0, deleted: 0,
})
```

**阶段 2：写入 + 计算差异**

```ts
const before = fs.existsSync(resolved) ? fs.readFileSync(resolved, 'utf-8') : ''
fs.mkdirSync(path.dirname(resolved), { recursive: true })
fs.writeFileSync(resolved, after, 'utf-8')
currentFileStates(ctx.fileStates).recordWrite(resolved)
const { added, deleted } = ctx.lineDelta(before, after)
```

几个细节值得注意：

- `mkdirSync` 带 `recursive: true`——Agent 可以创建不存在的目录层级
- 写入后立即调用 `recordWrite`——更新 `FileStates`，让后续的 `read_file` 去重逻辑知道"这个文件已经被改过了"
- `lineDelta` 用行数差异近似表示变更量——不是精确 diff，但对 UI 展示足够用

**阶段 3：end（成功）或 error（失败）**

```ts
await ctx.notifyFileEdit({
  ...base,
  phase: 'end',
  status: 'done',
  added: before === '' ? after.split('\n').length : added,
  deleted: before === '' ? 0 : deleted,
  approximate: before !== '',  // 编辑已有文件时，行数差异只是近似值
})
```

特别处理了**新建文件**和**覆盖已有文件**两种情况：新建时 `added` 直接取新文件行数，不调用 `lineDelta`（因为 "之前" 是空字符串）。`approximate: true` 的含义是：UI 显示的 "+3 -1" 只是近似值，实际修改可能更复杂。

---

## 15.5 `edit_file`：我只要你替换**恰好一处**

`edit_file` 是三个工具里最"龟毛"的一个，也是设计意图最明确的一个。它不使用行号、不用范围标记，只接受三个参数：

- `path`：文件路径
- `old_string`：要被替换的**精确文本**
- `new_string`：替换后的文本

执行流程的核心是这段：

```ts
const count = content.split(old).length - 1
if (count === 0) {
  return 'Error: old_string not found in file'
}
if (count > 1) {
  return `Error: old_string matches ${count} times — must be unique. Provide more context.`
}
const updated = content.replace(old, neu)
```

**必须恰好匹配一次。** 零次不行，两次也不行。

这个约束背后的设计意图是：**防止 AI 误伤**。LLM 很容易生成一个模糊的 `old_string`（比如只给一行 `import React`），如果文件里有多个 `import React`，不报错的话会全部替换掉——灾难。

通过强制唯一匹配，CatBuddy 倒逼 LLM 给出足够上下文。比如 LLM 不能只写：

```
old_string: "import React"
```

而必须写成：

```
old_string: "import React\nimport { useState } from 'react'\n\nfunction App() {"
```

给三行上下文，基本就能保证唯一匹配了。

**还有一个安全检查**：`edit_file` 在真正编辑前会调用 `checkRead`：

```ts
const warning = currentFileStates(ctx.fileStates).checkRead(resolved)
```

如果 Agent 在编辑一个它之前**没读过**的文件，会收到警告："Warning: file has not been read yet. Read it first to verify content before editing." 这个警告不会阻止编辑，但会作为提示返回给 LLM，让 LLM 自己决定是否继续。

---

## 15.6 FileEditEvent：一场跨越三个层次的旅行

文件编辑不只是"写完"就完了。从工具执行到用户看到界面上的 "+5 -2" 气泡，`FileEditEvent` 经历了一段旅程：

```
Tool.execute()
  → ctx.notifyFileEdit({ phase: 'start' })
  → ToolRegistry.notifyFileEdit()
  → _fileEditCallback (AgentLoop 注册的回调)
  → Gateway Channel → WebSocket 'file_edit' 事件
  → useCatbuddyStream hook → mergeFileEditIntoTrace()
  → AgentActivityCluster (UI 展示 +5/-2 动画)
```

来看 `FileEditEvent` 的结构：

```ts
// packages/shared/src/agent-types.ts
export interface FileEditEvent {
  version?: number
  call_id: string        // 关联到哪个 tool_call
  tool: string           // 'write_file' | 'edit_file' | ...
  path: string           // 相对路径，UI 展示用
  absolute_path?: string // 绝对路径，实际操作用
  phase?: 'start' | 'end' | 'error'  // 三阶段标记
  added: number          // 新增行数
  deleted: number        // 删除行数
  approximate?: boolean  // true 表示行数差异是近似值
  status: 'editing' | 'done' | 'error'
  error?: string
}
```

**三阶段设计**解决了什么问题？

- `start` → UI 立即显示"正在编辑 `src/App.tsx`..."——不用等文件写完
- `end` → UI 更新为 "+15 -3" 的量化结果——用户一眼看到改了多少
- `error` → UI 显示红色错误——"文件不存在"、"权限不足"、"old_string 匹配了 3 次"

没有这个三阶段设计，用户只能在编辑完成后才知道发生了什么——体验上差了一个维度。

---

## 15.7 FileStates：跨工具的"记忆"

`edit_file` 里有一行看起来有点奇怪的代码：

```ts
currentFileStates(ctx.fileStates).checkRead(resolved)
```

`currentFileStates` 是什么？它用到了 Node.js 的 `AsyncLocalStorage`：

```ts
// apps/desktop/src/main/agent/tools/file_state.ts
const _currentFileStates = new AsyncLocalStorage<FileStates | undefined>()

export function currentFileStates(defaultStates: FileStates): FileStates {
  return _currentFileStates.getStore() ?? defaultStates
}
```

`AsyncLocalStorage` 是 Node.js 提供的"请求级全局变量"。在同一轮 Agent Loop 的多次工具调用中，它保证 `FileStates` 是同一个实例——`read_file` 记录的状态，`edit_file` 能读到。

`FileStates` 本身是一个 `Map<string, ReadState>`，记录每个文件的 `mtime`、`contentHash`、`offset`、`limit` 和 `canDedup` 标志。核心方法就三个：

| 方法 | 触发时机 | 作用 |
|---|---|---|
| `recordRead(filePath)` | `read_file` 成功后 | 记录 mtime + hash，开启去重 |
| `recordWrite(filePath)` | `write_file` / `edit_file` 成功后 | 更新 mtime + hash，**关闭去重** |
| `checkRead(filePath)` | `edit_file` 执行前 | 检查是否读过，返回警告（如果有） |
| `isUnchanged(filePath)` | `read_file` 去重判断 | 文件 mtime 和 hash 都没变？跳过读取 |

`recordWrite` 里 `canDedup = false` 是关键——文件被自己改过之后，不再享受重复读取优化。这是对的：万一 Agent 先写了文件 A，又在同一轮循环里想读文件 A，它应该拿到最新内容，而不是"文件没变"的虚假信息。

---

## 15.8 `exec` 工具的安全补丁：不只是跑个 `child_process`

顺便看一眼 `exec` 工具的安全机制——虽然它不是文件编辑工具，但它也能动文件系统。

```ts
// apps/desktop/src/main/agent/tools/exec.ts
// 危险命令黑名单
const dangerous = /\brm\s+-rf\b|\bformat\b|\bdd\b|\bmkfs\b|\b:\(\)\b|\bchmod\s+777\b/i
if (dangerous.test(cmd)) return 'Error: dangerous command blocked'

// SSRF 防护：内网 URL
if (containsInternalUrl(cmd)) return 'Error: command contains blocked internal URL'
```

黑名单 + 内网 URL 检测——简单但有效。真正要防的不是 LLM 有恶意（它没有），而是 LLM 可能"不小心"生成危险命令。比如你让它"清空临时文件"，它可能写了个 `rm -rf /tmp/*`，结果路径拼错了变成 `rm -rf / tmp/*`。

其他安全措施：
- **超时限制**：默认 30 秒，最大 120 秒——防止死循环命令
- **输出截断**：stdout 最多 10000 字符，stderr 最多 5000——防止 LLM 被输出淹没
- **缓冲区限制**：`maxBuffer: 100 * 1024`——100KB 上限
- **`windowsHide: true`**——Windows 上不弹黑框

---

## 15.9 工具系统全景：三个层次一张图

把前面讲的串起来，文件工具系统有三层：

```
┌─────────────────────────────────────────────┐
│                 Agent Loop                   │
│  调用 ToolRegistry.execute(call) → 拿到结果  │
└──────────────────┬──────────────────────────┘
                   │
┌──────────────────▼──────────────────────────┐
│              ToolRegistry                    │
│  ┌────────┐ ┌────────┐ ┌────────┐           │
│  │read_file│ │write_file│ │edit_file│  ...   │
│  └───┬────┘ └───┬─────┘ └───┬─────┘         │
│      │          │           │                │
│      └──────────┼───────────┘                │
│                 │                            │
│     ┌───────────▼───────────┐                │
│     │       ToolContext      │               │
│     │  resolvePath(PathGuard)│               │
│     │  notifyFileEdit(cb)    │               │
│     │  fileStates(ALS)       │               │
│     └───────────────────────┘                │
└──────────────────┬──────────────────────────┘
                   │
┌──────────────────▼──────────────────────────┐
│              安全基础设施                      │
│  ┌──────────┐  ┌──────────────┐              │
│  │PathGuard │  │ FileStates   │              │
│  │边界检查   │  │ 读/写追踪     │              │
│  │猫窝禁区   │  │ 去重 + 警告   │              │
│  └──────────┘  └──────────────┘              │
└─────────────────────────────────────────────┘
```

Agent 在最上层发号施令，ToolRegistry 在中间层协调调度，PathGuard + FileStates 在底层保驾护航。三个层次各司其职，改任何一层都不影响其他两层。

---

> **这篇讲了什么？**
>
> 1. CatBuddy 的文件工具系统围绕三个核心工具构建：`read_file` 带智能去重避免 LLM 重复读取，`write_file` 用三阶段 FileEditEvent 让 UI 实时感知变更，`edit_file` 强制精确唯一匹配防止批量误改。
> 2. PathGuard 是所有文件操作的安全门禁——两种模式（project/internal）、双重检查（边界+猫窝禁区）、零信任原则：每条路径必须经过 `resolve()` 校验才能落地。
> 3. FileStates 通过 `AsyncLocalStorage` 实现跨工具调用的状态共享——读过的文件能去重，没读过就编辑会收到警告，自己改过的文件不再享有去重优化。

> 下一篇进入记忆系统——Agent 产生的所有内容怎么被存储、传输、渲染？先从一个看似简单的类型系统说起：为什么 CatBuddy 要定义三层消息类型？磁盘上一张脸，网络上一张脸，屏幕上一张脸。
