# 旧 `webui/` 前端已废弃

nanobot 仓库根目录下的 **`webui/`** 不再作为 learnbuddy 的 Web 前端维护。

## 替代方案

| 能力 | 新位置 |
|------|--------|
| 共享 React UI | `learnbuddy/packages/ui` (`@learnbuddy/ui`) |
| 浏览器应用 | `learnbuddy/apps/web` |
| 桌面应用 | `learnbuddy/apps/desktop` |
| Gateway 联调 | `pnpm dev:web`（见 [README.md](../README.md)） |

## 开发入口

```bash
cd learnbuddy
pnpm install
pnpm dev:web    # 需本地 nanobot gateway（默认 http://127.0.0.1:8765）
pnpm dev:desktop
```

迁移背景与验收清单见 [MONOREPO_MIGRATION.md](./MONOREPO_MIGRATION.md)。
