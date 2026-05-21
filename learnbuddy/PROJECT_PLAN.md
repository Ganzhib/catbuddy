# learnbuddy Desktop — 项目计划

## 项目概述
基于 Electron + React + TypeScript 的 AI 桌面客户端，集成 Anthropic / OpenAI 等多模型 API，支持会话管理、Markdown 渲染、国际化等。

## 技术栈
- **框架**: Electron 33 + React 18 + Vite 5
- **样式**: Tailwind CSS + Radix UI + Lucide Icons
- **AI SDK**: Anthropic SDK + OpenAI SDK
- **语言**: TypeScript (strict)
- **构建**: electron-builder (Win/Mac/Linux)

## 项目结构
```
learnbuddy-desktop/
├── electron/          # 主进程
│   ├── agent/         # AI 对话引擎
│   ├── config/        # 配置管理
│   ├── ipc/           # IPC 通道定义
│   ├── providers/     # 模型提供商封装
│   ├── session/       # 会话管理
│   ├── main.ts        # Electron 入口
│   └── preload.ts     # 预加载脚本
├── src/               # 渲染进程 (React)
│   ├── components/    # UI 组件
│   ├── hooks/         # 自定义 Hooks
│   ├── i18n/          # 国际化 (中/英)
│   ├── lib/           # 工具函数
│   ├── providers/     # React Context Providers
│   ├── types/         # 前端类型定义
│   ├── workers/       # Web Workers
│   ├── App.tsx
│   ├── main.tsx
│   └── globals.css
├── shared/            # 前后端共享类型
│   └── types.ts
└── 配置文件...
```

## 当前状态
- ✅ 基础工程搭建（Vite + Electron + React + TypeScript）
- ✅ 项目目录结构已规划
- ✅ 依赖安装完毕（含 AI SDK、UI 库、国际化等）
- ✅ 多平台打包配置完成
- ✅ 共享类型定义文件已创建

## 待完成事项

### Phase 1 — MVP 可对话（M1）
- [ ] **`shared/types.ts`** — 补全 IPC 消息类型、会话类型、消息类型
- [ ] **`electron/agent/`** — 实现 Anthropic/OpenAI 调用引擎
- [ ] **`electron/session/`** — 会话 CRUD + 本地 JSON 持久化
- [ ] **`electron/ipc/`** — 注册 IPC handlers（发送消息、管理会话、配置读写）
- [ ] **`electron/preload.ts`** — 暴露安全的 IPC API 到渲染进程
- [ ] **`src/` 聊天 UI** — 消息列表 + 输入框 + 发送按钮（基础版）
- [ ] **`src/` Markdown 渲染** — react-markdown + 代码高亮 + LaTeX

### Phase 2 — 多模型与会话管理（M2）
- [ ] **`electron/providers/`** — 多提供商抽象层（Anthropic / OpenAI / 自定义）
- [ ] **`electron/config/`** — API Key 加密存储、模型选择持久化
- [ ] **会话侧边栏** — 新建/切换/删除/重命名会话
- [ ] **设置面板** — API Key 配置、模型选择、主题切换、语言切换
- [ ] **Token 计数** — 实时显示输入/输出 token 数

### Phase 3 — 增强功能（M3）
- [ ] **i18n 国际化** — 完善中/英文语言包
- [ ] **主题系统** — 亮色/暗色模式切换
- [ ] **对话导出** — Markdown / JSON / 纯文本导出
- [ ] **消息操作** — 复制、重新生成、编辑已发送消息

### Phase 4 — 质量与发布（M4）
- [ ] **错误处理** — API 异常、网络超时、重试机制、用户提示
- [ ] **单元测试** — 核心逻辑（agent、session、provider）使用 Vitest
- [ ] **集成测试** — IPC 通信流程测试
- [ ] **打包验证** — 在 Win/Mac/Linux 上测试构建产物
- [ ] **发布流程** — 版本号管理、CHANGELOG.md、GitHub Release

## 里程碑
| 阶段 | 目标 | 预计时间 |
|------|------|----------|
| M1 | 可对话的 MVP（单模型 + 基础 UI） | 1-2 周 |
| M2 | 多模型支持 + 会话管理 + 设置面板 | 2-3 周 |
| M3 | 国际化 + 主题 + 导出 + 消息操作 | 1 周 |
| M4 | 测试 + 打包 + 发布 v0.1.0 | 1 周 |

## 开发命令
```bash
npm run dev          # 开发模式（Vite + Electron 热更新）
npm run build        # TypeScript 检查 + 构建 + 打包
npm run build:unpack # 构建 + 解包（调试用）
npm run lint         # TypeScript 类型检查
```
