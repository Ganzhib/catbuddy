# 多实例

使用不同的配置和运行时数据同时运行多个 nanobot 实例。以 `--config` 为主要入口。在 `onboard` 期间可选择传递 `--workspace` 来初始化或更新特定实例的已保存工作区。

## 快速开始

如果希望每个实例从一开始就有自己的专属工作区，在初始化时同时传递 `--config` 和 `--workspace`。

**初始化实例：**

```bash
# 创建独立的实例配置和工作区
nanobot onboard --config ~/.nanobot-telegram/config.json --workspace ~/.nanobot-telegram/workspace
nanobot onboard --config ~/.nanobot-discord/config.json --workspace ~/.nanobot-discord/workspace
nanobot onboard --config ~/.nanobot-feishu/config.json --workspace ~/.nanobot-feishu/workspace
```

**配置每个实例：**

编辑 `~/.nanobot-telegram/config.json`、`~/.nanobot-discord/config.json` 等，使用不同的通道设置。`onboard` 期间传递的工作区会保存到每个配置中作为该实例的默认工作区。

**运行实例：**

```bash
# 实例 A - Telegram bot
nanobot gateway --config ~/.nanobot-telegram/config.json

# 实例 B - Discord bot
nanobot gateway --config ~/.nanobot-discord/config.json

# 实例 C - 飞书 bot 使用自定义端口
nanobot gateway --config ~/.nanobot-feishu/config.json --port 18792
```

## 路径解析

使用 `--config` 时，nanobot 从配置文件位置派生其运行时数据目录。除非用 `--workspace` 覆盖，否则工作区仍来自 `agents.defaults.workspace`。

针对其中一个实例本地打开 CLI 会话：

```bash
nanobot agent -c ~/.nanobot-telegram/config.json -m "来自 Telegram 实例的 Hello"
nanobot agent -c ~/.nanobot-discord/config.json -m "来自 Discord 实例的 Hello"

# 可选的一次性工作区覆盖
nanobot agent -c ~/.nanobot-telegram/config.json -w /tmp/nanobot-telegram-test
```

> `nanobot agent` 使用选定的工作区/配置启动本地 CLI agent。它不会附加或代理到已在运行的 `nanobot gateway` 进程。

| 组件 | 解析来源 | 示例 |
|-----------|---------------|---------|
| **Config** | `--config` 路径 | `~/.nanobot-A/config.json` |
| **Workspace** | `--workspace` 或配置 | `~/.nanobot-A/workspace/` |
| **Cron 任务** | 配置目录 | `~/.nanobot-A/cron/` |
| **Media / 运行时状态** | 配置目录 | `~/.nanobot-A/media/` |

## 工作原理

- `--config` 选择要加载的配置文件
- 默认情况下，工作区来自该配置中的 `agents.defaults.workspace`
- 如果传递 `--workspace`，则覆盖配置文件中的工作区

## 最小设置

1. 将基础配置复制到新实例目录。
2. 为该实例设置不同的 `agents.defaults.workspace`。
3. 使用 `--config` 启动实例。

示例配置：

```json
{
  "agents": {
    "defaults": {
      "workspace": "~/.nanobot-telegram/workspace",
      "model": "anthropic/claude-sonnet-4-6"
    }
  },
  "channels": {
    "telegram": {
      "enabled": true,
      "token": "YOUR_TELEGRAM_BOT_TOKEN"
    }
  },
  "gateway": {
    "host": "127.0.0.1",
    "port": 18790
  }
}
```

启动独立实例：

```bash
nanobot gateway --config ~/.nanobot-telegram/config.json
nanobot gateway --config ~/.nanobot-discord/config.json
```

每个网关实例还在 `gateway.host:gateway.port` 上暴露一个轻量级 HTTP 健康端点。默认网关绑定到 `127.0.0.1`，因此除非将 `gateway.host` 显式设置为公开或局域网地址，否则端点保持本地访问。

- `GET /health` 返回 `{"status":"ok"}`
- 其他路径返回 `404`

需要时覆盖工作区进行一次性运行：

```bash
nanobot gateway --config ~/.nanobot-telegram/config.json --workspace /tmp/nanobot-telegram-test
```

## 常见用例

- 为 Telegram、Discord、飞书等不同平台运行独立的 bot
- 隔离测试和生产实例
- 为不同团队使用不同的模型或 provider
- 为多个租户使用独立的配置和运行时数据

## 注意事项

- 如果同时运行，每个实例必须使用不同的端口
- 如果希望隔离记忆、会话和技能，每个实例使用不同的工作区
- `--workspace` 覆盖配置文件中定义的工作区
- Cron 任务和运行时 media/状态从配置目录派生
