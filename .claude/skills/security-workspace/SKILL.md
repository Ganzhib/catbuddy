---
name: security-workspace
description: 安全边界与工作空间隔离 — PathGuard、SSRF 防护、文件访问策略
---

# 安全与工作空间隔离

安全模块位于 [apps/desktop/src/main/security/](apps/desktop/src/main/security/)，负责 Agent 运行时的安全边界——决定 Agent 能访问哪些文件、能连接哪些网络地址。

## 三层安全架构

```
WorkspaceFileAccessPolicy  ← 策略层（"允许多大范围"）
         │
         ▼
    PathGuard               ← 执行层（统一路径解析与拦截）
         │
         ▼
    工具层 (ToolRegistry)    ← 消费层（所有文件工具经过 PathGuard）
```

## 策略层 — workspace-access.ts

`computeWorkspaceFileAccess()` 根据工作空间配置计算访问策略：

| 模式 | 条件 | 允许范围 |
|------|------|----------|
| `internal` | 用户在用户主目录下使用 catbuddy | 仅 `.catbuddy/workspace/` 内部 |
| `project` | 用户导入了外部项目目录（如 `D:/Projects/foo`） | 项目根目录（`.catbuddy` 同级目录） |

### 敏感地区判定

`isSensitiveProjectRoot()`：当 `projectRoot === 用户主目录` 时判定为敏感地区，强制限制为 `internal` 模式。这防止 Agent 在未经明确授权的情况下访问用户的个人文件。

## 执行层 — path-guard.ts

`PathGuard` 是所有文件/路径操作的统一拦截点：

```typescript
class PathGuard {
  resolve(inputPath: string): string     // 解析路径 + 权限检查
  assertAllowed(resolved: string): void  // 硬拦截
  displayPath(resolved: string): string  // 相对路径显示
  get workRoot(): string                 // 工具默认工作目录
  get boundary(): string                 // 允许的路径边界
}
```

**核心逻辑**：任何被解析后的路径如果不在 `boundary` 内，抛出 `Access denied` 错误。

**特殊保护**：`.catbuddy/` 元数据目录在 `internal` 模式下被保护（Agent 不能修改自己的配置和记忆文件，除非显式允许 `workspace` 子目录）。

## 网络安全 — network.ts

`validateUrlAndCheckSsrF()` 防止 SSRF（服务器端请求伪造）：

| 拦截项 | 说明 |
|--------|------|
| 协议限制 | 只允许 `http:` 和 `https:` |
| 内网 IP 拦截 | `10.x`, `127.x`, `192.168.x`, `172.16-31.x`, `169.254.x`, `100.64-127.x` |
| IPv6 拦截 | `::1`, `fe80:`(link-local), `fc`/`fd`(unique local) |
| 主机名黑名单 | `localhost`, `metadata.google.internal` |
| DNS 重绑定防护 | 两次 DNS 解析结果对比，IP 变化则拒绝 |
| 重定向跟踪 | 最多 5 次重定向，每次检查目标 IP |

## 消费者

安全模块被以下组件使用：

| 消费者 | 使用的模块 |
|--------|-----------|
| `ToolRegistry` | PathGuard（所有文件工具） |
| `exec` 工具 | PathGuard + SSRF 检查 |
| `web_fetch` / `web_search` | SSRF 检查 |
| `ContextBuilder` | WorkspaceFileAccessPolicy（生成 `identity.md`） |
| 子 Agent | PathGuard（继承父 Agent 的访问策略） |

## 关键文件

| 文件 | 作用 |
|------|------|
| [security/index.ts](apps/desktop/src/main/security/index.ts) | 统一导出 |
| [security/workspace-access.ts](apps/desktop/src/main/security/workspace-access.ts) | 访问策略计算 |
| [security/path-guard.ts](apps/desktop/src/main/security/path-guard.ts) | 路径拦截执行 |
| [security/network.ts](apps/desktop/src/main/security/network.ts) | SSRF/URL 校验 |

## 修改安全策略指南

1. **调整文件访问范围** → 修改 `workspace-access.ts` 的策略逻辑
2. **添加路径拦截规则** → 修改 `path-guard.ts` 的 `assertAllowed()`
3. **添加 SSRF 防护规则** → 修改 `network.ts` 的 `BLOCKED_HOSTNAMES` 或 `isBlockedIp()`
4. **新增网络安全检查** → 在 `network.ts` 中添加验证函数，从 `security/index.ts` 导出
