# 聊天应用

将 nanobot 连接到你自己喜欢的聊天平台。想构建自己的通道？请参见[通道插件指南](./channel-plugin-guide.md)。

| 通道 | 需要准备 |
|---------|---------------|
| **Telegram** | @BotFather 获取的 Bot Token |
| **Discord** | Bot Token + Message Content Intent |
| **WhatsApp** | 扫码登录 (`nanobot channels login whatsapp`) |
| **微信 (Weixin)** | 扫码登录 (`nanobot channels login weixin`) |
| **飞书** | App ID + App Secret |
| **钉钉** | App Key + App Secret |
| **Slack** | Bot Token + App-Level Token |
| **Matrix** | 服务器 URL + Access Token |
| **Email** | IMAP/SMTP 凭证 |
| **QQ** | App ID + App Secret |
| **企业微信** | Bot ID + Bot Secret |
| **Microsoft Teams** | App ID + App Password + 公共 HTTPS 端点 |
| **Mochat** | Claw Token（支持自动设置） |

<details>
<summary><b>Telegram</b>（推荐）</summary>

**1. 创建 Bot**
- 打开 Telegram，搜索 `@BotFather`
- 发送 `/newbot`，按提示操作
- 复制 Token

**2. 配置**

```json
{
  "channels": {
    "telegram": {
      "enabled": true,
      "token": "YOUR_BOT_TOKEN",
      "allowFrom": ["YOUR_USER_ID"]
    }
  }
}
```

> 可在 Telegram 设置中找到 **User ID**，显示为 `@yourUserId`。复制此值**不带 `@` 符号**粘贴到配置文件中。

**3. 运行**

```bash
nanobot gateway
```

</details>

<details>
<summary><b>Discord</b></summary>

**1. 创建 Bot**
- 前往 https://discord.com/developers/applications
- 创建应用 → Bot → Add Bot
- 复制 Bot Token

**2. 启用 Intent**
- 在 Bot 设置中启用 **MESSAGE CONTENT INTENT**
- （可选）如需基于成员数据的允许列表，启用 **SERVER MEMBERS INTENT**

**3. 获取 User ID**
- Discord 设置 → 高级 → 启用 **开发者模式**
- 右键头像 → **Copy User ID**

**4. 配置**

```json
{
  "channels": {
    "discord": {
      "enabled": true,
      "token": "YOUR_BOT_TOKEN",
      "allowFrom": ["YOUR_USER_ID"],
      "allowChannels": [],
      "groupPolicy": "mention",
      "streaming": true
    }
  }
}
```

> `groupPolicy` 控制 bot 在群组通道中的响应方式：
> - `"mention"`（默认）— 仅在被 @提及 时响应
> - `"open"` — 响应所有消息
> `allowChannels` 将 bot 限制到特定的 Discord 通道 ID。留空（默认）表示在所有 bot 可见的通道中响应。

**5. 邀请 Bot**
- OAuth2 → URL Generator
- 权限范围：`bot`
- Bot 权限：`Send Messages`、`Read Message History`
- 打开生成的邀请 URL 并将 bot 添加到服务器

**6. 运行**

```bash
nanobot gateway
```

</details>

<details>
<summary><b>飞书</b></summary>

使用 **WebSocket** 长连接 — 无需公网 IP。

**1. 创建飞书 Bot**
- 访问[飞书开放平台](https://open.feishu.cn/app)
- 创建新应用 → 启用 **Bot** 能力
- **权限**：`im:message`、`im:message.p2p_msg:readonly`、`cardkit:card:write`
- **事件**：添加 `im.message.receive_v1`
  - 选择**长连接**模式
- 从"凭证与基础信息"获取 **App ID** 和 **App Secret**
- 发布应用

**2. 配置**

```json
{
  "channels": {
    "feishu": {
      "enabled": true,
      "appId": "cli_xxx",
      "appSecret": "xxx",
      "allowFrom": ["ou_YOUR_OPEN_ID"],
      "groupPolicy": "mention",
      "streaming": true,
      "domain": "feishu"
    }
  }
}
```

> `domain`: `"feishu"`（默认，国内 open.feishu.cn），`"lark"`（国际版 open.larksuite.com）。

**3. 运行**

```bash
nanobot gateway
```

</details>

<details>
<summary><b>WhatsApp</b></summary>

需要 **Node.js ≥18**。

**1. 关联设备**

```bash
nanobot channels login whatsapp
# 用 WhatsApp 扫码 → 设置 → 已关联设备
```

**2. 配置**

```json
{
  "channels": {
    "whatsapp": {
      "enabled": true,
      "allowFrom": ["+1234567890"]
    }
  }
}
```

**3. 运行**（两个终端）

```bash
# 终端 1
nanobot channels login whatsapp
# 终端 2
nanobot gateway
```

> 升级 nanobot 后，用以下命令重建本地桥接器：
> `rm -rf ~/.nanobot/bridge && nanobot channels login whatsapp`

</details>

<details>
<summary><b>微信 (Weixin)</b></summary>

使用 **HTTP 长轮询**，通过 ilinkai 个人微信 API 扫码登录。无需本地微信桌面客户端。

```bash
pip install "nanobot-ai[weixin]"
```

配置示例：

```json
{
  "channels": {
    "weixin": {
      "enabled": true,
      "allowFrom": ["YOUR_WECHAT_USER_ID"]
    }
  }
}
```

登录：

```bash
nanobot channels login weixin
```

</details>

<details>
<summary><b>Slack</b></summary>

使用 **Socket Mode** — 无需公共 URL。

1. 前往 [Slack API](https://api.slack.com/apps) → 创建应用
2. **Socket Mode**：开启 → 生成 App-Level Token（`xapp-...`）
3. **OAuth & Permissions**：添加 `chat:write`、`reactions:write`、`app_mentions:read`、`files:read`、`files:write` 等权限范围
4. 安装到工作区 → 复制 Bot Token（`xoxb-...`）

```json
{
  "channels": {
    "slack": {
      "enabled": true,
      "botToken": "xoxb-...",
      "appToken": "xapp-...",
      "allowFrom": ["YOUR_SLACK_USER_ID"],
      "groupPolicy": "mention"
    }
  }
}
```

</details>

<details>
<summary><b>邮件</b></summary>

给 nanobot 一个专属邮箱。它通过 **IMAP** 轮询收件并通过 **SMTP** 回复。

```json
{
  "channels": {
    "email": {
      "enabled": true,
      "consentGranted": true,
      "imapHost": "imap.gmail.com",
      "imapPort": 993,
      "imapUsername": "my-nanobot@gmail.com",
      "imapPassword": "your-app-password",
      "smtpHost": "smtp.gmail.com",
      "smtpPort": 587,
      "smtpUsername": "my-nanobot@gmail.com",
      "smtpPassword": "your-app-password",
      "fromAddress": "my-nanobot@gmail.com",
      "allowFrom": ["your-real-email@gmail.com"]
    }
  }
}
```

</details>

<details>
<summary><b>其他通道</b></summary>

- **钉钉**：使用 Stream Mode，配置 `clientId` 和 `clientSecret`
- **QQ**：使用 botpy SDK + WebSocket，当前仅支持私聊
- **企业微信**：使用 WebSocket 长连接，配置 `botId` 和 `secret`
- **Matrix**：支持 E2EE 加密，不支持 Windows
- **Microsoft Teams**：MVP 阶段，仅私聊文本
- **Mochat**：Socket.IO WebSocket，可让 nanobot 自动完成设置

以上通道的详细配置请参考[英文原版文档](./chat-apps.md)。

</details>
