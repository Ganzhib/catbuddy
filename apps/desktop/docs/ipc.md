# IPC 与 Preload API

渲染进程通过 `window.catbuddy` 访问主进程能力；禁止 `nodeIntegration`，所有能力经 Preload 白名单暴露。

## 安全模型

| 项 | 设置 |
|----|------|
| `contextIsolation` | `true` |
| `nodeIntegration` | `false` |
| Preload | `src/preload/index.cjs` |

`src/preload/security/index.cjs` 在 `contextBridge.exposeInMainWorld` 前校验 API 对象（禁止 `__proto__` 等危险键）。扩展 API 时勿暴露任意 `ipcRenderer.invoke` 包装。

## Preload 结构

```
src/preload/
├── index.cjs              # 入口：组装 API 并 expose
├── api/
│   ├── ipc-channels.cjs   # 通道名常量（与主进程一致）
│   └── index.cjs          # createCatbuddyApi()
└── security/
    └── index.cjs
```

TypeScript 类型：`packages/platform/src/preload-api.d.ts`（renderer 通过 `vite-env.d.ts` 引用）。

## 调用约定

- **请求/响应**：`ipcRenderer.invoke(channel, payload)` → `ipcMain.handle(channel, …)`
- **主进程推送**：`webContents.send(channel, data)` → Preload 中 `ipcRenderer.on` + 返回取消订阅函数

Session 键默认规则（`ipcHandlers/index.ts`）：

- 无 `chatId` → `desktop:main`
- 有 `chatId` 且不以 `desktop:` 开头 → `desktop:{chatId}`

## IPC 通道清单

### Agent

| 通道 | 方向 | 说明 |
|------|------|------|
| `agent:send` | invoke | 用户消息 → `bus.publishInbound` |
| `agent:stop` | invoke | 取消指定 session 的运行 |
| `agent:status` | invoke | 运行状态、模型、活跃 session 数 |
| `agent:stream-delta` | push | 流式文本增量 |
| `agent:stream-end` | push | 流结束 |
| `agent:reasoning-delta` | push | 推理流增量 |
| `agent:reasoning-end` | push | 推理流结束 |
| `agent:tool-progress` | push | 工具执行进度 |
| `agent:file-edit` | push | 文件编辑事件 |
| `agent:retry-wait` | push | 重试等待提示 |
| `agent:turn-complete` | push | 单轮完成 |
| `agent:system-message` | push | 系统消息 |
| `agent:assistant-message` | push | 助手完整消息 |
| `agent:gateway-inbound` | push | Gateway 注入的用户消息 |

### Session

| 通道 | 方向 | 说明 |
|------|------|------|
| `session:list` | invoke | 会话列表 |
| `session:get` | invoke | 会话详情 |
| `session:delete` | invoke | 删除会话 |
| `session:clear` | invoke | 清空会话历史 |
| `session:new` | invoke | 新建会话 |
| `session:created` | push | Gateway 创建会话通知 |

### Config / Workspace / Skills

| 通道 | 方向 | 说明 |
|------|------|------|
| `config:get` | invoke | 读取完整配置 |
| `config:update` | invoke | 按路径更新（可热更新模型、Provider） |
| `config:list-models` | invoke | 模型预设列表 |
| `config:set-model` | invoke | 切换模型预设 |
| `workspace:get` | invoke | 当前工作区路径 |
| `workspace:select` | invoke | 目录选择对话框 |
| `workspace:open-file` | invoke | 用系统默认应用打开工作区内的文件 |
| `skills:list` | invoke | Skill 列表 |
| `skills:toggle` | invoke | 启用/禁用 Skill |

### App / Channels / Gateway

| 通道 | 方向 | 说明 |
|------|------|------|
| `app:restart` | invoke | 重启应用 |
| `channels:status` | invoke | desktop / gateway 通道状态 |
| `gateway:status` | invoke | Gateway 客户端状态 |
| `gateway:subscribe-session` | invoke | 订阅会话同步 |
| `gateway:sync-all-sessions` | invoke | 同步全部会话到 Gateway |
| `gateway:set-account-email` | invoke | 设置账号邮箱并重建连接 |
| `gateway:auth-post` | invoke | 主进程向 Gateway 发 auth POST（login/register 等） |
| `gateway:get-remote-enabled` | invoke | 远程开关与环境是否配置 |
| `gateway:set-remote-enabled` | invoke | 开关远程并写回 config |

主进程侧注册位置：

- 通用：`src/main/ipcHandlers/index.ts`
- Gateway 远程：`src/main/services/gateway-remote.ts`

TypeScript 侧另有 `src/main/constant/ipc.ts`（部分通道，可与 preload 保持同步）。

## Renderer 使用示例

```typescript
// 发送消息
await window.catbuddy.sendMessage(chatId, '你好')

// 订阅流式输出
const off = window.catbuddy.onStreamDelta(({ chatId, content }) => {
  // 更新 UI
})
// 组件卸载时
off()
```
