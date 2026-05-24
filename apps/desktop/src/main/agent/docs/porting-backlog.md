# Agent 移植待办

对照 `apps/desktop/example/agent/`（已排除项见 `example/agent/_excluded/`）。

## 已完成

- [x] 七阶段状态机（`loop.ts`）
- [x] Bus 驱动 + `desktop` 通道
- [x] `AgentRunner` + `AgentHook` / `CompositeHook`（`hook.ts`）
- [x] 内置工具 + `exec_session`、`my`、`spawn`、`mcp_reload`
- [x] `FileStates` / `FileStateStore`（`tools/file_state.ts`）
- [x] `security/network.ts` — SSRF + 安全重定向（`web_fetch`）
- [x] `model_presets.ts` — `ProviderSnapshot` 热切换
- [x] `AutoCompact`（`autocompact.ts`）
- [x] `MemoryStore` + `Dream`（简化 Phase 1，`memory-store.ts` / `dream.ts`）
- [x] `SubagentManager` + `spawn` 工具
- [x] `McpManager` + `connectMcpServers`（`@modelcontextprotocol/sdk` stdio）

## 待加强（可选）

- [ ] MCP SSE / streamable HTTP 传输（参考 `mcp.py` 的 `sse` / `streamableHttp`）
- [ ] `Dream` Phase 2（AgentRunner + 文件工具编辑 MEMORY.md）
- [ ] `Cron` 工具 — 待 `src/main/cron/`
- [ ] `MemoryStore` GitStore / legacy HISTORY 迁移

## 明确不做（桌面端）

见 `example/agent/_excluded/README.md`。
