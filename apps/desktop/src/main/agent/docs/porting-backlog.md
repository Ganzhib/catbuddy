# Agent 移植待办

对照 `apps/desktop/example/agent/`（已排除项见 `example/agent/_excluded/`）。

## 已完成

- [X] 七阶段状态机（`loop.ts`）
- [X] Bus 驱动 + `desktop` 通道
- [X] `AgentRunner` + `AgentHook` / `CompositeHook`（`hook.ts`）
- [X] 内置工具 + `exec_session`、`my`、`spawn`、`mcp_reload`
- [X] `FileStates` / `FileStateStore`（`tools/file_state.ts`）
- [X] `security/network.ts` — SSRF + 安全重定向（`web_fetch`）
- [X] `model_presets.ts` — `ProviderSnapshot` 热切换
- [X] `AutoCompact`（`autocompact.ts`）
- [X] `MemoryStore` + `Dream`（简化 Phase 1，`memory-store.ts` / `dream.ts`）
- [X] `SubagentManager` + `spawn` 工具
- [X] `McpManager` + `connectMcpServers`（`@modelcontextprotocol/sdk` stdio）

## AgentLoop 并发与取消（待实现）

对照 Python 版 `loop.py` 的 session 锁与 abort 机制，桌面端已有基础设施但未接线：

- [ ] **`_activeTasks` / `AbortController` 接线** — `_dispatch` 尚未将 controller 注册到 `_activeTasks`，`/stop` → `cancelSession()` 无法真正中断进行中的 LLM/工具调用
- [ ] **同 session 串行锁** — 普通消息 `_dispatch` 为 fire-and-forget，多 session 可并发，但同 session 无显式锁，并发 turn 可能竞态（应对齐 Python 版 per-session `Lock`）

## 待加强（可选）

- [ ] MCP SSE / streamable HTTP 传输（参考 `mcp.py` 的 `sse` / `streamableHttp`）
- [ ] `Dream` Phase 2（AgentRunner + 文件工具编辑 MEMORY.md）
- [ ] `Cron` 工具 — 待 `src/main/cron/`
- [ ] `MemoryStore` GitStore / legacy HISTORY 迁移

## 明确不做（桌面端）

见 `example/agent/_excluded/README.md`。
