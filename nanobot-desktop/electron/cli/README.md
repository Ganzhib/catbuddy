# CLI 模块 - 命令行界面

## 功能说明

nanobot 的 CLI 模块提供终端交互界面，包括：
- 交互式输入（支持历史、粘贴、多行）
- 流式输出渲染
- 命令行参数解析

## 集成到 nanobot-desktop

### 分析

桌面客户端不需要传统 CLI，但可以复用以下组件：

| nanobot CLI 功能 | 桌面客户端需求 |
|-----------------|---------------|
| 交互式输入 | ❌ (使用 React UI) |
| 流式输出渲染 | ⚠️ (可复用渲染逻辑) |
| 命令行参数 | ❌ (使用 Electron flags) |
| Onboarding 向导 | ✅ (设置向导) |
| 配置管理 | ✅ (设置面板) |

### 建议目录结构

```
electron/
├── cli/
│   ├── onboard.ts          # 初始化向导
│   ├── models.ts          # 模型信息
│   └── config.ts          # 配置管理
```

### Onboarding 向导

桌面客户端需要一个引导用户配置 API Key 的向导：

```typescript
interface OnboardResult {
  config: AppConfig;
  shouldSave: boolean;
}

async function runOnboard(): Promise<OnboardResult> {
  // 步骤 1: 选择 Provider (OpenAI / Anthropic / 自定义)
  // 步骤 2: 输入 API Key
  // 步骤 3: 选择模型
  // 步骤 4: 确认配置
}
```

### 配置模型

```typescript
// electron/config/schema.ts
interface AppConfig {
  version: string;
  providers: {
    openai?: { apiKey: string; model?: string; };
    anthropic?: { apiKey: string; model?: string; };
  };
  agents: {
    defaults: {
      model: string;
      temperature?: number;
      maxTokens?: number;
    };
  };
  appearance: {
    theme: 'light' | 'dark' | 'system';
    language: 'zh-CN' | 'en-US';
  };
}
```

### IPC 命令

```typescript
// 注册 IPC handlers
ipcMain.handle('config:get', () => config);
ipcMain.handle('config:set', (_, config) => setConfig(config));
ipcMain.handle('config:save', () => saveConfig());
ipcMain.handle('onboard:run', () => runOnboardWizard());
```

## 与 nanobot 的差异

| nanobot | nanobot-desktop |
|---------|----------------|
| Typer CLI 框架 | Electron IPC |
| Rich 终端渲染 | React 组件 |
| 复杂多命令 | 单一应用 |
| 插件加载 | 静态编译 |

## 优先级

- **P1**: 配置加载/保存
- **P2**: Onboarding 向导
- **P3**: 模型选择 UI
