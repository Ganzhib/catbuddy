# 安装与快速开始

## 安装

> [!IMPORTANT]
> 本 README 可能描述了最新源代码中才可用的功能。
> 如需最新功能和实验特性，请从源码安装。
> 如需最稳定的日常使用体验，请从 PyPI 安装或使用 `uv`。

**从源码安装**（最新功能，实验性变更可能最先在此落地；推荐用于开发）

```bash
git clone https://github.com/HKUDS/nanobot.git
cd nanobot
pip install -e .
```

**使用 [uv](https://github.com/astral-sh/uv) 安装**（稳定版本，速度快）

```bash
uv tool install nanobot-ai
```

**从 PyPI 安装**（稳定版本）

```bash
pip install nanobot-ai
```

### 升级到最新版本

**PyPI / pip**

```bash
pip install -U nanobot-ai
nanobot --version
```

**uv**

```bash
uv tool upgrade nanobot-ai
nanobot --version
```

**使用 WhatsApp？** 升级后重建本地桥接：

```bash
rm -rf ~/.nanobot/bridge
nanobot channels login whatsapp
```

## 快速开始

> [!TIP]
> 在 `~/.nanobot/config.json` 中设置你的 API Key。
> 获取 API Key：[OpenRouter](https://openrouter.ai/keys)（全球通用）
>
> 其他 LLM provider 请参见 [`configuration.md`](./configuration.md)。
>
> 要配置网络搜索功能，请参见 [`configuration.md`](./configuration.md) 中的 web-search 一节。

**1. 初始化**

```bash
nanobot onboard
```

如需交互式安装向导，使用 `nanobot onboard --wizard`。

**2. 配置**（`~/.nanobot/config.json`）

在配置中设置以下**两部分**（其他选项有默认值）。

*设置 API Key*（例如 OpenRouter，推荐全球用户使用）：

```json
{
  "providers": {
    "openrouter": {
      "apiKey": "sk-or-v1-xxx"
    }
  }
}
```

*设置模型*（可选指定 provider — 默认为自动检测）：

```json
{
  "agents": {
    "defaults": {
      "model": "anthropic/claude-opus-4-5",
      "provider": "openrouter"
    }
  }
}
```

**3. 聊天**

```bash
nanobot agent
```

搞定！两分钟即可拥有一个可以工作的 AI agent。
