---
name: dist-electron-gitignore
description: 桌面端 dist-electron/ 被 gitignore，git clean 后必须重建
metadata:
  type: project
---

`apps/desktop/dist-electron/` 是 vite-plugin-electron 的编译产物，不在 git 中。

**Why:** 这是 Vite 编译主进程和预加载脚本的输出目录，gitignore 了。执行 `git clean -fd` 或切换分支后这个目录消失，下次 `pnpm dev:desktop` 会因为找不到入口文件而报错。

**How to apply:** 如果 dev 报错找不到 `dist-electron/index.js`，运行 `cd apps/desktop && pnpm dev:fresh` 强制清理后重建。`pnpm build:desktop` 也会先编译。[[desktop-build-flow]]
