# Security 模块

Agent 运行时安全边界，供工具层、工作区切换、系统提示词共用。

| 文件 | 职责 | 消费者 |
|------|------|--------|
| `network.ts` | SSRF / URL 校验 | `web_fetch`, `exec` |
| `workspace-access.ts` | 工作区访问**策略**（敏感地区判定） | `workspace-anchor`, `identity.md` |
| `path-guard.ts` | 路径 **enforcement**（PathGuard） | `ToolRegistry`, 子 agent |

## 设计

```
WorkspaceFolder?  ──► computeWorkspaceFileAccess()  ──► WorkspaceFileAccessPolicy
                                                              │
projectRoot + catbuddyDir + workspace ◄───────────────────────┘
         │
         ▼
    PathGuard.resolve() / assertAllowed()
         │
         ├── ToolRegistry (read/write/edit/exec/grep)
         └── ContextBuilder → identity.md (work_root + mode 说明)
```

- **策略与 enforcement 分离**：`workspace-access` 只回答「允许多大范围」；`PathGuard` 统一解析与拦截路径。
- **敏感地区**：`projectRoot === 用户主目录` 时仅允许内部 `workspace`；用户导入的非主目录项目则允许 `.catbuddy` 同级文件夹。
- **network** 与 **filesystem** 并列，均从 `security/index.ts` 导出。

完整设计文档（含分层记忆、`.catbuddy` 目录说明）：[`docs/workspace-and-memory.md`](../../../docs/workspace-and-memory.md)
