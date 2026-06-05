# 09｜MCP：给 Agent 装上手脚

> 这是 CatBuddy 技术专栏的第 9 篇。上篇讲了 Agent Hook——怎么在不修改 Agent Loop 核心代码的前提下插入自定义行为。这篇聊 MCP——Agent 怎么真正动手干活：读文件、跑命令、操作浏览器。

---

你有没有试过问 ChatGPT："帮我看看桌面上那个 project 文件夹里有个 README 写了什么"？

它做不到。

不是因为 GPT 不够聪明。是因为它没有"手脚"——读不了你的文件，跑不了命令，更别提操作你的浏览器了。LLM 本质上是一个被困在聊天框里的超级大脑。再聪明的大脑，困在缸里也干不了活。

CatBuddy 要解决的问题恰恰是这个：**把 LLM 从聊天框里放出来，让它能真正操作系统、读写文件、搜索网络**。

怎么做到的？靠 MCP。

---

## 6.1 MCP 不是什么黑科技

MCP 全称 Model Context Protocol，是 Anthropic 提出的一个开放协议。名字听起来唬人，本质上就干一件事：**定义一个标准接口，让 LLM 和外部工具互相对话**。

把它想象成 USB 接口。

USB 之前，鼠标插 PS/2 口、打印机插并口、U 盘插串口——每接一个新设备都得换接口。USB 之后，不管你接什么，物理接口和通信协议都是一样的。

MCP 做的是同样的事——不管你给 Agent 接的是文件系统、Shell、浏览器还是数据库，**通信格式都是一个标准**。

```
┌──────────────┐       MCP 协议        ┌──────────────┐
│              │ ◄──────────────────► │              │
│  Agent 客户端  │    list_tools()     │  MCP 服务端    │
│  (CatBuddy)  │    call_tool()      │  (各种工具)    │
│              │    tool_result       │              │
└──────────────┘                      └──────────────┘
```

MCP 定义了三个核心动作：

- **`list_tools()`**：Agent 问服务端"你有什么工具？"服务端返回工具名 + 参数定义。
- **`call_tool()`**：Agent 说"帮我执行这个工具，参数是这些"。服务端执行并返回结果。
- **`tool_result`**：服务端把结果回传给 Agent，Agent 喂回 LLM 继续推理。

就这么简单。协议本身的复杂度全部集中在参数的 JSON Schema 定义上，但核心交互就这三个动作。

---

## 6.2 CatBuddy 的 14 个内置工具

CatBuddy 预装了 14 个工具，分几大类。每个工具都经过精心设计——不仅是"能不能用"，更是"好不好用"。

### 文件操作：读、写、改、列

| 工具 | 干了什么 | 一个让你会心一笑的细节 |
|------|----------|------------------------|
| `read_file` | 读文件，支持分页 | 同一会话重复读同一位置，返回 "File unchanged"——避免 LLM 陷入"反复读同一个文件"的死循环 |
| `write_file` | 创建或覆盖文件 | 写完 .drawio 文件会自动触发图表渲染 |
| `edit_file` | 精确字符串替换 | 执行前检查文件是否被读过——"没读就想改？先读一遍确认内容" |
| `list_dir` | 列目录 | 自动标注 `[DIR]`/`[FILE]`/`[LINK]` |

### 搜索

| 工具 | 干了什么 | 细节 |
|------|----------|------|
| `grep` | 全文搜索 | 自动读 `.gitignore` 跳过不关心的文件、二进制检测、异步并发遍历。不是简单的 `child_process.exec('grep')`，而是手写的 Node.js 搜索器 |

### 命令执行

| 工具 | 干了什么 | 细节 |
|------|----------|------|
| `exec` | 一次性命令 | 超时 30-120s，输出自动截断（stdout 10KB / stderr 5KB），防止回传结果撑爆上下文 |
| `exec_session` | 长时间命令 | `start` 返回 session_id，`poll` 轮询输出。适合 `npm install` 这种跑好几分钟的任务 |

### 网络

| 工具 | 干了什么 | 细节 |
|------|----------|------|
| `web_fetch` | 抓取网页 | 走 HTML→文本提取，带 SSRF 防护（检查 DNS 返回的 IP 是否是内网地址） |
| `web_search` | 搜索网页 | 走 DuckDuckGo Lite。重复搜索同一关键词最多 2 次，防止 LLM 在搜索结果里死循环 |

### 图表（Draw.io）

| 工具 | 干了什么 | 
|------|----------|
| `display_diagram` | 创建新图表 |
| `append_diagram` | 追加元素（当单次输出因长度截断时） |
| `edit_diagram` | 精确修改、添加、删除 cell |
| `get_shape_library` | 查图标库（AWS、K8s、Flowchart……） |

### 特殊能力

| 工具 | 干了什么 |
|------|----------|
| `generate_image` | 走 DALL-E 3 生成图片 |
| `spawn` | 派生子 Agent 处理后台任务 |

---

## 6.3 安全：Agent 不是 root 用户

给 AI 开 Shell 权限是一件危险的事。但 CatBuddy 不是给 Agent 开 `sudo`，它有三层防护。

### 第一层：PathGuard——你只能碰项目文件

Agent 调用 `read_file`、`write_file` 时，路径不是原样传给 `fs.readFile`。所有路径必须先经过 `PathGuard.resolvePath()`：

```
用户输入: "../../../etc/passwd"
                ↓
PathGuard: "越界了，拒绝。你只能在项目目录里活动"
                ↓
返回错误: "Path is outside workspace"
```

PathGuard 有两种模式：
- **internal**：只能碰 `.catbuddy/workspace/` 内部，用于沙箱场景
- **project**：可以碰项目目录下的所有文件，但 `.catbuddy/` 配置目录仍然保护

### 第二层：命令过滤——rm -rf 不能跑

`exec` 工具在真正执行前会扫描命令字符串：

```typescript
const DANGEROUS = ['rm -rf', 'format', 'dd if=', 'mkfs', 'fork bomb'];
// 如果命令包含危险模式 → 拒绝执行
```

这不是完美的沙箱——有经验的攻击者总能有办法绕过字符串过滤。但它是**防御性第一道门**：防止 LLM 在不知情的情况下执行破坏性命令（比如你问"怎么清理 node_modules"，LLM 可能顺手写了一个 `rm -rf /`）。

### 第三层：SSRF 防护——不能抓取内网地址

`web_fetch` 在请求 URL 之前，先做 DNS 解析，检查返回的 IP：
- 私有地址（10.x, 172.16.x, 192.168.x）→ 拒绝
- 回环地址（127.x）→ 拒绝
- 元数据地址（169.254.169.254，云服务器的 credential 端点）→ 拒绝

这是标准的 SSRF 防护策略——你不能让 Agent 去抓 `http://169.254.169.254/latest/meta-data/`。

---

## 6.4 一次工具调用的完整旅程

串一下——当 Agent 决定使用工具时，发生了什么。

```
LLM 输出: tool_call { name: "read_file", args: { path: "src/index.ts" } }
         │
         ▼
┌─ AgentRunner ────────────────────────────────────────┐
│                                                       │
│  ① Preflight 校验                                      │
│     "参数对吗？path 是字符串吗？"                        │
│     (图表类工具额外校验 XML 格式)                         │
│                                                       │
│  ② 安全检查                                            │
│     PathGuard.resolvePath("src/index.ts")              │
│     → "/Users/xxx/project/src/index.ts" ✓ 合法          │
│                                                       │
│  ③ 执行工具                                            │
│     tool.execute(call)                                 │
│     → fs.readFile → 返回文件内容                         │
│                                                       │
│  ④ 结果截断                                            │
│     如果结果 > 8000 字符 → 截断 + "...[truncated]"      │
│     (防止 100KB 的日志文件撑爆 LLM 上下文)               │
│                                                       │
│  ⑤ 构造消息                                            │
│     assistant 消息 { toolCalls: [...] }                │
│     tool 消息     { role: "tool", content: "..." }      │
│                                                       │
│  ⑥ 通知 UI                                            │
│     "read_file 执行完成" → 渲染工具调用气泡               │
│                                                       │
│  ⑦ 下一轮 LLM 调用                                     │
│     上下文已包含文件内容 → LLM 基于真实数据继续推理        │
│                                                       │
└───────────────────────────────────────────────────────┘
```

有一个细节值得单独讲：**结果截断不是 bug，是 feature**。

当你让 Agent 读一个 5000 行的日志文件，它在 LLM 上下文里会吃掉 10 万 token。如果不截断，两三轮之后你的上下文窗口就满了。截断到 8000 字符后，Agent 可能会说"结果被截断了，让我用 `read_file` 的 offset 参数再读后面的部分"——然后它真的会用分页参数精准读取。这比一次性把 5000 行全塞进去更高效。

---

## 6.5 MCP Marketplace：不只是内置工具

内置的 14 个工具覆盖了最常见的需求。但 CatBuddy 的工具系统是**可扩展的**——通过 MCP 协议，第三方开发者可以为 CatBuddy 开发新的工具包。

CatBuddy 在配置里预置了 8 个可以一键启用的 MCP 服务：

| 工具 | 类型 | 需要配置吗 |
|------|------|-----------|
| 文件系统 | 本地文件操作 | ❌ 一键启用 |
| 记忆 | 长期记忆 | ❌ 一键启用 |
| 顺序思考 | 复杂推理 | ❌ 一键启用 |
| MCP 诊断 | 调试工具 | ❌ 一键启用 |
| GitHub | 操作仓库 | ✅ 需要 Token |
| Brave 搜索 | 网页搜索 | ✅ 需要 API Key |
| 飞书/Lark | 操作文档 | ✅ 需要 App 凭据 |
| 腾讯文档 | 操作文档 | ✅ 需要远程 HTTP |

MCP 工具的注册流程：

```
MCP 配置 → 启动子进程 (stdio 通信) → list_tools() → 注册到 ToolRegistry
                                                              │
                                      每个外部工具被包装为 Tool 接口
                                      name: "mcp_{server}_{tool}"
```

一个 `ToolRegistry.register()`，MCP 工具和内置工具就完全平等了——Agent 不关心工具是内置的还是外部 MCP 提供的。它只关心这个工具的 `name` 和 `description`。

---

## 6.6 为什么选 MCP 而不是自己定义一套？

我们最开始考虑过自己设计一个工具接口。一个 `interface Tool { name, schema, execute }`，10 行代码写完。

但自己定义意味着：
- 工具开发者要学 CatBuddy 的工具规范
- 已有的 MCP 生态（上百个开源 MCP 服务器）全部无法用
- 编辑器、其他 AI 工具之间的工具无法互通

选 MCP 本质上是**放弃了"重新发明轮子"的诱惑**——虽然自己写一个工具接口只需半天，但接入 MCP 生态的价值远超这半天工时。现在 CatBuddy 可以对接任何实现了 MCP 协议的服务，不管是文件系统、数据库还是云服务 API。

---

> **这篇讲了什么？**
>
> 1. MCP 是一个标准协议，让 LLM 和外部工具用统一接口对话——像 USB 一样，插上就能用。
> 2. CatBuddy 内置了 14 个工具，覆盖文件、搜索、命令、网络、图表、图片。每个工具都有精心设计的边界——结果截断、读去重、编辑前检查。
> 3. 三层安全防护：PathGuard 限制文件访问范围、命令过滤拦截危险操作、SSRF 防护阻止内网抓取。Agent 有手脚，但不是 root 权限。

> 下一篇聊 Skill 技能系统。MCP 给了 Agent 螺丝刀和扳手，但怎么让它"会组装一个柜子"？Skill 做的就是这件事——把原子工具组合成有步骤、有提示词的完整工作流。
