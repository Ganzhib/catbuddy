# Heartbeat 模块

周期性唤醒 Agent，检查工作区 `HEARTBEAT.md` 中的 **Active Tasks**，并在需要时主动推送到桌面会话（`desktop:main`）。

## 行为

| 触发 | 说明 |
|------|------|
| 定时器 | 默认每 **30 分钟**（`heartbeatIntervalMinutes`） |
| `/heartbeat` | 立即检查；`force` 时即使 Active Tasks 为空也会跑一轮 |

无有效任务时定时器**不调用 LLM**（只读文件判断）。Agent 无需通知用户时回复 `HEARTBEAT_OK`，主进程不会向 UI 推送该轮结果，且不写入会话历史。

## 配置

`~/.catbuddy/config/config.json`（或项目内 `config/config.json`）：

```json
{
  "agents": {
    "defaults": {
      "heartbeatIntervalMinutes": 30,
      "heartbeatEnabled": true
    }
  }
}
```

## 相关文件

- 任务清单：工作区根目录 `HEARTBEAT.md`（模板 `templates/HEARTBEAT.md`）
- 调度：复用 `cron/scheduler.ts` 的 `CronScheduler`
