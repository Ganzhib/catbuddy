---
name: windows-mcp-compat
description: Windows 上 MCP 服务器的 shell 启动器（npx/pnpm）需要通过 cmd.exe 包装执行
metadata:
  type: project
---

在 Windows 上，MCP 服务器的 `command: "npx"` 不能直接作为子进程启动，需要通过 `cmd.exe /d /c` 包装。

**Why:** Windows 不像 Unix 可以直接执行 shell 脚本。`npx`、`pnpm`、`bunx` 等是 `.cmd` 包装脚本，必须通过 cmd.exe 启动。

**How to apply:** `normalizeWindowsStdioCommand()` 在 `tools/mcp.ts` 中处理此逻辑。添加新的 shell 启动器时，把它加到 `WINDOWS_SHELL_LAUNCHERS` Set 中。[[mcp-integration]]
