# CLI 参考

| 命令 | 说明 |
|---------|-------------|
| `nanobot onboard` | 初始化 `~/.nanobot/` 下的配置和工作区 |
| `nanobot onboard --wizard` | 启动交互式初始化向导 |
| `nanobot onboard -c <config> -w <workspace>` | 初始化或刷新特定实例的配置和工作区 |
| `nanobot agent -m "..."` | 与 agent 聊天 |
| `nanobot agent -w <workspace>` | 对特定工作区聊天 |
| `nanobot agent -w <workspace> -c <config>` | 对特定工作区/配置聊天 |
| `nanobot agent` | 交互式聊天模式 |
| `nanobot agent --no-markdown` | 显示纯文本回复 |
| `nanobot agent --logs` | 在聊天期间显示运行时日志 |
| `nanobot serve` | 启动 OpenAI 兼容 API |
| `nanobot gateway` | 启动网关 |
| `nanobot status` | 显示状态 |
| `nanobot provider login openai-codex` | Provider 的 OAuth 登录 |
| `nanobot channels login <channel>` | 交互式验证通道身份 |
| `nanobot channels status` | 显示通道状态 |

交互模式退出：`exit`、`quit`、`/exit`、`/quit`、`:q` 或 `Ctrl+D`。
