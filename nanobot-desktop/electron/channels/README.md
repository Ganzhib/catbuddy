# Channels 模块 - 聊天通道管理

## 功能说明

`channels` 管理各种聊天平台的连接（Telegram、Discord、Slack、WhatsApp 等）。

### nanobot 中的通道

- **WebSocket** - Web UI 通信
- **Telegram** - Telegram Bot API
- **Discord** - Discord Bot
- **Slack** - Slack Bot
- **WhatsApp** - WhatsApp Business API
- **飞书** - Feishu
- **钉钉** - DingTalk
- **企业微信** - WeCom
- **微信** - Weixin
- **Email** - 邮件
- **Matrix** - Matrix 协议
- **MS Teams** - Microsoft Teams

## 集成到 nanobot-desktop

### 桌面客户端的通道策略

```
electron/
├── channels/
│   ├── base.ts            # 基础通道接口
│   ├── webui.ts           # WebUI 通道 (核心)
│   ├── desktop.ts         # 桌面通知通道
│   └── manager.ts          # 通道管理器
```

### WebUI Channel (核心)

这是桌面客户端最重要的通道，连接 Electron 主进程和 React 渲染进程：

```typescript
interface WebUIChannel {
  // 发送消息到渲染进程
  send(message: OutboundMessage): Promise<void>;
  
  // 接收渲染进程消息
  onMessage(handler: (msg: InboundMessage) => void): void;
  
  // 流式传输
  sendDelta(chatId: string, delta: string): Promise<void>;
  sendEnd(chatId: string): Promise<void>;
}
```

### BaseChannel 接口

```typescript
abstract class BaseChannel {
  name: string = 'base';
  displayName: string = 'Base';
  
  abstract start(): Promise<void>;
  abstract stop(): Promise<void>;
  abstract send(msg: OutboundMessage): Promise<void>;
  
  // 可选：流式支持
  async sendDelta?(chatId: string, delta: string): Promise<void>;
  async sendEnd?(chatId: string): Promise<void>;
}
```

### ChannelManager

```typescript
class ChannelManager {
  private channels: Map<string, BaseChannel> = new Map();
  
  register(channel: BaseChannel): void;
  unregister(name: string): void;
  get(name: string): BaseChannel | undefined;
  broadcast(msg: OutboundMessage): Promise<void>;
}
```

## 与 nanobot 的差异

| nanobot | nanobot-desktop |
|---------|----------------|
| 多平台通道 | 仅 WebUI + 桌面通知 |
| 长连接轮询 | WebSocket/EventEmitter |
| 外部 Webhook | 本地 IPC |

## 建议实现顺序

1. **WebUI Channel** - 核心渲染进程通信
2. **Desktop Notifications** - 系统通知
3. **Clipboard** - 剪贴板支持

## 注意事项

- 桌面客户端不需要远程通道（Telegram、Discord 等）
- 通道接口设计为可扩展，未来可添加本地 AI 助手集成
