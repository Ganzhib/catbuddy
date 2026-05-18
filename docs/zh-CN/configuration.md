# 配置

配置文件：`~/.nanobot/config.json`

> [!NOTE]
> 如果配置文件比当前 schema 更旧，可以在不覆盖已有值的情况下刷新它：
> 运行 `nanobot onboard`，然后当被问及是否覆盖配置时回答 `N`。
> nanobot 会合并缺失的默认字段并保留你当前的设置。

## 密钥环境变量

可以将 `${VAR_NAME}` 引用用于密钥，而非直接存储在 `config.json` 中，这些引用在启动时从环境变量解析：

```json
{
  "channels": {
    "telegram": { "token": "${TELEGRAM_TOKEN}" },
    "email": {
      "imapPassword": "${IMAP_PASSWORD}",
      "smtpPassword": "${SMTP_PASSWORD}"
    }
  },
  "providers": {
    "groq": { "apiKey": "${GROQ_API_KEY}" }
  }
}
```

`config.json` 中任何字符串值均可使用 `${VAR_NAME}`。解析仅在启动时运行一次，仅在内存中——解析后的值永不写回磁盘。

若引用的变量未设置，nanobot 在启动时快速失败，报 `ValueError`。

## Provider

> [!TIP]
> - **语音转录**：语音消息（Telegram、WhatsApp）使用 Whisper 自动转录。默认使用 Groq（免费层）。将 `channels` 下的 `"transcriptionProvider"` 设为 `"openai"` 使用 OpenAI Whisper。
> - **DeepSeek**：使用 `deepseek/deepseek-v4-pro` 或 `deepseek/deepseek-v4-flash` 作为模型名。
> - **MiniMax 思维模式**：使用 `providers.minimaxAnthropic`。默认 Anthropic 兼容基础 URL：`https://api.minimax.io/anthropic`
> - **VolcEngine / BytePlus 编码计划**：使用专用 provider `volcengineCodingPlan` 或 `byteplusCodingPlan`

| Provider | 用途 | 获取 API Key |
|----------|---------|-------------|
| `custom` | 任何 OpenAI 兼容端点 | — |
| `openrouter` | LLM（推荐，可访问全部模型） | [openrouter.ai](https://openrouter.ai) |
| `huggingface` | LLM（Hugging Face Inference Providers） | [huggingface.co](https://huggingface.co/settings/tokens) |
| `volcengine` | LLM（火山引擎，按量付费） | [volcengine.com](https://www.volcengine.com) |
| `byteplus` | LLM（火山引擎国际版，按量付费） | [byteplus.com](https://www.byteplus.com) |
| `anthropic` | LLM（Claude 直连） | [console.anthropic.com](https://console.anthropic.com) |
| `azure_openai` | LLM（Azure OpenAI） | [portal.azure.com](https://portal.azure.com) |
| `bedrock` | LLM（AWS Bedrock Converse） | [aws.amazon.com/bedrock](https://aws.amazon.com/bedrock/) |
| `openai` | LLM + 语音转录（Whisper） | [platform.openai.com](https://platform.openai.com) |
| `deepseek` | LLM（DeepSeek 直连） | [platform.deepseek.com](https://platform.deepseek.com) |
| `groq` | LLM + 语音转录（Whisper，默认） | [console.groq.com](https://console.groq.com) |
| `minimax` | LLM（MiniMax 直连） | [platform.minimaxi.com](https://platform.minimaxi.com) |
| `gemini` | LLM（Gemini 直连） | [aistudio.google.com](https://aistudio.google.com) |
| `aihubmix` | LLM（API 网关，可访问全部模型） | [aihubmix.com](https://aihubmix.com) |
| `siliconflow` | LLM（硅基流动） | [siliconflow.cn](https://siliconflow.cn) |
| `dashscope` | LLM（Qwen / 通义千问） | [dashscope.console.aliyun.com](https://dashscope.console.aliyun.com) |
| `moonshot` | LLM（Moonshot / Kimi） | [platform.moonshot.cn](https://platform.moonshot.cn) |
| `zhipu` | LLM（智谱 GLM） | [open.bigmodel.cn](https://open.bigmodel.cn) |
| `mimo` | LLM（小米 MiMo） | [platform.xiaomimimo.com](https://platform.xiaomimimo.com) |
| `longcat` | LLM（LongCat） | [longcat.chat](https://longcat.chat) |
| `ant_ling` | LLM（蚂蚁百灵） | [developer.ant-ling.com](https://developer.ant-ling.com) |
| `ollama` | LLM（本地，Ollama） | — |
| `lm_studio` | LLM（本地，LM Studio） | — |
| `mistral` | LLM | [docs.mistral.ai](https://docs.mistral.ai/) |
| `stepfun` | LLM（阶跃星辰） | [platform.stepfun.com](https://platform.stepfun.com) |
| `vllm` | LLM（本地，任何 OpenAI 兼容服务器） | — |
| `openai_codex` | LLM（Codex，OAuth） | `nanobot provider login openai-codex` |
| `github_copilot` | LLM（GitHub Copilot，OAuth） | `nanobot provider login github-copilot` |
| `qianfan` | LLM（百度千帆） | [cloud.baidu.com](https://cloud.baidu.com) |

## 模型预设

模型预设让你为完整的模型配置命名并在运行时通过 `/model <preset>` 切换。

```json
{
  "agents": {
    "defaults": {
      "model": "openai/gpt-4.1",
      "provider": "openai",
      "maxTokens": 8192,
      "modelPreset": "fast",
      "fallbackModels": ["deep"]
    }
  },
  "modelPresets": {
    "fast": {
      "model": "openai/gpt-4.1-mini",
      "provider": "openai",
      "maxTokens": 4096,
      "temperature": 0.2
    },
    "deep": {
      "model": "anthropic/claude-opus-4-5",
      "provider": "anthropic",
      "maxTokens": 8192,
      "contextWindowTokens": 200000
    }
  }
}
```

### 模型回退

`agents.defaults.fallbackModels` 定义活动模型配置的有序故障转移链。每个候选可以是预设名称或内联回退对象：

```json
{
  "agents": {
    "defaults": {
      "modelPreset": "fast",
      "fallbackModels": [
        "deep",
        {
          "provider": "deepseek",
          "model": "deepseek-v4-pro",
          "maxTokens": 4096
        }
      ]
    }
  }
}
```

## 通道设置

适用于所有通道的全局设置：

| 设置 | 默认值 | 说明 |
|---------|---------|-------------|
| `sendProgress` | `true` | 向通道流式传输 agent 的文本进度 |
| `sendToolHints` | `false` | 流式传输工具调用提示（如 `read_file("…")`） |
| `showReasoning` | `true` | 允许通道展示模型推理/思考内容 |
| `sendMaxRetries` | `3` | 每条外发消息的最大投递尝试次数 |
| `transcriptionProvider` | `"groq"` | 语音转录后端：`"groq"` 或 `"openai"` |
| `transcriptionLanguage` | `null` | 可选的 ISO-639-1 语言提示 |

## 网页工具

默认启用。支持通过 API 搜索（DuckDuckGo 默认无需 key）和 Markdown 格式抓取网页。

**搜索引擎 provider：**

| Provider | 需要 API Key | 免费 |
|----------|--------------|------|
| `duckduckgo`（默认） | 否 | 是 |
| `brave` | `BRAVE_API_KEY` | 否 |
| `tavily` | `TAVILY_API_KEY` | 否 |
| `jina` | `JINA_API_KEY` | 免费额度 |
| `kagi` | `KAGI_API_KEY` | 否 |
| `olostep` | `OLOSTEP_API_KEY` | 否 |
| `searxng` | 需要 `baseUrl` | 是（自托管） |

## MCP（模型上下文协议）

支持 [MCP](https://modelcontextprotocol.io/)——连接外部工具服务器并将其作为原生 agent 工具使用。

```json
{
  "tools": {
    "mcpServers": {
      "filesystem": {
        "command": "npx",
        "args": ["-y", "@modelcontextprotocol/server-filesystem", "/path/to/dir"]
      },
      "my-remote-mcp": {
        "url": "https://example.com/mcp/",
        "headers": { "Authorization": "Bearer xxxxx" }
      }
    }
  }
}
```

支持两种传输模式：

| 模式 | 配置 | 示例 |
|------|--------|---------|
| **Stdio** | `command` + `args` | 本地进程，通过 `npx` / `uvx` |
| **HTTP** | `url` + `headers`（可选） | 远程端点 |

## 安全

| 选项 | 默认值 | 说明 |
|--------|---------|-------------|
| `tools.restrictToWorkspace` | `false` | 限制所有工具到工作区目录 |
| `tools.exec.sandbox` | `""` | 设为 `"bwrap"` 使用 bubblewrap 沙箱 |
| `tools.exec.enable` | `true` | 设为 `false` 完全禁用 shell 执行 |

## 配对

配对让用户通过简单的代码交换获得 bot 访问权限——无需编辑配置。

1. 未批准的用户向 bot 发送私信
2. Bot 回复配对码（如 `ABCD-EFGH`）
3. 你批准：`/pairing approve ABCD-EFGH`

## 子 agent 并发

默认 `maxConcurrentSubagents: 1`。若 provider 支持更多并行工作，调高限制。

## 自动压缩

设置 `idleCompactAfterMinutes` 在用户空闲时自动压缩会话上下文（默认 `0`，禁用）。推荐 `15` 分钟。

## 时区

默认 `UTC`。设为有效的 IANA 时区名（如 `"Asia/Shanghai"`）。

## 统一会话

设置 `unifiedSession: true` 使所有通道共享同一对话。

## 禁用技能

设置 `disabledSkills` 列表隐藏特定内置或工作区技能。

---

> 更多 Provider 详细配置（AWS Bedrock、OpenAI Codex、GitHub Copilot、LongCat、Ant Ling、Ollama、LM Studio、Atomic Chat、OpenVINO、vLLM、自定义 Provider 等）、回退行为详解和新增 Provider 开发指南，请参阅[英文原版文档](./configuration.md)。
