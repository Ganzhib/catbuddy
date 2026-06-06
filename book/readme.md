# CatBuddy 技术专栏

从零到一构建一个 AI 编程助手——36,000 行 TypeScript，27 篇文章，覆盖 Agent 引擎、工具系统、传输层、存储层、记忆系统、模型管理的全栈实践。

---

## 第一章：为什么是 CatBuddy

| 篇 | 标题 | 文件 |
|----|------|------|
| 01 | 为什么需要又一个 AI 编程助手？ | [02-为什么需要又一个AI编程助手.md](./02-为什么需要又一个AI编程助手.md) |
| 02 | 三块积木：Desktop、Gateway、Web 怎么拼在一起 | [03-三块积木-Desktop-Gateway-Web怎么拼在一起.md](./03-三块积木-Desktop-Gateway-Web怎么拼在一起.md) |
| 03 | Monorepo：一个仓库管 12 个包的工程哲学 | [04-Monorepo-一个仓库管12个包的工程哲学.md](./04-Monorepo-一个仓库管12个包的工程哲学.md) |
| 04 | Agent 内容引擎：整个系统的灵魂 | [05-Agent内容引擎-整个系统的灵魂.md](./05-Agent内容引擎-整个系统的灵魂.md) |

## 第二章：Agent 核心引擎

| 篇 | 标题 | 文件 |
|----|------|------|
| 05 | Agent Loop：两个循环驱动整个大脑 | [06-Agent-Loop-两个循环驱动整个大脑.md](./06-Agent-Loop-两个循环驱动整个大脑.md) |
| 06 | 当对话长到 LLM 装不下：三层上下文防线 | [07-当对话长到LLM装不下-三层上下文防线.md](./07-当对话长到LLM装不下-三层上下文防线.md) |
| 07 | 一套接口接三家 API：Provider 适配层设计 | [08-一套接口接三家API-Provider适配层设计.md](./08-一套接口接三家API-Provider适配层设计.md) |
| 08 | 不修改核心代码，只插 Hook：Agent 生命周期扩展 | [09-不修改核心代码只插Hook-Agent生命周期扩展.md](./09-不修改核心代码只插Hook-Agent生命周期扩展.md) |

## 第三章：Agent 的能力系统

| 篇 | 标题 | 文件 |
|----|------|------|
| 09 | MCP：给 Agent 装上手脚 | [10-MCP-给Agent装上手脚.md](./10-MCP-给Agent装上手脚.md) |
| 10 | Skill：MCP 给你手脚，Skill 教你套路 | [11-Skill-MCP给你手脚Skill教你套路.md](./11-Skill-MCP给你手脚Skill教你套路.md) |
| 11 | 工具的注册、调度与 MCP 集成 | [12-工具的注册调度与MCP集成.md](./12-工具的注册调度与MCP集成.md) |
| 12 | `/stop` 要立刻生效：三层命令路由 | [13-stop要立刻生效-三层命令路由.md](./13-stop要立刻生效-三层命令路由.md) |
| 13 | Agent 的文件读写，远不止 `fs.readFile` 那么简单 | [14-Agent的文件读写-远不止fsReadFile那么简单.md](./14-Agent的文件读写-远不止fsReadFile那么简单.md) |

## 第四章：消息、存储与渲染

| 篇 | 标题 | 文件 |
|----|------|------|
| 14 | 消息的三张面孔：磁盘、网络、屏幕 | [15-消息的三张面孔.md](./15-消息的三张面孔.md) |
| 15 | 为什么不用 SQLite？——JSONL 持久化的反直觉选择 | [16-为什么不用SQLite-JSONL持久化的反直觉选择.md](./16-为什么不用SQLite-JSONL持久化的反直觉选择.md) |
| 16 | 三个 buffer，一个 requestAnimationFrame | [17-三个buffer一个requestAnimationFrame.md](./17-三个buffer一个requestAnimationFrame.md) |
| 17 | 双重人格的存储层：JSONL 文件 × MySQL 缓存 | [18-双重人格的存储层-JSONL文件-MySQL缓存.md](./18-双重人格的存储层-JSONL文件-MySQL缓存.md) |

## 第五章：传输层与多端同步

| 篇 | 标题 | 文件 |
|----|------|------|
| 18 | 二层抽象一个总线的"三段式"传输层 | [19-二层抽象一个总线的三段式传输层.md](./19-二层抽象一个总线的三段式传输层.md) |
| 19 | Gateway 会话同步：一块数据，三地一致 | [20-Gateway会话同步-一块数据三地一致.md](./20-Gateway会话同步-一块数据三地一致.md) |

## 第六章：Agent 进阶

| 篇 | 标题 | 文件 |
|----|------|------|
| 20 | 让 AI 画架构图：Prompt 工程的一线实践 | [21-让AI画架构图-Prompt工程的一线实践.md](./21-让AI画架构图-Prompt工程的一线实践.md) |
| 21 | 一只猫不够用？批量派小猫干活：Sub-Agent 系统 | [22-一只猫不够用-批量派小猫干活-SubAgent系统.md](./22-一只猫不够用-批量派小猫干活-SubAgent系统.md) |
| 22 | Agent 翻车了怎么办？三层重试与优雅降级 | [23-Agent翻车了怎么办-三层重试与优雅降级.md](./23-Agent翻车了怎么办-三层重试与优雅降级.md) |
| 23 | LLM 看到的"世界"是怎么拼出来的？ContextBuilder 五层流水线 | [24-LLM看到的世界是怎么拼出来的-ContextBuilder五层流水线.md](./24-LLM看到的世界是怎么拼出来的-ContextBuilder五层流水线.md) |
| 24 | 猫睡着了也在学习：Dream 后台记忆 + 对话压缩 + 自动调度 | [25-猫睡着了也在学习-Dream后台记忆-对话压缩-自动调度.md](./25-猫睡着了也在学习-Dream后台记忆-对话压缩-自动调度.md) |

## 第七章：Agent 的内部治理

| 篇 | 标题 | 文件 |
|----|------|------|
| 25 | Token 精确计数与上下文治理：js-tiktoken 的四步自愈算法 | [26-Token精确计数与上下文治理-js-tiktoken四步自愈.md](./26-Token精确计数与上下文治理-js-tiktoken四步自愈.md) |
| 26 | 模型预设系统与 Provider 故障转移链 | [27-模型预设系统与Provider故障转移链.md](./27-模型预设系统与Provider故障转移链.md) |
| 27 | Agent 的自我认知：my 工具、运行时自省与会话取消 | [28-Agent的自我认知-my工具运行时自省与会话取消.md](./28-Agent的自我认知-my工具运行时自省与会话取消.md) |

---

**总计：27 篇，覆盖 为什么是 CatBuddy → Agent 核心引擎 → 能力系统 → 消息/存储/渲染 → 传输层 → Agent 进阶 → Agent 内部治理 七大模块。**

> 注：`00-WRITING-GUIDE.md` 为专栏写作规范，`01-我们和catbuddy的故事.md` 为预留的前言/序章。
