# Bridge 模块 - WhatsApp 桥接

## 功能说明

nanobot 的 `bridge` 是一个独立的 WhatsApp 桥接服务，使用 Baileys 库连接 WhatsApp Web。

### nanobot 桥接架构

```
bridge/
├── src/
│   ├── index.ts           # 入口
│   ├── server.ts          # WebSocket 服务器
│   ├── whatsapp.ts         # WhatsApp 连接
│   └── types.d.ts         # 类型定义
```

### 工作原理

1. Baileys 连接 WhatsApp Web（扫码登录）
2. 接收消息并转发到 WebSocket 服务器
3. WebSocket 与 nanobot 后端通信

## 集成到 nanobot-desktop

### 分析

| nanobot 场景 | nanobot-desktop |
|--------------|-----------------|
| 远程 WhatsApp | ❌ (不需要) |
| 独立进程 | ❌ |
| WebSocket 通信 | ⚠️ (可复用) |

### 桥接架构选择

对于桌面客户端，有两种方案：

#### 方案 A: 集成模式（推荐）

将桥接功能集成到主应用中：

```
electron/
├── bridge/
│   ├── index.ts           # 桥接管理器
│   ├── bailey.ts         # WhatsApp 连接
│   ├── protocol.ts       # 协议转换
│   └── qr.ts             # QR 码渲染
```

#### 方案 B: 外部进程

保持独立进程，通过 IPC 通信：

```
nanobot-desktop/
├── main.exe               # Electron 主进程
└── bridge/
    ├── bridge.exe        # 独立桥接进程
    └── ...
```

### 建议目录结构

```
electron/
├── bridge/
│   ├── index.ts           # 桥接入口
│   ├── bailey.ts         # Baileys 封装
│   ├── qr.ts             # QR 码生成
│   ├── events.ts         # 事件定义
│   └── types.ts          # 类型定义
```

### 核心接口

```typescript
// electron/bridge/bailey.ts
interface WhatsAppBridge {
  // 连接状态
  state: 'connecting' | 'connected' | 'disconnected';
  
  // 连接/断开
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  
  // 登录状态
  login(): Promise<void>;  // 触发 QR 码登录
  logout(): Promise<void>;
  
  // 事件
  onMessage(handler: (msg: BridgeMessage) => void): void;
  onQR(handler: (qr: string) => void): void;  // QR 码更新
  onConnect(handler: () => void): void;
  onDisconnect(handler: () => void): void;
}

interface BridgeMessage {
  from: string;
  to: string;
  content: string;
  type: 'text' | 'image' | 'audio';
  timestamp: number;
}
```

### QR 码处理

```typescript
// electron/bridge/qr.ts
import QRCode from 'qrcode';

async function generateQRDataURL(qr: string): Promise<string> {
  return QRCode.toDataURL(qr, {
    width: 300,
    margin: 2,
    color: { dark: '#000000', light: '#ffffff' }
  });
}
```

### 与 Bus 集成

```typescript
class WhatsAppBridge {
  private bus: MessageBus;
  
  async handleMessage(msg: BridgeMessage) {
    // 转换并发送到 Bus
    const inbound: InboundMessage = {
      channel: 'whatsapp',
      sender_id: msg.from,
      chat_id: msg.to,
      content: msg.content,
      timestamp: new Date(msg.timestamp),
      metadata: { type: msg.type }
    };
    
    this.bus.publishInbound(inbound);
  }
  
  async handleOutbound(msg: OutboundMessage) {
    if (msg.channel !== 'whatsapp') return;
    
    // 发送到 WhatsApp
    await this.sendMessage(msg.chat_id, msg.content);
  }
}
```

### 前端集成

```typescript
// src/components/Bridge/WhatsAppSettings.tsx
function WhatsAppSettings() {
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [status, setStatus] = useState('disconnected');
  
  useEffect(() => {
    const unsubscribe = window.ipcBridge.on('bridge:qr', (qr) => {
      setQrCode(qr);
    });
    
    window.ipcBridge.on('bridge:status', (s) => {
      setStatus(s);
    });
    
    return unsubscribe;
  }, []);
  
  const connect = async () => {
    await window.ipcBridge.invoke('bridge:connect');
  };
  
  if (status === 'disconnected' && qrCode) {
    return <img src={qrCode} alt="Scan QR code" />;
  }
  
  // ...
}
```

### IPC 接口

```typescript
// 主进程 handlers
ipcMain.handle('bridge:connect', () => bridge.connect());
ipcMain.handle('bridge:disconnect', () => bridge.disconnect());
ipcMain.handle('bridge:status', () => bridge.state);

// 事件转发到渲染进程
bridge.onQR((qr) => mainWindow.webContents.send('bridge:qr', qr));
bridge.onConnect(() => mainWindow.webContents.send('bridge:status', 'connected'));
```

## 与 nanobot 的差异

| nanobot | nanobot-desktop |
|---------|----------------|
| 独立 Node.js 进程 | Electron 子模块 |
| WebSocket 通信 | 直接 IPC |
| 远程服务器 | 本地运行 |

## 依赖

```json
{
  "dependencies": {
    "@whiskeysockets/baileys": "^6.0.0",
    "qrcode": "^1.5.0"
  }
}
```

## 实现顺序

1. **P1**: Baileys 连接封装
2. **P2**: QR 码渲染
3. **P3**: 消息转换
4. **P4**: Bus 集成
5. **P5**: 前端 UI

## 注意事项

- WhatsApp 桥接可能违反 WhatsApp 服务条款
- 需要用户提供自己的 WhatsApp 账号
- Baileys 库需要 Node.js 原生模块，可能需要重新编译
