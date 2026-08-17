---
name: agent-system
description: Agent 引擎架构 — 状态机、AgentRunner、工具系统、上下文构建、记忆系统、子代理
---

# Agent 引擎架构

Agent 引擎位于 [apps/desktop/src/main/agent/](apps/desktop/src/main/agent/)，是 catbuddy 的核心——在用户本地机器运行，拥有完整的文件系统访问权限。

## 状态机（AgentLoop）

`loop.ts` 实现了核心状态机，状态转换如下：

```
RESTORE → COMPACT → COMMAND → BUILD → RUN → SAVE → RESPOND → DONE
```

| 状态 | 职责 |
|------|------|
| `RESTORE` | 从磁盘加载会话历史和记忆 |
| `COMPACT` | TTL 过期或 token 预算紧张时自动压缩上下文 |
| `COMMAND` | 检查并处理斜杠命令（`/help`、`/clear` 等） |
| `BUILD` | 组装完整 LLM 上下文（系统提示词、消息、工具、MCP） |
| `RUN` | 通过 AgentRunner 执行 LLM 对话 |
| `SAVE` | 持久化会话、运行 Dream 记忆巩固 |
| `RESPOND` | 将出站消息发布到通道 |
| `DONE` | 终态 |

状态转换结果（如 `RESTORE:ok`）决定下一个状态。任何状态的 `:error` 都会触发错误处理。

## AgentRunner（对话执行器）

`runner.ts` 负责多轮 LLM 对话：

1. 将组装好的消息发送给 LLM provider
2. 如果 LLM 返回工具调用：执行工具 → 将结果加入消息 → 循环回到步骤1
3. 如果 LLM 返回文本回复：流式输出 → 结束
4. 强制执行最大工具调用轮数，防止死循环

## 工具系统

所有工具位于 [tools/](apps/desktop/src/main/agent/tools/)。每个工具导出工厂函数，自动被发现和注册。

### 工具分类

| 分类 | 工具 | 说明 |
|------|------|------|
| 文件操作 | `read-file`, `write-file`, `edit-file`, `list-dir` | 工作空间内文件读写 |
| Shell | `exec` | 沙箱化命令执行，支持超时和危险命令拦截 |
| 搜索 | `grep`, `web-search`, `web-fetch` | ripgrep 内容搜索 + 网络搜索 |
| MCP | `mcp` | Model Context Protocol 服务集成 |
| 子代理 | `spawn` | 派生子代理处理复杂多步骤任务 |
| 图表 | `append-diagram`, `edit-diagram`, `display-diagram` | Draw.io 架构图操作 |
| 图像 | `generate-image` | AI 图像生成 |
| 会话 | `exec_session` | 持久化 Shell 会话 |
| 自身管理 | `self` | catbuddy 自身管理、skill 安装 |

### 工具注册机制（registry.ts）

工具通过 `createXxxTool(deps)` 工厂函数创建，接收工具依赖注入，返回 `ToolDefinition`：

```typescript
// 新增工具的标准模式
export function createMyTool(deps: ToolDeps): ToolDefinition {
  return {
    schema: {
      name: "my_tool",
      parameters: { type: "object", properties: { /* ... */ } }
    },
    description: "工具的功能描述",
    handler: async (args, context) => { /* 工具逻辑 */ },
  };
}
```

### 文件状态追踪（file_state.ts）

- 跟踪工具操作导致的文件变更
- 在对话结束时生成文件变更摘要
- 支持 workspace 边界检查

## 上下文构建（context/）

系统提示词由以下部分组装而成：

| 来源 | 内容 |
|------|------|
| `.catbuddy/SOUL.md` | Agent 人格与行为约束 |
| `.catbuddy/TOOLS.md` | 工具使用说明和注意事项 |
| `.catbuddy/AGENTS.md` | Agent 指令 |
| `.catbuddy/HEARTBEAT.md` | 定时任务定义 |
| `.catbuddy/skills/` | 已安装的技能包 |
| MCP 配置 | MCP 服务器提供的上下文 |
| LayeredMemory | 多层持久记忆 |

## 记忆系统

### 会话记忆（memory.ts）
- 每会话一个 JSON 文件持久化
- 支持 Dream 两阶段记忆巩固

### Dream 巩固（dream.ts）
1. **提取阶段**：从最近对话轮次中识别重要信息
2. **整合阶段**：将提取的信息合并到分层记忆

### 分层记忆（layered-memory.ts）
| 层级 | 用途 |
|------|------|
| `user` | 用户信息（角色、偏好、专业水平） |
| `feedback` | 用户纠正和确认的方法 |
| `project` | 进行中的工作、目标、约束 |
| `reference` | 外部资源（URL、面板、工单） |

### 自动压缩（autocompact.ts）
- TTL 触发：超过时间阈值自动压缩
- Token 预算触发：上下文接近限制时压缩最早的消息
- 压缩时保持上下文完整性

## 子代理系统（subagent.ts）

- 派生子代理处理复杂多步骤任务
- 每个子代理有独立的上下文和工具访问权限
- 代理类型：`general-purpose`、`Explore`、`Plan`
- 支持 worktree 隔离模式（git worktree）
- 子代理返回结果给主代理继续处理

## 关键文件索引

| 文件 | 作用 |
|------|------|
| `loop.ts` | 状态机引擎（42000+ 行核心逻辑） |
| `runner.ts` | 多轮 LLM 对话处理器 |
| `context/index.ts` | 上下文构建器（系统提示词组装） |
| `tools/registry.ts` | 工具自动发现和注册 |
| `tools/builtin.ts` | 内置工具列表 |
| `memory.ts` | 会话记忆持久化 |
| `dream.ts` | 记忆巩固（提取+整合） |
| `layered-memory.ts` | 分层持久记忆存储 |
| `autocompact.ts` | 上下文自动压缩 |
| `subagent.ts` | 子代理派生和管理 |
| `skill.ts` | 技能发现和开关控制 |
| `model_presets.ts` | Provider/模型配置 |
| `token-counter.ts` | Token 计数 |
| `hook.ts` | Agent 生命周期钩子接口 |
| `skill-install.ts` | 技能包安装逻辑 |
