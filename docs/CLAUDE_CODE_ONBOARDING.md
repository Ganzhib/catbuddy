# Claude Code 队友上手指南

> 读完这篇，你就能用 Claude Code 高效开发 catbuddy。

---

## 1. 安装 Claude Code

```bash
# 全局安装
npm install -g @anthropic-ai/claude-code

# 验证
claude --version
```

启动：在项目目录下运行 `claude`，或 VS Code 装 Claude Code 插件用 `Ctrl+Shift+P → Claude Code: Open`。

---

## 2. 克隆后第一件事

```bash
git clone <repo-url> && cd catbuddy
pnpm install
```

**`.claude/` 目录已经配好了**，拉下来就能用。不需要额外配置。

---

## 3. 每天怎么用

### 最常用的 3 个技能

```bash
# 项目大局观 — 不知道该改哪个包时先问
/catbuddy-dev

# Agent 引擎 — 改 loop/runner/tools/memory 前必看
/agent-system

# 架构守门员 — 写新代码不确定会不会破坏架构时看
/architecture-guard
```

### 记住这几条就行

| 场景 | 用这个 |
|------|--------|
| 改 Agent 逻辑 | `/agent-system` |
| 改桌面/Electron | `/desktop-app` |
| 改 Gateway | `/gateway` |
| 加新 Provider | `/llm-providers` |
| 加新命令 | `/command-system` |
| 加 MCP 服务 | `/mcp-integration` |
| 动了安全相关 | `/security-workspace` |
| 加定时任务 | `/heartbeat-cron` |
| 调试 Langfuse | `/langfuse-tracing` |
| Code Review | `/review-changes` |
| 全局类型检查 | `/type-check-all` |
| **不确定架构对不对** | `/architecture-guard` |

---

## 4. 权限 — 不会频繁弹窗

项目里 `settings.json` 已经预授权了以下命令，**不会弹确认框**：

- `pnpm *` — 所有包管理操作
- `git status/diff/log/branch/stash` — 只读 git
- `npx tsc *` — 类型检查
- `node scripts/*` — 工具脚本
- `ls/find/cat/mkdir/echo` — 基础文件操作

**本地个人的** `settings.local.json` 额外允许 `git add/commit/push/checkout/rebase`。

---

## 5. Hooks — 自动提醒

改了 `packages/shared/` 的 `.ts` 文件时，Claude 会自动提醒你：

```
[!] shared包有变更，下游包需重建: pnpm -F @catbuddy/shared build
```

不用记，Claude 会提醒你。

---

## 6. Memory — 踩坑不会重复

`.claude/memory/` 存了 5 条项目最容易踩的坑：

| 记忆 | 一句话 |
|------|--------|
| shared 重建 | 改了 shared 类型 → 必须 build，否则下游 tsc 报错 |
| dist-electron | git clean 后桌面起不来 → 运行 `dev:fresh` |
| workspace 协议 | 内部引用用 `workspace:*`，别写死版本号 |
| 三层消息类型 | 新增字段 → 5 处同步（类型2处 + 写入1处 + DB1处 + 转换1处） |
| Windows MCP | Windows 上 npx MCP 需 cmd.exe 包装 |

Claude 每次启动会自动加载这些记忆，你不用主动记。

---

## 7. Workflows — 一键审查

```bash
# 对当前分支的改动做安全 + 正确性 + 架构三维审查
/review-changes

# 并行检查全部 8 个包的 TypeScript 类型
/type-check-all
```

`/review-changes` 会：
1. 获取 `git diff origin/master` 变更文件
2. 3 个 Agent 并行审查：安全漏洞、正确性 bug、架构违规
3. 汇总输出：`X 个发现 (N高/M中/K低)`

---

## 8. 日常开发流

```
1. 拉分支
   git checkout -b yourname/feature/xxx

2. 写代码前看技能
   /catbuddy-dev        # 回忆包结构
   /architecture-guard   # 回忆设计原则

3. 写代码
   Claude 辅助，skill 提供上下文
   自动提醒 shared 包需重建

4. 提交前自查
   /type-check-all      # 全量类型检查
   /review-changes      # 三维审查

5. 提交
   feat(scope): 描述
   Co-Authored-By: Claude <noreply@anthropic.com>
```

---

## 9. 常见问题

**Q: Claude 说不认识 `/xxx` 命令？**
A: 确认你在 `catbuddy/` 根目录下启动的 Claude Code。`.claude/skills/` 在根目录。

**Q: 弹权限框太多？**
A: 正常的 `pnpm`、`git status`、`ls` 已经预授权了。如果你用的命令没有，那是故意的（安全考虑）。

**Q: 想加自己的权限？**
A: 编辑 `.claude/settings.local.json`（这个文件 gitignore 了，不会提交）。

**Q: 想加新的记忆/技能/工作流？**
A: 
- 记忆：`.claude/memory/` 下新建 `.md`，按已有格式写 frontmatter
- 技能：`.claude/skills/<名字>/SKILL.md`
- 工作流：`.claude/workflows/<名字>.js`

---

## 10. 快速参考卡片

```
┌─────────────────────────────────────────────┐
│  catbuddy Claude Code 快速参考               │
├─────────────────────────────────────────────┤
│  安装    npm i -g @anthropic-ai/claude-code  │
│  启动    cd catbuddy && claude                │
│                                             │
│  开发前  /catbuddy-dev  /architecture-guard   │
│  开发中  Claude 自动提醒 shared 重建           │
│  提交前  /type-check-all  /review-changes    │
│                                             │
│  11个技能   / 键查看完整列表                   │
│  5条记忆   自动加载，无需手动操作               │
│  2个工作流  一键审查 + 一键类型检查             │
└─────────────────────────────────────────────┘
```
