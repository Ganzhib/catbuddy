# 聊天命令

以下命令可在聊天通道和交互式 agent 会话中使用：

| 命令 | 说明 |
|---------|-------------|
| `/new` | 停止当前任务并开始新对话 |
| `/stop` | 停止当前任务 |
| `/restart` | 重启 bot |
| `/status` | 显示 bot 状态 |
| `/model` | 显示当前模型和可用的模型预设 |
| `/model <preset>` | 为后续对话轮次切换运行时模型预设 |
| `/dream` | 立即运行 Dream 记忆整合 |
| `/dream-log` | 显示最新的 Dream 记忆变更 |
| `/dream-log <sha>` | 显示特定的 Dream 记忆变更 |
| `/dream-restore` | 列出最近的 Dream 记忆版本 |
| `/dream-restore <sha>` | 将记忆恢复到特定变更之前的状态 |
| `/pairing` | 列出待处理的配对请求 |
| `/pairing approve <code>` | 批准配对码 |
| `/pairing deny <code>` | 拒绝待处理的配对请求 |
| `/pairing revoke <user_id>` | 吊销当前通道中已批准的用户 |
| `/pairing revoke <channel> <user_id>` | 吊销特定通道中已批准的用户 |
| `/help` | 显示可用的聊天命令 |

## 配对

当有人向 bot 发送私信且不在允许列表中时——无论是新用户还是已存在用户通过新通道联系——nanobot 会自动回复一个**配对码**（如 `ABCD-EFGH`），有效期 10 分钟。要授予访问权限：

```text
/pairing approve ABCD-EFGH
```

查看等待列表使用 `/pairing`。之后移除某人使用 `/pairing revoke <user_id>`——可在 `/pairing list` 输出中找到用户 ID。

完整设置指南请参见[配置：配对](./configuration.md#配对)。

## 模型预设

使用 `/model` 查看当前运行时模型：

```text
/model
```

响应显示当前模型、当前预设和可用的预设名称。`default` 始终可用，代表来自 `agents.defaults.*` 的模型设置。

切换未来对话轮次的预设：

```text
/model fast
/model deep
/model default
```

预设名称来自顶层 `modelPresets` 配置。切换仅在运行时生效：不会重写 `config.json`，进行中的对话轮次继续使用其启动时的模型。设置详情请参见[配置：模型预设](./configuration.md#模型预设)。

## 周期任务

网关每 30 分钟唤醒一次并检查工作区中的 `HEARTBEAT.md`（`~/.nanobot/workspace/HEARTBEAT.md`）。如果文件中有任务，agent 将执行它们并将结果投递到你最近活跃的聊天通道。

**设置：** 编辑 `~/.nanobot/workspace/HEARTBEAT.md`（由 `nanobot onboard` 自动创建）：

```markdown
## 周期任务

- [ ] 检查天气预报并发送摘要
- [ ] 扫描收件箱中的紧急邮件
```

Agent 也可以自己管理此文件——让它"添加一个周期任务"，它便会更新 `HEARTBEAT.md`。

> **注意：** 网关必须在运行中（`nanobot gateway`），且你必须至少与 bot 聊过一次，以便它知道投递到哪个通道。
