---
name: langfuse-tracing
description: Langfuse LLM 可观测性 — 追踪架构、PII 脱敏、自托管部署
---

# Langfuse 可观测性

Langfuse 提供 LLM 调用的全链路追踪——记录每次生成调用、工具执行、Token 用量和延迟。这对调试 Agent 行为和监控成本至关重要。

## 架构

```
AgentRunner → LangfuseAgentHook → LangfuseClient → Langfuse API
                                                      │
                                      ┌───────────────┴───────────────┐
                                      │  自托管 (Docker Compose)        │
                                      │  langfuse-docker/deploy.cjs     │
                                      └───────────────────────────────┘
```

## 关键文件

| 文件 | 作用 |
|------|------|
| [apps/desktop/src/main/agent/langfuse-client.ts](apps/desktop/src/main/agent/langfuse-client.ts) | Langfuse SDK 封装——初始化客户端、管理 trace/span |
| [apps/desktop/src/main/agent/langfuse-hook.ts](apps/desktop/src/main/agent/langfuse-hook.ts) | Agent 钩子——在 AgentRunner 各生命周期拦截，创建追踪 |
| [langfuse-docker/deploy.cjs](langfuse-docker/deploy.cjs) | 一键自托管部署脚本 |
| [docs/langfuse/langfuse-architecture.md](docs/langfuse/langfuse-architecture.md) | 架构文档 |
| [docs/langfuse/langfuse-integration.md](docs/langfuse/langfuse-integration.md) | 集成详情 |
| [docs/langfuse/langfuse-self-hosted.md](docs/langfuse/langfuse-self-hosted.md) | 自托管部署指南 |
| [scripts/test-langfuse.mjs](scripts/test-langfuse.mjs) | Langfuse 连接测试脚本 |

## LangfuseClient（langfuse-client.ts）

封装 `langfuse` npm SDK，职责：

- 用凭证初始化客户端（公钥、密钥、Host URL）
- 为每次 LLM 生成创建 trace 和 span
- 追踪 Token 用量（输入/输出 Token、成本估算）
- **PII 脱敏**：自动在发送前清洗敏感数据
  - API Key、密码、Token 等会被自动检测并打码
  - 用户内容可基于配置脱敏
  - `.env`、`credentials.json` 等敏感文件内容绝不上传
- 应用退出时 flush 数据，防止丢失

## LangfuseAgentHook（langfuse-hook.ts）

实现 `AgentHook` 接口，在 AgentRunner 关键节点注入追踪：

| 生命周期 | 操作 |
|----------|------|
| `onGenerationStart` | 创建新的 generation span |
| `onGenerationComplete` | 记录输出内容、Token 用量、延迟 |
| `onToolCall` | 在 generation 内创建工具执行 span |
| `onError` | 记录错误及上下文 |

## 环境变量

| 变量 | 必填 | 说明 |
|------|------|------|
| `LANGFUSE_SECRET_KEY` | 是 | Langfuse 密钥 |
| `LANGFUSE_PUBLIC_KEY` | 是 | Langfuse 公钥 |
| `LANGFUSE_HOST` | 是 | Langfuse API 地址 |
| `LANGFUSE_ENABLED` | 否 | 设为 `false` 禁用（默认：有密钥时自动启用） |

## 自托管部署

```bash
# 完整远程部署
pnpm deploy:langfuse

# 仅本地打包测试
pnpm deploy:langfuse:pack
```

部署脚本会通过 Docker Compose 启动以下服务：
- **Langfuse Server** — 主服务
- **PostgreSQL** — 元数据存储
- **ClickHouse** — 追踪数据存储（高性能分析）
- **MinIO** — S3 兼容对象存储

## 工具脚本

### `test-langfuse.mjs` — Langfuse 集成验证

```bash
node scripts/test-langfuse.mjs
```

测试覆盖：

| 测试项 | 说明 |
|--------|------|
| `estimateCost` | Token 成本估算（DeepSeek、GPT-4、Codex 等模型的输入/输出价格） |
| `maskSensitiveData` | PII 脱敏：API Key（`sk-...`、`dsk-...`）、密码字段、Bearer Token |
| `nestSpanHierarchy` | Trace→Span→Generation 层级结构验证 |
| `traceMerge` | 多 span 合并到同一 trace 的逻辑 |
| 模块导入完整性 | 验证 `langfuse`、`langfuse-client`、`langfuse-hook` 等模块可正常导入 |

**测试失败排查**：
1. 检查 `.env` 中的 `LANGFUSE_*` 环境变量是否正确
2. 确认 Langfuse 服务可访问（`curl $LANGFUSE_HOST/health`）
3. 如果是自托管，确认 `langfuse-docker/docker-compose.yml` 中所有容器正常运行

### `langfuse-docker/deploy.cjs` — 自托管一键部署

```bash
pnpm deploy:langfuse             # 完整远程部署
pnpm deploy:langfuse:pack        # 仅本地打包，跳过上传
```

部署脚本执行步骤：
1. 读取 `langfuse-docker/docker-compose.yml`
2. 打包 Langfuse Server + PostgreSQL + ClickHouse + MinIO 配置
3. 推送到远程服务器
4. 远程执行 `docker compose up -d`
5. 验证所有容器健康状态

## 数据安全

`langfuse-client.ts` 中的 PII 脱敏系统：

- **API Key 检测**：自动识别 `sk-...`、`dsk-...` 等 Key 模式并脱敏
- **敏感文件过滤**：`.env`、`credentials.json` 等文件内容绝不上传
- **可配置脱敏规则**：用户可在 catbuddy 配置中添加自定义脱敏规则

## 新增追踪事件

要添加新的追踪类型：

1. 在 `langfuse-client.ts` 中定义事件接口
2. 添加 `trackXxx()` 方法，创建带有合适属性的 span
3. 在 `langfuse-hook.ts` 的对应生命周期节点调用
4. 确保在发送前经过 PII 脱敏处理
