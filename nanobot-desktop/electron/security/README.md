# Security 模块 - 网络安全

## 功能说明

`security` 模块提供 SSRF（服务器端请求伪造）防护，包括：

### 核心功能

1. **URL 验证** - 检查 URL 目标和解析后的 IP
2. **内部地址检测** - 阻止访问私有 IP、localhost 等
3. **命令注入防护** - 检测命令中的内部 URL

### 阻止的网络范围

```typescript
const BLOCKED_NETWORKS = [
  '0.0.0.0/8',      // 当前网络
  '10.0.0.0/8',     // 私有网络
  '172.16.0.0/12',  // 私有网络
  '192.168.0.0/16', // 私有网络
  '127.0.0.0/8',    // localhost
  '169.254.0.0/16', // 链路本地
  '::1/128',        // IPv6 localhost
  'fc00::/7',      // IPv6 唯一本地
  'fe80::/10',     // IPv6 链路本地
];
```

## 集成到 nanobot-desktop

### 建议目录结构

```
electron/
├── security/
│   ├── network.ts          # URL 验证
│   ├── config.ts           # 安全配置
│   └── index.ts            # 导出
```

### 核心实现

```typescript
// electron/security/network.ts

export function validateUrlTarget(url: string): ValidationResult {
  // 1. 检查协议
  // 2. 检查主机名
  // 3. DNS 解析
  // 4. 检查 IP 是否私有
  return { ok: boolean; error?: string };
}

export function containsInternalUrl(command: string): boolean {
  // 检测命令中是否包含私有 URL
}

export function configureSSRFWhitelist(cidrs: string[]): void {
  // 允许特定 CIDR 绕过（如 Tailscale）
}
```

### 安全配置

```typescript
// electron/security/config.ts
interface SecurityConfig {
  ssrfProtection: boolean;
  whitelist: string[];  // 允许的 CIDR
  blockedPatterns: string[];
}

const DEFAULT_CONFIG: SecurityConfig = {
  ssrfProtection: true,
  whitelist: [],
  blockedPatterns: [
    'localhost',
    '127.0.0.1',
    '0.0.0.0',
  ]
};
```

### Agent 集成

在 Agent 执行工具调用前验证 URL：

```typescript
// electron/agent/tools/web.ts
async function fetchUrl(url: string): Promise<string> {
  // 验证 URL 安全性
  const [ok, error] = validateUrlTarget(url);
  if (!ok) {
    throw new Error(`SSRF blocked: ${error}`);
  }
  
  // 执行请求
  return fetch(url);
}
```

### IPC 接口

```typescript
ipcMain.handle('security:validate-url', (_, url: string) => {
  return validateUrlTarget(url);
});

ipcMain.handle('security:set-whitelist', (_, cidrs: string[]) => {
  configureSSRFWhitelist(cidrs);
});
```

## 与 nanobot 的差异

| nanobot | nanobot-desktop |
|---------|----------------|
| Web 搜索安全 | 本地请求验证 |
| Shell 命令检查 | 工具调用验证 |
| 多租户隔离 | 单用户桌面 |

## 简化设计

桌面客户端的攻击面更小，但仍然需要：

1. **SSRF 防护** - 防止恶意网页内容发起内部请求
2. **文件路径验证** - 防止路径遍历
3. **API Key 保护** - 加密存储

## 实现建议

```typescript
// 验证 fetch 请求
window.fetch = new Proxy(window.fetch, {
  apply(target, thisArg, args) {
    const url = args[0];
    if (typeof url === 'string') {
      const [ok, error] = validateUrlTarget(url);
      if (!ok) {
        console.error('Blocked SSRF attempt:', error);
        return Promise.reject(new Error('Blocked'));
      }
    }
    return target.apply(thisArg, args);
  }
});
```
