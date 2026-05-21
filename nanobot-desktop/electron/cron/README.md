# Cron 模块 - 定时任务服务

## 功能说明

`cron` 提供定时任务调度，支持三种调度类型：

### 调度类型

1. **at** - 一次性任务（指定时间戳）
2. **every** - 间隔任务（指定毫秒间隔）
3. **cron** - Cron 表达式（如 `0 9 * * *`）

### 核心类型

```typescript
interface CronSchedule {
  kind: 'at' | 'every' | 'cron';
  atMs?: number;        // 一次性任务的时间戳
  everyMs?: number;     // 间隔任务的毫秒数
  expr?: string;        // Cron 表达式
  tz?: string;          // 时区
}

interface CronPayload {
  kind: 'system_event' | 'agent_turn';
  message: string;
  deliver: boolean;
  channel?: string;
  to?: string;
}

interface CronJob {
  id: string;
  name: string;
  enabled: boolean;
  schedule: CronSchedule;
  payload: CronPayload;
  state: CronJobState;
}
```

## 集成到 nanobot-desktop

### 桌面客户端场景

| 场景 | nanobot | nanobot-desktop |
|------|---------|----------------|
| 定时提醒 | ✅ | ✅ |
| 每日摘要 | ✅ | ✅ |
| 定时检查任务 | ✅ | ⚠️ (较少需要) |
| Dream 记忆整合 | ✅ | ❌ |

### 建议目录结构

```
electron/
├── cron/
│   ├── service.ts         # Cron 服务
│   ├── types.ts           # 类型定义
│   └── scheduler.ts       # 调度器
```

### CronService 实现

```typescript
class CronService {
  private jobs: Map<string, CronJob> = new Map();
  private timer: NodeJS.Timeout | null = null;
  
  start(): void;
  stop(): void;
  
  // 作业管理
  addJob(job: CronJob): void;
  removeJob(id: string): boolean;
  enableJob(id: string, enabled: boolean): void;
  
  // 手动触发
  runJob(id: string): Promise<string | null>;
  
  // 列表
  listJobs(): CronJob[];
}
```

### 用户接口

```typescript
// IPC handlers
ipcMain.handle('cron:list', () => cronService.listJobs());
ipcMain.handle('cron:add', (_, job: CronJob) => cronService.addJob(job));
ipcMain.handle('cron:remove', (_, id: string) => cronService.removeJob(id));
ipcMain.handle('cron:run', (_, id: string) => cronService.runJob(id));
```

### 前端 UI

在设置面板中添加定时任务管理：

```typescript
// src/components/Settings/CronSettings.tsx
function CronSettings() {
  const [jobs, setJobs] = useState<CronJob[]>([]);
  
  const addJob = async (schedule: CronSchedule, message: string) => {
    await ipcRenderer.invoke('cron:add', { schedule, message });
    refreshJobs();
  };
  
  // ...
}
```

## 持久化

使用 electron-store 持久化任务：

```typescript
// electron/cron/store.ts
import Store from 'electron-store';

const store = new Store<{ jobs: CronJob[] }>({
  name: 'cron-jobs',
  defaults: { jobs: [] }
});
```

## 与 nanobot 的差异

| nanobot | nanobot-desktop |
|---------|----------------|
| 文件锁持久化 | electron-store |
| 复杂多实例 | 单实例 |
| 文件系统 action | IPC action |

## 简化设计

- 移除系统任务（Dream）
- 仅支持简单的 at 和 every 调度
- 简化状态管理
