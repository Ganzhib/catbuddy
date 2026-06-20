---
name: three-layer-message-types
description: 消息类型分层 — 新增字段必须同步更新 MessageRecord、ThreadPayload、UIMessage 三层
metadata:
  type: project
---

项目有三层消息类型，每层含义不同。**新增任何需要持久化或在历史回放中恢复的字段，必须同时更新全部三层**：

1. `MessageRecord`（持久层）— `packages/shared/src/agent-types.ts`
2. `ThreadPayload`（传输层）— `packages/shared/src/ui-types.ts`
3. `UIMessage`（渲染层）— 同上

此外还要更新 `SessionManager.addMessage()` 写入逻辑和 Gateway MySQL 表结构。

**Why:** 2026-06-03 曾修复 `tokenUsage`/`latencyMs` 历史回放丢失问题，根因就是新增字段时遗漏了某层转换。

**How to apply:** 新增字段时把"5 处同步"作为 checklist：类型定义(2处) → 写入逻辑(1处) → DB表(1处) → 转换逻辑(1处)。[[message-data-flow]]
