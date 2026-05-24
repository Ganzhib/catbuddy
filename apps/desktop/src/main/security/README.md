# Security 模块

SSRF 与 URL 校验，供 Agent 网络类工具使用。对应 `nanobot/security/network.py`。

| 文件 | 导出 |
|------|------|
| `network.ts` | `validateUrl`, `validateUrlTarget`, `containsInternalUrl`, `MAX_REDIRECTS`, `UNTRUSTED_BANNER` |

`web_fetch` 在每次请求与重定向前调用 `validateUrlTarget`；`exec` 用 `containsInternalUrl` 拦截命令中的内网 URL。
