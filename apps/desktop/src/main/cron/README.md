# Cron 模块

桌面端后台定时任务（基于 `setInterval`）。

## 已注册任务

| 任务 | 默认间隔 | 说明 |
|------|----------|------|
| `dream` | 120 分钟 | 调用 `AgentLoop.runDreamOnce()` 整理 `history.jsonl` → `MEMORY.md` |

间隔可在 `config.json` 配置：

```json
{
  "agents": {
    "defaults": {
      "dreamIntervalMinutes": 120
    }
  }
}
```

## 手动触发

聊天输入 `/dream` 可立即运行一次 Dream；`/dream-log` 查看最近写入摘要。

完整设计见 [docs/workspace-and-memory.md](../../../docs/workspace-and-memory.md)。
