# nanobot 中的记忆

nanobot 的记忆建立在一个简单的信念之上：记忆应该是有生命力的，但不应该让人感到混乱。

好的记忆不是一堆笔记，而是一种平静的注意力系统。它关注什么值得保留，放下不再需要聚焦的内容，并将已有的经验转化为平静、持久和有用的东西。

这就是 nanobot 中记忆的形态。

## 设计理念

nanobot 不将记忆视为单一的大文件。

它将记忆分成不同的层次，因为不同类型的记忆需要不同的工具：

- `session.messages` 保存活跃的短期对话。
- `memory/history.jsonl` 是压缩过的过往对话轮次的连续归档。
- `SOUL.md`、`USER.md` 和 `memory/MEMORY.md` 是持久的知识文件。
- `GitStore` 记录持久文件随时间的变化。

这样系统在当下保持轻量，但长期具备自反性。

## 流程

记忆通过两个阶段流经 nanobot。

### 阶段 1：整合器（Consolidator）

当对话增长到足以对上下文窗口构成压力时，nanobot 不会永远携带每一条历史消息。

相反，`Consolidator` 会总结对话中最旧的安全部分，并将摘要追加到 `memory/history.jsonl`。

这个文件是：

- 仅追加
- 基于游标的
- 优先为机器消费优化，其次才是人工查阅

每一行是一个 JSON 对象：

```json
{"cursor": 42, "timestamp": "2026-04-03 00:02", "content": "- 用户偏好深色模式\n- 决定使用 PostgreSQL"}
```

这不是最终的记忆，而是塑造最终记忆的原料。

### 阶段 2：Dream

`Dream` 是更慢、更深思熟虑的层。默认按 cron 计划运行，也可以手动触发。

Dream 读取：

- `memory/history.jsonl` 中的新条目
- 当前的 `SOUL.md`
- 当前的 `USER.md`
- 当前的 `memory/MEMORY.md`

然后分两个阶段工作：

1. 分析新增内容和已知内容。
2. 精准地编辑长期文件——不是重写一切，而是进行最小的诚实修改，保持记忆的连贯性。

这就是为什么 nanobot 的记忆不仅是归档性的，也是解释性的。

## 文件结构

```text
workspace/
├── SOUL.md              # bot 的长期声音和沟通风格
├── USER.md              # 关于用户的稳定知识
└── memory/
    ├── MEMORY.md        # 项目事实、决策和持久上下文
    ├── history.jsonl    # 仅追加的历史摘要
    ├── .cursor          # 整合器写入游标
    ├── .dream_cursor    # Dream 消费游标
    └── .git/            # 长期记忆文件的版本历史
```

这些文件发挥不同的作用：

- `SOUL.md` 记住 nanobot 应该如何表达。
- `USER.md` 记住用户是谁以及他们的偏好。
- `MEMORY.md` 记住工作本身持久的东西。
- `history.jsonl` 记住途中发生了什么。

## 为什么使用 `history.jsonl`

旧的 `HISTORY.md` 格式便于随性阅读，但作为操作底层的脆弱性太高。

`history.jsonl` 赋予 nanobot：

- 稳定的增量游标
- 更安全的机器解析
- 更容易的批处理
- 更清晰的迁移和压缩
- 原始历史和策划知识之间更好的边界

你仍然可以用熟悉的工具搜索：

```bash
# grep
grep -i "关键词" memory/history.jsonl

# jq
cat memory/history.jsonl | jq -r 'select(.content | test("关键词"; "i")) | .content' | tail -20

# Python
python -c "import json; [print(json.loads(l).get('content','')) for l in open('memory/history.jsonl','r',encoding='utf-8') if l.strip() and '关键词' in l.lower()][-20:]"
```

区别既是技术性的也是哲学性的：

- `history.jsonl` 为结构服务
- `SOUL.md`、`USER.md` 和 `MEMORY.md` 为意义服务

## 命令

记忆不是藏在幕后的。用户可以检查和引导它。

| 命令 | 作用 |
|---------|--------------|
| `/dream` | 立即运行 Dream |
| `/dream-log` | 显示最新的 Dream 记忆变更 |
| `/dream-log <sha>` | 显示特定 Dream 变更 |
| `/dream-restore` | 列出最近的 Dream 记忆版本 |
| `/dream-restore <sha>` | 将记忆恢复到特定变更之前的状态 |

这些命令有其存在的道理：自动记忆是强大的，但用户应始终保留检查、理解和恢复它的权利。

## 版本化记忆

Dream 更改长期记忆文件后，nanobot 可以使用 `GitStore` 记录该变更。

这赋予记忆自己的历史：

- 你可以查看变更内容
- 你可以比较版本
- 你可以恢复之前的状态

这将记忆从无声的变异转变为一个可审计的过程。

## 配置

Dream 在 `agents.defaults.dream` 下配置：

```json
{
  "agents": {
    "defaults": {
      "dream": {
        "intervalH": 2,
        "modelOverride": null,
        "maxBatchSize": 20,
        "maxIterations": 10
      }
    }
  }
}
```

| 字段 | 含义 |
|-------|---------|
| `intervalH` | Dream 运行的频率，以小时为单位 |
| `modelOverride` | 可选的 Dream 专用模型覆盖 |
| `maxBatchSize` | Dream 每次运行处理的 history 条目数 |
| `maxIterations` | Dream 在编辑阶段可用的工具调用预算 |

实际操作中：

- `modelOverride: null` 表示 Dream 使用与主 agent 相同的模型。仅在希望 Dream 使用不同模型时设置。
- `maxBatchSize` 控制 Dream 每次运行消费多少新的 `history.jsonl` 条目。更大的批次追得更快；更小的批次更轻量、更平稳。
- `maxIterations` 限制 Dream 在更新 `SOUL.md`、`USER.md` 和 `MEMORY.md` 时可执行的读取/编辑步骤数。它是一个安全预算，而非质量评分。
- `intervalH` 是配置 Dream 的标准方式。它内部以 `every` 计划运行，而非 cron 表达式。

旧版说明：

- 较旧的源码配置可能仍包含 `dream.cron`。nanobot 为了向后兼容继续支持它，但新配置应使用 `intervalH`。
- 较旧的源码配置可能仍包含 `dream.model`。nanobot 为了向后兼容继续支持它，但新配置应使用 `modelOverride`。

## 实际意义

在日常使用中的含义很简单：

- 对话可以保持快速，而无需承载无限的上下文
- 持久的事实可以随时间变得更清晰，而非更混乱
- 需要时用户可以检查和恢复记忆

记忆不应像是一堆倾倒物，而应像是连续性。

这就是这个设计试图维护的东西。
