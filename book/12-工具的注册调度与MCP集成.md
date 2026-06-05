# 11｜工具的注册、调度与 MCP 集成——15 个内置工具和一个"万能插槽"

> 这是 CatBuddy 技术专栏的第 11 篇。上篇讲了 Skill 技能系统——怎么让 Agent 把原子工具组合成完整套路。这篇往上走一层——15 个内置工具和外部 MCP 工具怎么在同一个 Registry 里注册、查找、执行？Agent 说"我要调 grep"，这条指令经历了什么才变成搜索结果？

> **核心问题**：ToolRegistry 的内部实现是怎样的？MCP 外部工具怎么和内置工具"同台竞技"？从 LLM 输出 tool_call 到拿到 tool_result，中间经过了哪些环节？

> **本文配图**：ToolRegistry 架构图 + MCP 工具注册时序图 + 工具执行全链路流程图

---

## 0. 开篇钩子

给 Agent 装工具，听起来是加几个函数的事。但当你同时有 15 个内置工具、可能还有 3-5 个 MCP 外部工具，它们要共存在同一个命名空间里，不能冲突，不能互相覆盖，LLM 还不能搞混——这事就变得有意思了。

CatBuddy 的工具系统用一个不到 200 行的 `ToolRegistry` 解决了注册和调度，用一个 `McpManager` 搞定了外部工具的动态接入。更妙的是，两者对 LLM 来说完全透明——LLM 不知道也不关心 `grep` 是内置的还是 MCP 服务器提供的。

这篇就把这套机制拆开看看。

---

## 16.1 ToolRegistry：一个 Map，三个职责

`ToolRegistry` 的核心数据结构简单到只有一行：

```ts
export class ToolRegistry {
  private readonly _tools = new Map<string, Tool>()
  // ...
}
```

一个 `Map<string, Tool>`，key 是工具名，value 是 `Tool` 接口。但围绕这个 Map，Registry 承担了三个职责：

**职责一：注册中心。** 内置工具通过 `registerBuiltinTools()` 批量注入，MCP 工具通过 `register(tool)` 逐个注入。每个工具都是一个工厂函数的产物，共享同一份 `ToolContext`。

```ts
registerBuiltinTools(): void {
  const ctx = this.createToolContext()
  for (const factory of builtinToolFactories) {
    this.register(factory(ctx))
  }
}
```

工厂列表 `builtinToolFactories` 是一个数组，按顺序排列了 15 个工厂函数。**注册顺序就是 LLM 看到的工具定义顺序**——虽然对 LLM 来说顺序不重要，但对调试日志来说保持一致很有用。

**职责二：查找引擎。** `get(name)` 就是 `Map.get(name)`，O(1) 精确匹配。没有模糊搜索、没有别名系统、没有优先级。LLM 必须输出精确的工具名，registry 不做任何"猜测"。

**职责三：安全门面。** `resolvePath(inputPath)` 委托给 `PathGuard.resolve()`，所有工具共享同一个路径解析入口。`notifyFileEdit(edit)` 委托给 Agent Loop 注册的回调，经 Gateway Channel 推送到 UI。

```ts
createToolContext(): ToolContext {
  return {
    get workRoot() { return thisRegistry._pathGuard!.workRoot },
    resolvePath: (input) => this.resolvePath(input),
    notifyFileEdit: (edit) => this.notifyFileEdit(edit),
    // ...
  }
}
```

`workRoot` 用 getter 而非直接值——这很重要。当用户切换项目目录时，`PathGuard` 被重建（`reanchorProject`），新路径自动生效，无需重启 Registry。

---

## 16.2 工具的执行流程：从 tool_call 到 tool_result

当 LLM 返回一个 `tool_use` 块后，发生了一系列事情。完整链路是：

```
LLM 返回 tool_use
  → AgentRunner 解析 toolCall
  → toolCallPreflightError() 预检
    → 通过：ToolRegistry.execute(call)
      → Map.get(call.name) → Tool.execute(call)
        → 成功：结果 truncate → 追加到 messages
        → 失败：捕获异常 → 包装为 Error 字符串
    → 不通过：直接构造错误 tool_result（不调用工具）
  → tool_result 作为 'tool' 角色消息追加到对话
  → 下一轮 LLM 调用时带上 tool_result
```

关键代码在 `AgentRunner.run()` 的工具执行循环里：

```ts
for (const toolCall of activeCalls) {
  // 1. 预检
  const preflightError = toolCallPreflightError(toolCall)
  if (preflightError) {
    messages.push({
      role: 'tool',
      toolCallId: toolCall.id,
      content: preflightError,  // 作为 tool_result 返回，LLM 会看到
    })
    continue  // 不调用工具
  }

  // 2. 执行
  let result: string
  try {
    result = await spec.tools.execute(toolCall)
  } catch (err) {
    result = `Error: ${err.message}`
  }

  // 3. 截断 + 追加
  const truncated = result.length > spec.maxToolResultChars
    ? result.slice(0, spec.maxToolResultChars) + '\n...[truncated]'
    : result || `(${toolCall.name} completed)`

  messages.push({
    role: 'tool',
    toolCallId: toolCall.id,
    name: toolCall.name,
    content: truncated,
  })
}
```

几个设计要点：

- **预检在 Registry 之外**——`toolCallPreflightError` 是 runner 层的逻辑，不是 registry 的职责。目前只对 `display_diagram` 做 XML 格式验证。其他工具的参数校验由工具自身的 `execute()` 内部完成。
- **结果截断**——`maxToolResultChars` 是可配置的，防止 grep 返回几万行结果塞爆 LLM 上下文。
- **异常不中断循环**——一个工具执行失败了，不影响同一个 `tool_use` 里的其他工具（Anthropic 支持并行工具调用）。
- **空结果兜底**——如果工具返回空字符串，自动补成 `(toolName completed)`，避免 LLM 困惑。

---

## 16.3 MCP：外部工具的"万能插槽"

MCP（Model Context Protocol）是 Anthropic 定义的标准协议，让外部进程可以向 AI 暴露工具。CatBuddy 的 `McpManager` 负责管理这些外部工具的完整生命周期。

### 工具命名：`mcp_` 前缀

这是 MCP 工具和内置工具共存的基石。每个 MCP 工具在注册时都会被加上前缀：

```ts
// apps/desktop/src/main/agent/tools/mcp.ts
export function createMcpToolWrapper(
  client: Client,
  serverName: string,
  toolDef: McpToolDef,
): Tool {
  const name = sanitizeMcpName(`mcp_${serverName}_${toolDef.name}`)
  // ...
}
```

比如一个叫 `filesystem` 的 MCP 服务器暴露了 `read_file` 工具，它在 CatBuddy 里的名字就是 `mcp_filesystem_read_file`——跟内置的 `read_file` 不冲突，LLM 也不会搞混。

`sanitizeMcpName` 确保工具名只包含 `[a-zA-Z0-9_-]`，因为 OpenAI/Anthropic API 对工具名有字符限制。

### Schema 归一化

MCP 服务器可能返回各种 JSON Schema 变体（`oneOf`、`anyOf`、`type: ["string", "null"]`），但 OpenAI 的 tool definition 不认这些。`normalizeSchemaForOpenai` 负责把它们翻译成 OpenAI 能理解的格式：

```ts
// 处理 type: ["string", "null"] → type: "string", nullable: true
const rawType = normalized.type
if (Array.isArray(rawType)) {
  const nonNull = rawType.filter((t) => t !== 'null')
  if (rawType.includes('null') && nonNull.length === 1) {
    normalized.type = nonNull[0]
    normalized.nullable = true
  }
}
```

这是 MCP 集成里最"脏"的代码——不同 MCP 服务器的 schema 风格差异很大，但必须统一成 LLM 能理解的形式。

### 连接生命周期

`McpManager` 管理四个生命周期阶段：

1. **connect**：`connectMcpServers()` 遍历所有配置的 MCP 服务器，逐个启动子进程（`StdioClientTransport`），建立连接，拉取工具列表，包装注册到 `ToolRegistry`
2. **reload**：`mcp_reload` 工具触发——先 `unregisterByPrefix('mcp_')` 清掉所有旧 MCP 工具，再重新连接、注册
3. **disconnect**：关闭所有 MCP 客户端的 stdio 连接
4. **status**：`getServerStatus()` 返回每个服务器的连接状态、工具数、最近的错误

```ts
async reload(registry?: ToolRegistry): Promise<string> {
  await this._disconnectAll()
  // 批量注销所有 mcp_ 前缀的工具
  const removed = this._registry.unregisterByPrefix('mcp_')
  // 重新注册 mcp_reload 工具
  this._registry.register(createMcpReloadTool(this))
  // 重新连接所有 MCP 服务器
  await this._connectAll()
  // ...
}
```

`unregisterByPrefix` 的设计很关键——它让一次 `mcp_reload` 能干净地清掉所有旧工具，不留下"僵尸工具"：

```ts
unregisterByPrefix(prefix: string): string[] {
  const removed: string[] = []
  for (const name of [...this._tools.keys()]) {
    if (name.startsWith(prefix)) {
      this._tools.delete(name)
      removed.push(name)
    }
  }
  return removed
}
```

### 容错：MCP 工具执行的重试

MCP 工具通过网络/stdio 调用外部进程，天然容易出错。`executeMcpTool` 内置了重试机制：

```ts
for (let attempt = 0; attempt < 2; attempt++) {
  try {
    const result = await withTimeout(
      client.callTool({ name: originalName, arguments: args }),
      toolTimeoutS * 1000,
    )
    return formatCallToolResult(result)
  } catch (err) {
    if (errName === 'TimeoutError') {
      return `(MCP tool call timed out after ${toolTimeoutS}s)`
    }
    if (isTransient(err) && attempt === 0) {
      // 瞬态错误（连接断开等），等待 1 秒后重试一次
      await new Promise((r) => setTimeout(r, 1000))
      continue
    }
    return `(MCP tool call failed: ${errName})`
  }
}
```

最多重试一次，只对瞬态错误（`ECONNRESET`、`BrokenPipeError` 等）重试。超时直接返回错误，不重试——超时通常意味着工具本身有问题，重试只会让用户多等 30 秒。

---

## 16.4 grep：当一个工具不只是"正则搜索"

在 15 个内置工具中，`grep` 是代码量最大的一个——400 行。它不仅做正则搜索，还集成了：

**`.gitignore` 感知**：自动从搜索路径的目录链上读取所有 `.gitignore`，匹配的文件自动跳过。LLM 不需要告诉 Agent"跳过 node_modules"，grep 自己知道。

```ts
async function loadGitignoreChain(dir: string): Promise<GitignoreRule[]> {
  // 从根目录到目标目录，逐级读取 .gitignore
  for (let i = 0; i < parts.length; i++) {
    const prefix = parts.slice(0, i + 1).join(path.sep)
    const giPath = path.join(prefix, '.gitignore')
    // 读文件、解析规则
  }
}
```

**异步并发遍历**：`walkDir` 用 `Promise.all(tasks)` 并发扫描子目录，比同步 `readdirSync` 快得多——特别是在 `node_modules` 这些大目录上，异步版本不会阻塞。

**智能二进制检测**：先查扩展名黑名单（`.exe`、`.png`、`.pdf` 等 30+ 种），再过一遍内容（前 4096 字节是否含 `\0`）。双重保险。

**分页支持**：`headLimit` + `offset` 让 Agent 可以分页查看大量搜索结果——"前 10 个匹配"、"第 11-20 个匹配"。对大型代码库搜索特别有用。

**三种输出模式**：`content`（默认，显示匹配行 + 上下文）、`files_with_matches`（只列文件名）、`count`（每文件匹配数）。LLM 可以根据需要选择最省 token 的模式。

这些特性不是一开始就有的，是实际使用中逐步加上的。最早版本的 grep 就是简单的逐文件正则匹配，后来发现 Agent 经常在 `node_modules` 里搜到一堆无关结果，才加了 `.gitignore` 感知。

---

## 16.5 工具系统的"上下文治理"联动

上一篇讲了上下文治理的三层防御。工具系统里也有一个关键联动——`COMPACTABLE_TOOLS`：

```ts
const COMPACTABLE_TOOLS = new Set([
  'read_file', 'exec', 'grep', 'web_search', 'web_fetch', 'list_dir'
])
```

在 `_microcompact` 过程中，这些工具的历史调用结果会被替换为摘要（"`grep` returned 42 matches in 12 files"），而不是保留完整的搜索结果。因为搜索结果通常在下一轮 LLM 思考后就没用了，但会吃掉大量 token。

哪些工具**不能**被压缩？`write_file` 和 `edit_file`。因为它们的调用结果包含了文件路径和修改内容摘要——这些信息在后续对话中可能需要引用。

这个设计说明了一个原则：工具系统不仅要考虑"怎么执行"，还要考虑"执行结果在上下文里怎么存活"。

---

## 16.6 全景：从注册到执行，一条指令的旅程

把前面讲的串起来，Agent 说"帮我搜一下项目里的 TODO"时，系统经历了这些步骤：

```
1. LLM 输出 tool_use: { name: "grep", arguments: { pattern: "TODO" } }

2. AgentRunner 解析 toolCall
   └─ toolCallPreflightError(toolCall) → null (grep 没有预检规则)

3. ToolRegistry.execute(toolCall)
   └─ Map.get("grep") → Tool 实例
      └─ Tool.execute(call)
         └─ executeGrep({ pattern: "TODO", ... }, ctx)
            ├─ loadGitignoreChain(searchPath)     // 读 .gitignore
            ├─ walkDir(searchPath, ...)            // 异步遍历文件
            │  ├─ 跳过 .git, node_modules, .catbuddy
            │  ├─ 跳过 .gitignore 匹配的文件
            │  └─ 跳过二进制文件
            ├─ 对每个文件逐行匹配 "TODO"
            └─ 格式化结果 → "Found 15 matches in 8 files:..."

4. AgentRunner 截断结果 → 追加到 messages
   └─ messages.push({ role: 'tool', content: truncated })

5. 下一轮 LLM 调用，tool_result 作为上下文
   └─ LLM 看到 grep 结果，决定下一步
```

整个过程，LLM 不知道 grep 是内置工具还是 MCP 工具。它只关心"我能调一个叫 grep 的东西，它会返回搜索结果"。这种透明性正是 `ToolRegistry` + `Tool` 接口抽象的价值。

---

> **这篇讲了什么？**
>
> 1. `ToolRegistry` 用一个 `Map<string, Tool>` 管理所有工具——内置的 15 个通过工厂模式批量注册，MCP 外部工具用 `mcp_` 前缀动态接入，两者共存互不干扰。O(1) 精确查找，不做模糊匹配。
> 2. 从 `tool_call` 到 `tool_result` 的执行链路是：预检（runner 层）→ Registry.execute（查 Map）→ Tool.execute（具体逻辑）→ 结果截断 → 追加到 messages。异常不中断并行工具调用，空结果有兜底。
> 3. `McpManager` 管理外部工具的完整生命周期——connect/reload/disconnect/status，包含 Schema 归一化（适配 OpenAI 格式）、瞬态错误重试、按前缀批量注销。`mcp_reload` 工具让 Agent 自己也能触发重连。

> 下一篇聊聊 CatBuddy 的命令系统——`/stop`、`/model`、`/compact` 这些斜杠命令是怎么在 Agent Loop 里被优先路由和执行的？
