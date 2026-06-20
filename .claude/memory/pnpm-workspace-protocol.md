---
name: pnpm-workspace-protocol
description: 内部包引用必须用 workspace:* 协议，不能写死版本号
metadata:
  type: project
---

所有 workspace 内部包引用使用 `"@catbuddy/shared": "workspace:*"` 格式，不要写死版本号如 `"0.1.0"`。

**Why:** pnpm workspace 协议保证开发时始终引用本地源码，同时发布时 pnpm 自动替换为实际版本号。写死版本号会导致引用了错误版本的包。

**How to apply:** 在 package.json 中添加内部依赖时用 `pnpm --filter @catbuddy/desktop add @catbuddy/shared@workspace:*`。[[monorepo-package-deps]]
