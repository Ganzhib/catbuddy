---
name: shared-package-rebuild
description: 修改 @catbuddy/shared 后必须手动重建，否则其他包的 tsc 报错
metadata:
  type: project
---

修改 `packages/shared/src/` 中的类型或协议后，必须运行 `pnpm --filter @catbuddy/shared build`。

**Why:** shared 是 workspace 依赖，其他包 import 它的编译产物（`dist/`）。shared 改了 `.ts` 源码后如果不重建，下游包的 `tsc --noEmit` 会报"类型不存在"等错误，尽管源码已经更新。

**How to apply:** 每次修改 shared 后在终端重建，或在依赖 shared 的 PR 中把 shared build 作为第一步。CI 也应该先 build shared 再 lint 其他包。[[monorepo-package-deps]]
