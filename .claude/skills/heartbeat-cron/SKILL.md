---
name: heartbeat-cron
description: 定时任务与心跳系统 — CronScheduler、Dream 自动巩固、Heartbeat 周期性检查
---

# 定时任务与心跳系统

catbuddy 桌面端有两个后台定时子系统：

## CronScheduler — 通用定时器

位于 [cron/scheduler.ts](apps/desktop/src/main/cron/scheduler.ts)，基于 `setInterval` 的轻量调度器。

```typescript
interface CronJob {
  name: string
  intervalMs: number          // 间隔（毫秒）
  runOnStart?: boolean        // 注册后是否立即执行一次
  run: () => Promise<void>
}

class CronScheduler {
  register(job: CronJob): void
  unregister(name: string): void
  stopAll(): void
}
```

### 已注册任务

| 任务 | 默认间隔 | 配置键 | 说明 |
|------|----------|--------|------|
| `dream` | 120 分钟 | `dreamIntervalMinutes` | 自动运行 Dream 记忆巩固 |

### 配置

在 `~/.catbuddy/config/config.json`：

```json
{
  "agents": {
    "defaults": {
      "dreamIntervalMinutes": 120
    }
  }
}
```

### 手动触发

| 命令 | 效果 |
|------|------|
| `/dream` | 立即运行一次 Dream 巩固 |
| `/dream-log` | 查看最近巩固写入摘要 |

## Heartbeat — Agent 周期性唤醒

位于 [heartbeat/](apps/desktop/src/main/heartbeat/)，每 30 分钟自动检查工作区的 `HEARTBEAT.md` 文件。

### 架构

```
CronScheduler ──► runHeartbeatOnce()
                      │
                      ├── heartbeatEnabled=false? → skipped
                      ├── HEARTBEAT.md 无 Active Tasks? → no-tasks（不调用 LLM）
                      └── 有 Active Tasks? → 构造 InboundMessage → bus.publishInbound()
                                                        │
                                                        ▼
                                                  AgentLoop 正常处理
                                                        │
                                                  Agent 回复 HEARTBEAT_OK
                                                        │
                                                  主进程不推送、不写入历史
```

### 关键行为

| 触发方式 | 说明 |
|----------|------|
| 定时器 | 默认每 **30 分钟**（`heartbeatIntervalMinutes`） |
| `/heartbeat` 命令 | 立即检查 |
| `/heartbeat force` | 即使无 Active Tasks 也跑一轮 LLM |

### 抑制规则

- 心跳触发的 Agent 回复如果是 `HEARTBEAT_OK` → **不推送给 UI、不写入会话历史**
- `isHeartbeatMessage()` 和 `shouldSuppressHeartbeatOutbound()` 在 AgentLoop 中过滤

### 配置

```json
{
  "agents": {
    "defaults": {
      "heartbeatEnabled": true,
      "heartbeatIntervalMinutes": 30
    }
  }
}
```

### HEARTBEAT.md 格式

工作区根目录的 `HEARTBEAT.md` 模板（`templates/HEARTBEAT.md`）：

```markdown
# Heartbeat Tasks

## Active Tasks
- [ ] 每天早上 9 点提醒我检查邮件

## Completed
- [x] 已完成的提醒任务
```

Agent 在心跳触发时会读取此文件，检查 Active Tasks 区域是否有待处理项。

## 关键文件

| 文件 | 作用 |
|------|------|
| [cron/scheduler.ts](apps/desktop/src/main/cron/scheduler.ts) | 通用 setInterval 调度器 |
| [cron/index.ts](apps/desktop/src/main/cron/index.ts) | 注册 dream 等后台任务 |
| [heartbeat/index.ts](apps/desktop/src/main/heartbeat/index.ts) | 心跳核心逻辑 |
| [heartbeat/tasks.ts](apps/desktop/src/main/heartbeat/tasks.ts) | 解析 HEARTBEAT.md |
| [heartbeat/prompt.ts](apps/desktop/src/main/heartbeat/prompt.ts) | 构建心跳 LLM 提示词 |
| [agent/loop.ts](apps/desktop/src/main/agent/loop.ts) | 心跳消息过滤（`isHeartbeatMessage`） |
| [templates/HEARTBEAT.md](apps/desktop/templates/HEARTBEAT.md) | 心跳任务模板 |

## 添加新的定时任务

```typescript
// 在 cron/index.ts 中
scheduler.register({
  name: "my-task",
  intervalMs: 60 * 60 * 1000,  // 1小时
  runOnStart: false,
  run: async () => {
    // 定期执行的逻辑
  },
})
```
