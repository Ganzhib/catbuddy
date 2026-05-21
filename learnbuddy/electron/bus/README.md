# Bus 模块 - 消息总线

## 为什么需要 Bus

learnbuddy 的消息流是**多对多**的：

```
                 ┌──── inbound queue ────┐
Telegram ────────┤                       │
WhatsApp ────────┤                       ├───→ AgentLoop.run()
WebUI ───────────┤                       │        │
Bridge ──────────┘                       │        ▼
                                         │   _process_message()
                 ┌── outbound queue ─────┘        │
                 │                               ▼
                 │                    ChannelManager 路由到正确出口
                 │                    ├──→ Telegram
                 ├────────────────────┤
                 │                    ├──→ WhatsApp
                 └────────────────────┤
                                      └──→ WebUI
```

你的 learnbuddy-desktop 未来也会有多管道：桌面 UI + WhatsApp Bridge + cron 定时任务 + heartbeat 主动推送。

**如果没有 bus，你会面临这些问题：**
- WhatsApp 来一条消息 → 你要手动把回复发回 WhatsApp
- cron 定时触发 → 你要知道通知到哪个渠道
- heartbeat 想主动说话 → 它没有"上游输入源"可以回调

**bus 的解决方案：消息自己带地址（channel + chat_id），谁发的谁收。**

## 两种调用模式

参考 learnbuddy 的设计，AgentLoop 需要支持两种模式：

### 模式 A：bus 驱动（多管道）

```
通道 ──→ bus.inbound ──→ run() 消费 ──→ _process_message() ──→ bus.outbound ──→ 通道
```

```typescript
// AgentLoop.run() — 后台循环，消费 bus
async run(): Promise<void> {
  while (this._running) {
    const msg = await this.bus.consumeInbound(); // 阻塞等待
    const response = await this._processMessage(msg);
    await this.bus.publishOutbound(response);
  }
}
```

### 模式 B：直接调用（单次处理）

```
调用者 ──→ processDirect() ──→ _processMessage() ──→ 返回结果
```

```typescript
// AgentLoop.processDirect() — 直接调用，不经过 bus
async processDirect(content: string, sessionKey: string): Promise<OutboundMessage> {
  const msg: InboundMessage = {
    channel: 'direct', senderId: 'system',
    chatId: sessionKey, content, timestamp: Date.now(),
  };
  return this._processMessage(msg); // 直接返回，不发布到 bus
}
```

| 场景 | 使用模式 | 原因 |
|------|---------|------|
| 用户从 WebUI 发消息 | 模式 A (bus) | 未来可能有多个出口 |
| WhatsApp 收消息 | 模式 A (bus) | 需要路由回复 |
| cron 定时任务 | 模式 B (direct) | 不需要排队，立即执行 |
| heartbeat 检查 | 模式 B (direct) | 内部触发，结果再 notify |
| CLI 单次消息 | 模式 B (direct) | 一次性查询 |

## 类型定义

```typescript
// shared/types.ts
interface InboundMessage {
  channel: string;           // 'desktop' | 'whatsapp' | 'webui'
  senderId: string;          // 用户标识
  chatId: string;            // 会话标识
  content: string;           // 消息文本
  timestamp: number;         // 毫秒时间戳
  media?: string[];          // 媒体 URL
  metadata?: Record<string, any>;
  sessionKeyOverride?: string; // 线程作用域会话覆盖
}

interface OutboundMessage {
  channel: string;
  chatId: string;
  content: string;
  replyTo?: string;
  media?: string[];
  metadata?: Record<string, any>;
  buttons?: string[][];
}
```

## 核心实现

```typescript
// electron/bus/index.ts
export class MessageBus {
  // 使用 EventEmitter + 队列实现异步解耦
  private inbound: InboundMessage[] = [];
  private outbound: OutboundMessage[] = [];
  private inboundResolve: ((msg: InboundMessage) => void) | null = null;
  private outboundResolve: ((msg: OutboundMessage) => void) | null = null;

  // 通道发布消息
  publishInbound(msg: InboundMessage): void {
    if (this.inboundResolve) {
      this.inboundResolve(msg);
      this.inboundResolve = null;
    } else {
      this.inbound.push(msg);
    }
  }

  // Agent 消费消息（阻塞式）
  async consumeInbound(): Promise<InboundMessage> {
    if (this.inbound.length > 0) {
      return this.inbound.shift()!;
    }
    return new Promise(resolve => { this.inboundResolve = resolve; });
  }

  // Agent 发布回复
  publishOutbound(msg: OutboundMessage): void { /* 对称实现 */ }
  
  // 通道消费回复
  async consumeOutbound(): Promise<OutboundMessage> { /* 对称实现 */ }

  // 非阻塞只读
  get inboundSize(): number { return this.inbound.length; }
  get outboundSize(): number { return this.outbound.length; }
}
```

## 与 AgentLoop 的集成

```typescript
// electron/agent/loop.ts
class AgentLoop {
  private bus: MessageBus;
  private commands: CommandRouter;
  private channelDispatcher: ChannelDispatcher;

  constructor(opts: { bus: MessageBus; /* ... */ }) {
    this.bus = opts.bus;
    this.commands = new CommandRouter();
    registerBuiltinCommands(this.commands);
    this.channelDispatcher = new ChannelDispatcher(this.bus);
  }

  // 模式 A：后台循环，消费 bus
  async run(): Promise<void> {
    while (this._running) {
      const msg = await this.bus.consumeInbound();
      
      // 优先命令在锁外处理
      if (this.commands.isPriority(msg.content)) {
        const result = await this.commands.dispatchPriority(createContext(msg, this));
        if (result) await this.bus.publishOutbound(result);
        continue;
      }

      // 普通消息走状态机
      const response = await this._processMessage(msg);
      if (response) await this.bus.publishOutbound(response);
    }
  }

  // 模式 B：直接调用（cron/heartbeat/CLI）
  async processDirect(content: string, sessionKey: string): Promise<OutboundMessage | null> {
    const msg: InboundMessage = {
      channel: 'direct', senderId: 'system',
      chatId: sessionKey, content, timestamp: Date.now(),
    };
    return this._processMessage(msg);
  }
}
```

## ChannelDispatcher — 出站路由

bus 只负责消息队列，**不负责路由**。路由由 ChannelDispatcher 完成：

```typescript
class ChannelDispatcher {
  private channels = new Map<string, BaseChannel>();

  register(name: string, channel: BaseChannel): void;
  
  async start(): Promise<void> {
    while (true) {
      const msg = await this.bus.consumeOutbound();
      const channel = this.channels.get(msg.channel);
      if (channel) {
        await channel.send(msg);
      }
    }
  }
}
```

## 架构全景

```
                  ┌────── inbound ──────┐
WebUI IPC ────────┤                     │
WhatsApp Bridge ──┤                     ├───→ AgentLoop.run()
                  └─────────────────────┘        │
                                                 ▼
                                         状态机 RESTORE→COMPACT→COMMAND→BUILD→RUN→SAVE→RESPOND
                                                 │
                  ┌────── outbound ─────┐         │
                  │                     │←────────┘
                  ├──→ WebUI IPC        │
ChannelDispatcher├──→ WhatsApp Bridge   │
                  ├──→ Notification     │
                  └─────────────────────┘
```

## 优先级

**P1** — 多管道架构的基础设施，先于 channels/bridge 实现。
