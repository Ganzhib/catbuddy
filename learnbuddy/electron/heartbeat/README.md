# Heartbeat 模块 - 心跳服务

## 功能说明

`heartbeat` 定期唤醒 Agent 检查 `HEARTBEAT.md` 文件，决定是否需要执行任务。

### 工作流程

1. **Phase 1 - 决策**: 读取 `HEARTBEAT.md`，让 LLM 判断是否有待处理任务
2. **Phase 2 - 执行**: 如果有任务，通过完整 Agent Loop 执行
3. **Phase 3 - 通知**: 将结果投送到用户通道

### 核心机制

```typescript
// LLM 工具调用决策
const decision = await llm.chat([
  { role: 'system', content: 'You are a heartbeat agent.' },
  { role: 'user', content: `Review HEARTBEAT.md:\n${content}` }
], {
  tools: [{
    name: 'heartbeat',
    parameters: {
      action: 'skip' | 'run',
      tasks: string
    }
  }]
});
```

## 集成到 learnbuddy-desktop

### 桌面客户端场景

| 场景 | learnbuddy | learnbuddy-desktop |
|------|---------|----------------|
| 定期任务检查 | ✅ | ⚠️ |
| 通知推送 | ✅ | ✅ |
| 后台任务 | ✅ | ✅ |

### 建议目录结构

```
electron/
├── heartbeat/
│   ├── service.ts         # 心跳服务
│   └── types.ts           # 类型定义
```

### HeartbeatService 实现

```typescript
interface HeartbeatConfig {
  intervalMs: number;      // 检查间隔（默认 30 分钟）
  enabled: boolean;
  workspace: string;
}

class HeartbeatService {
  private config: HeartbeatConfig;
  private timer: NodeJS.Timeout | null = null;
  private running = false;
  
  constructor(config: HeartbeatConfig);
  
  start(): void;
  stop(): void;
  
  // 手动触发
  async triggerNow(): Promise<string | null>;
  
  // 检查回调
  onCheck(content: string): Promise<'skip' | 'run'>;
  
  // 执行回调
  onExecute?(tasks: string): Promise<string>;
  
  // 通知回调
  onNotify?(message: string): Promise<void>;
}
```

### HEARTBEAT.md 位置

```typescript
// electron/heartbeat/service.ts
get heartbeatFile(): string {
  return path.join(app.getPath('userData'), 'HEARTBEAT.md');
}
```

### 与通知系统集成

```typescript
class HeartbeatService {
  private async tick(): Promise<void> {
    const content = this.readHeartbeatFile();
    if (!content) return;
    
    const decision = await this.decide(content);
    
    if (decision.action === 'run' && this.onExecute) {
      const response = await this.onExecute(decision.tasks);
      if (this.onNotify && this.isDeliverable(response)) {
        await this.onNotify(response);
      }
    }
  }
}
```

### IPC 接口

```typescript
// 渲染进程控制
ipcMain.handle('heartbeat:status', () => heartbeatService.status());
ipcMain.handle('heartbeat:trigger', () => heartbeatService.triggerNow());
ipcMain.handle('heartbeat:enable', (_, enabled: boolean) => {
  heartbeatService.enabled = enabled;
});

// 文件操作
ipcMain.handle('heartbeat:read', () => readHeartbeatFile());
ipcMain.handle('heartbeat:write', (_, content: string) => writeHeartbeatFile(content));
```

### 前端组件

```typescript
// src/components/Settings/HeartbeatSettings.tsx
function HeartbeatSettings() {
  const [enabled, setEnabled] = useState(false);
  const [interval, setInterval] = useState(30); // 分钟
  const [content, setContent] = useState('');
  
  // 读取 HEARTBEAT.md 内容
  useEffect(() => {
    ipcRenderer.invoke('heartbeat:read').then(setContent);
  }, []);
  
  const save = async () => {
    await ipcRenderer.invoke('heartbeat:write', content);
    await ipcRenderer.invoke('heartbeat:enable', enabled);
  };
  
  // ...
}
```

## 与 learnbuddy 的差异

| learnbuddy | learnbuddy-desktop |
|---------|----------------|
| 文件系统存储 | App Data 目录 |
| 多通道通知 | 桌面通知 + UI |
| 复杂决策 | 简化逻辑 |

## 简化设计

- 默认关闭心跳功能（用户主动开启）
- 简化 LLM 决策 prompt
- 使用 Electron Notification API
