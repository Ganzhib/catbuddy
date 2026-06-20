---
name: mcp-integration
description: MCP 协议集成 — 服务管理、工具包装、schema 适配、跨平台兼容
---

# MCP 集成开发

MCP（Model Context Protocol）让 catbuddy Agent 能够连接外部工具服务。核心实现在 [apps/desktop/src/main/agent/tools/mcp.ts](apps/desktop/src/main/agent/tools/mcp.ts)（547行）。

## 架构

```
用户配置 (config.json)        MCP 市场
       │                        │
       ▼                        ▼
  McpManager ──► 启动/停止/重启 MCP Server
       │
       ▼
  StdioClientTransport ──► 子进程通信 (stdio)
       │
       ▼
  normalizeSchemaForOpenai ──► 工具 schema 适配
       │
       ▼
  ToolRegistry ──► LLM 可见的工具列表
```

## McpManager

管理 MCP 服务器的完整生命周期：

```typescript
// 核心方法
class McpManager {
  connect(name: string, config: McpServerConfig): Promise<void>
  disconnect(name: string): Promise<void>
  restart(name: string): Promise<void>
  getTools(): McpToolDef[]                            // 所有服务器工具的合并列表
  getStatus(): McpServerStatus[]                      // 各服务器连接状态
  handleToolCall(name: string, args: unknown): Promise<unknown>  // 路由工具调用
}
```

### 连接流程

1. 读取 `McpServerConfig`（command + args + env）
2. 如果是 Windows，对 shell 启动器做 `cmd.exe /d /c` 包装（见下文）
3. 创建 `StdioClientTransport`，启动子进程
4. 通过 JSON-RPC 协议协商能力
5. 发现服务器提供的工具列表
6. 注册为本地工具（命名：`mcp__<server>__<tool>`）

### 连接失败处理

自动识别瞬时错误（`ECONNRESET`、`ECONNREFUSED`、`BrokenPipeError` 等），瞬时错误会静默跳过，避免向用户告警。

## Windows 兼容

MCP 服务器的 `command` 在各种平台下行为不同，`normalizeWindowsStdioCommand()` 处理：

| 场景 | 处理 |
|------|------|
| `npx`、`pnpm`、`bunx` 等 shell 启动器 | 包装为 `cmd.exe /d /c npx ...` |
| `.cmd`、`.bat` 文件 | 同上 |
| `cmd.exe`、`powershell.exe` | 直接执行，不包装 |
| 普通 `.exe` | 直接执行，不包装 |

同时通过 PATH 解析实际可执行文件路径（`requireWhich`），确认是否需要包装。

## Schema 规范化

`normalizeSchemaForOpenai()` 将 MCP JSON Schema 适配为 OpenAI tool 定义格式：

- 处理 `type: ["string", "null"]` → `type: "string"`, `nullable: true`
- 处理 `oneOf`/`anyOf` 中的 null 分支
- 递归清理嵌套的可空类型

## 工具命名

MCP 工具被注册为 `mcp__<server>__<tool>` 格式。`sanitizeMcpName()` 确保名称只含 `[a-zA-Z0-9_-]`，特殊字符替换为 `_`。

## MCP 配置格式

在 `~/.catbuddy/config/config.json` 或项目配置中：

```json
{
  "mcpServers": {
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": { "GITHUB_PERSONAL_ACCESS_TOKEN": "<token>" }
    }
  }
}
```

## 关键文件

| 文件 | 作用 |
|------|------|
| [tools/mcp.ts](apps/desktop/src/main/agent/tools/mcp.ts) | McpManager + schema 适配 + Windows 兼容 |
| [tools/registry.ts](apps/desktop/src/main/agent/tools/registry.ts) | 将 MCP 工具注册到 ToolRegistry |
| `@modelcontextprotocol/sdk` | MCP SDK（Client + StdioClientTransport） |

## 常见任务

### 添加 MCP 服务器支持

1. 用户在 UI 的 MCP 市场中粘贴 JSON 配置
2. 配置写入 `config.json` 的 `mcpServers` 字段
3. McpManager 自动连接并发现工具
4. 无需重启——下次对话即可使用

### 调试 MCP 连接

```bash
# 查看 MCP 服务器状态
/grep "McpManager"  # 在日志中搜索

# 手动测试 MCP 服务器连接
npx @modelcontextprotocol/inspector
```
