# 09｜为什么不用 SQLite？——JSONL 持久化的反直觉选择

> 这是 CatBuddy 技术专栏的第 9 篇。上篇讲了消息的三层类型体系——同一条消息，在磁盘、网络、屏幕上三张不同的脸。这篇深入磁盘层：Agent 的每一次对话到底怎么存的？为什么选 JSONL 这种"简陋"的格式而不是 SQLite？

---

"你们为什么不用 SQLite？"

这是 CatBuddy 架构文档里被问得最多的问题。几乎每个后端背景的人看到 JSONL 的第一反应都是：你认真的？

确实，用 JSONL（一行一个 JSON 对象的纯文本文件）来存聊天记录，听起来像是一种过早放弃数据库的选择。SQLite 有 ACID 事务、有 B-tree 索引、有 WAL 模式、有 SQL 查询——随便拿出一条特性都能吊打 JSONL。

但 CatBuddy 桌面端就是选了 JSONL。而且跑了一年多，没出过数据一致性问题。

这篇文章聊聊这个反直觉的选择——不是因为 JSONL 比 SQLite 更好，而是因为**对于桌面端单用户 Agent 聊天的场景，SQLite 提供的 80% 的能力根本用不上，而它引入的复杂度一个不少**。

---

## 9.1 先看看 JSONL 在 CatBuddy 里长什么样

CatBuddy 的每个会话是一个独立的 `.jsonl` 文件：

```
~/.catbuddy/workspace/sessions/
├── desktop_main.jsonl          ← "desktop:main" 这个会话
├── desktop_1730456789_abc.jsonl
└── ...
```

打开 `desktop_main.jsonl`：

```jsonl
{"key":"desktop:main","title":"","preview":"你好，请帮我...","created_at":"2026-01-15T08:30:00.000Z","updated_at":"2026-01-15T09:45:00.000Z","last_consolidated":0,"metadata":{}}
{"id":1,"sessionKey":"desktop:main","role":"user","content":"请帮我写一个排序函数","timestamp":"2026-01-15T08:30:00.000Z"}
{"id":2,"sessionKey":"desktop:main","role":"assistant","content":"好的，这是快速排序……","toolCalls":[{"id":"call_1","name":"write_file","arguments":{"path":"sort.js"}}],"timestamp":"2026-01-15T08:30:05.000Z","tokenUsage":{"inputTokens":500,"outputTokens":300},"latencyMs":4200}
{"id":3,"sessionKey":"desktop:main","role":"tool","content":"File written.","toolCallId":"call_1","name":"write_file","timestamp":"2026-01-15T08:30:05.000Z"}
{"id":4,"sessionKey":"desktop:main","role":"assistant","content":"文件已写入 sort.js","timestamp":"2026-01-15T08:30:06.000Z","latencyMs":1200}
```

两个关键设计：

**第 1 行是元数据**——会话标题、预览、创建时间。获取会话列表时，不需要解析整个文件，只读第一行就够了。

**第 2 行起是消息**——每条一行，`sessionKey` 冗余存储。即使你把单个 JSONL 文件拷贝走，每行消息都自带完整的"我属于哪个会话"。

---

## 9.2 Agent 聊天场景的访问模式

选存储方案，第一步不是比技术优劣，而是分析**这个场景到底怎么读写数据**。Agent 聊天的访问模式非常简单：

| 操作 | 频率 | 数据量 |
|------|------|--------|
| 追加新消息（SAVE 阶段） | 每个 turn 一次 | 1-10 条/次 |
| 读取当前会话历史（BUILD 阶段） | 每个 turn 一次 | 最近 120 条 |
| 列出所有会话 | 切换会话时 | 只看元数据（第一行） |
| 随机访问某条消息 | 极少 | 几乎没有 |

看到了吗？**没有复杂查询、没有多表 JOIN、没有条件过滤、没有多写者并发**。SQLite 擅长的 90% 的场景在这里根本不会发生。

那 JSONL 最被人诟病的"随机访问慢"呢？不好意思，聊天记录的访问模式是严格的**顺序读写**——读历史是从头到尾，写新消息是追加到末尾。JSONL 的 `split('\n')` + `push` + `join('\n')` 完美匹配。

---

## 9.3 写入的原子性：rename 就够了

JSONL 最大的争议是"并发写入不安全"。但 CatBuddy 的写入场景是**单写者**——同一时刻只有一个 Agent Loop 在写一个会话。没有"两个用户同时发消息"的问题。

CatBuddy 的写入策略很简单：

```typescript
// 不是 append，而是完整重写 + 原子 rename
const tmp = filePath + '.tmp'
fs.writeFileSync(tmp, lines.join('\n') + '\n')
fs.renameSync(tmp, filePath)
```

POSIX `rename(2)` 是原子操作。观察者要么看到旧文件，要么看到新文件——不会看到半写状态。这本质上和 SQLite 的 rollback journal 达到了一样的效果，但不需要 WAL 文件、不需要 checkpoint、不需要 `PRAGMA journal_mode`。

当然，代价是每次写入都要完整重写整个文件。对于 2000 条消息的会话，这是约 200KB 的序列化。在本地磁盘上，这个操作大约 2-5ms——用户完全无感。

---

## 9.4 会话列表：只读第一行就够

获取会话列表可能是 JSONL 方案里最巧妙的部分。

SQLite 方案：`SELECT key, title, preview, updated_at FROM sessions ORDER BY updated_at DESC` ——一行 SQL。

JSONL 方案：遍历 `sessions/` 目录，每个文件只读第一行，解析元数据，排序。

```typescript
const files = fs.readdirSync(sessionsDir).filter(f => f.endsWith('.jsonl'))
const list = files.map(file => {
  const firstLine = fs.readFileSync(path.join(sessionsDir, file), 'utf-8').split('\n')[0]
  return JSON.parse(firstLine)  // 只解析元数据
}).sort((a, b) => b.updated_at > a.updated_at ? 1 : -1)
```

500 个会话的目录扫描+第一行读取，约 30-50ms。SQLite 同样的查询可能 5ms。差别是有的，但用户切换会话列表时多等 25ms，和引入 SQLite 原生模块编译的复杂度相比——这不叫 trade-off，这叫"别为了省 25ms 搞出一个编译 CI 噩梦"。

---

## 9.5 懒创建：不写空文件

CatBuddy 有一个你可能没注意到的小设计：当你点"新建会话"按钮，CatBuddy **不会立刻创建 JSONL 文件**。

`getOrCreate()` 只往内存 `Map` 里放一个 `SessionInfo` 对象，磁盘上一个字节都不写。直到你发了第一条消息，`addMessage()` 才第一次落盘。

为什么？Web UI 上，"新建会话"是一个非常频繁的操作——用户可能点 10 次才真正说一句话。如果每次都创建空文件，`sessions/` 目录会堆满"幽灵会话"。等你的会话列表里有 200 个空文件的时候，扫描速度就不止 30ms 了。

这个设计在 SQLite 里也能做（延迟 INSERT），但在 JSONL 面前，你不需要考虑"这条 INSERT 要不要开事务"——内存里存着就完了，要什么事务。

---

## 9.6 消息上限：FIFO 裁剪

聊天记录最怕无限增长。CatBuddy 设了个硬上限——每个会话最多 2000 条消息。

```typescript
if (messages.length > 2000) {
  messages.splice(0, messages.length - 2000)  // 丢弃最旧的消息
}
```

这个裁剪发生在每次 `addMessage()` 时，在内存数组上操作，然后完整重写。2000 条消息大约 200KB，是 JSONL 能高效处理的甜蜜区间。

但光裁剪还不够——会话关闭几天后，超过 2000 条的消息被丢弃了，但 Agent 再打开这个会话时怎么"回忆"之前讨论过什么？这就需要压缩系统了。

---

## 9.7 压缩：不是删，是摘要

AutoCompact 是 CatBuddy 的后台进程——当会话超过一定时间没活动，它会：

1. 读取会话的完整历史
2. 调用 LLM 生成摘要："这个会话讨论了 React 组件拆分方案，最终决定用 Compound Pattern，拆成 5 个子组件"
3. 把摘要存入 `metadata._last_summary`
4. 下次打开会话时，摘要注入系统提示——Agent "记得"你们聊过什么，虽然原始消息已经被裁剪了

这也是 JSONL 的另一个优势：元数据存在文件第一行，压缩系统可以直接读写同一个字段，不需要 ALTER TABLE 加列。

---

## 9.8 那 SQLite 真的没用过吗？

用过。

CatBuddy 最早确实用的 SQLite。`sessions.db` 里一张表，标准的 `SELECT / INSERT / UPDATE`。

但三个问题逼着我们换了：

1. **原生模块编译**：`better-sqlite3` 需要 C++ 编译。Electron 的 native addon 编译在 Windows、macOS、Linux 三个平台各有一套坑。CatBuddy 的目标之一是"本地优先、零配置启动"——用户下载后双击就能用。每次升级 Node.js 或 Electron 版本，native addon 重新编译就是一次 CI 事故。

2. **调试麻烦**：会话出了 bug，用户报告"我刚才的对话丢了"。SQLite 时代，你得让用户把 `sessions.db` 发过来，然后你用 `sqlite3` CLI 打开。JSONL 时代，用户可以直接截图发给你——"你帮我看看这几行对不对"。

3. **Gateway 已经有 MySQL 了**：桌面端用 JSONL 存，Web 端通过 Gateway 访问的是 MySQL。两个存储各司其职，不需要统一——桌面端是单用户本地文件，Web 端是多用户服务端数据库。场景不同，存储选型不同，天经地义。

迁移时，旧的 `sessions.db` 重命名为 `sessions.db.bak` 留在原地。用户不会丢数据。

---

## 如果重来一次

JSONL 的最大遗憾是**写入策略**——每次 `addMessage()` 都完整重写整个文件。对于 2000 条消息的会话，这意味着每轮对话都要序列化 200KB。虽然 2-5ms 不算慢，但累积起来也有开销。

更好的方案可能是"混合模式"：
- 前 100 条消息用 JSONL append（O(1) 追加）
- 100 条后转为定期重写（牺牲少量写入性能换文件整洁）
- 2000 条上限 + 压缩机制不变

但我们没这么做。原因很简单：当前方案跑了 300+ 个用户，没出过问题。优化一个没出过问题的地方，叫"炫技"。

---

> **这篇讲了什么？**
>
> 1. CatBuddy 桌面端选择 JSONL 而不是 SQLite，不是"没能力用数据库"，而是评估了访问模式后做的取舍——聊天记录是 append-only + 顺序读取 + 单写者，JSONL 完美匹配，SQLite 提供的能力大部分用不上。
> 2. 写入走原子 rename 保证安全性，懒创建避免空文件泛滥，2000 条硬上限 + AutoCompact 摘要压缩保证文件不会无限增长。
> 3. 桌面端 JSONL 和 Gateway 端 MySQL 各司其职——本地单用户用纯文本，远程多用户用关系数据库。不同场景不同选型，不需要强行统一。

> 下一篇聊聊流式渲染——LLM 一个字一个字往外吐的时候，前端怎么把它拼成流畅的消息气泡？不是简单的"收到一个字就加一个字"，背后有一个 StreamBuffer 状态机。
