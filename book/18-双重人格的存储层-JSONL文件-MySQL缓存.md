# 17｜双重人格的存储层：JSONL 文件 × MySQL 缓存

> 这是 CatBuddy 技术专栏的第 17 篇。上篇讲了流式渲染——三个 buffer 加一个 requestAnimationFrame 怎么让 AI 打字像真的在打字。这篇回到数据本身——CatBuddy 的"数据库"到底是什么？桌面端用 JSONL，Gateway 端用 MySQL，两个存储系统怎么协同？"文件即数据库"的哲学到底是什么意思？

> **核心问题**：桌面端用 JSONL 存聊天记录，Gateway 端用 MySQL 做缓存。两个存储系统如何协同？"文件即数据库"的哲学到底是什么？

---

## 20.1 CatBuddy 其实有两个"数据库"

如果你翻遍 CatBuddy 的代码仓库找 `CREATE DATABASE`，你会失望——桌面端一个都没有。真正的数据存在两个地方：

```
┌─────────────────────────────────┐     ┌──────────────────────────────┐
│  Desktop（Electron）             │     │  Gateway（Node.js 服务端）     │
│                                 │     │                              │
│  ~/.catbuddy/workspace/         │     │  MySQL 8.x                   │
│  ├── sessions/                  │     │  ├── gateway_users            │
│  │   ├── desktop_main.jsonl     │◄───►│  ├── gateway_sessions         │
│  │   └── desktop_abc123.jsonl   │ 同步 │  └── gateway_session_messages │
│  ├── config/                    │     │                              │
│  ├── memory/                    │     │  mysql2 + 连接池              │
│  └── skills/                    │     │  connectionLimit: 10          │
│                                 │     │                              │
│  引擎：fs.writeFileSync +        │     │  引擎：事务 + ON DUPLICATE    │
│        fs.renameSync（原子）    │     │        KEY UPDATE             │
└─────────────────────────────────┘     └──────────────────────────────┘
```

**Desktop 端是 JSONL 文件**——每个会话一个 `.jsonl` 文件，纯文本，不需要数据库引擎。

**Gateway 端是 MySQL**——三张表，标准的 RDBMS，承担跨端缓存和会话同步的角色。

这两个存储系统**共享同一套数据类型**（`SessionInfo`、`MessageRecord`），但实现方式截然相反。理解它们的设计，就是理解 CatBuddy 的"文件即数据库"哲学。

---

## 20.2 JSONL 侧：六条铁律撑起一个存储系统

Desktop 端的 `SessionManager`（311 行）是整个桌面端唯一的持久化入口。它的实现没有一行 SQL，也不引入任何第三方数据库库。但它做到了一个本地存储系统需要的所有事。

### 铁律一：原子 rename，不依赖文件锁

```typescript:292:310:apps/desktop/src/main/session/session-manager.ts
  private _save(info: SessionInfo, messages: MessageRecord[]) {
    const fp = this._filePath(info.key)
    const meta = {
      key: info.key, title: info.title, preview: info.preview,
      created_at: info.createdAt, updated_at: info.updatedAt,
      last_consolidated: info.lastConsolidated, metadata: info.metadata,
    }
    const lines = [JSON.stringify(meta), ...messages.map((m) => JSON.stringify(m))]
    const tmp = fp + '.tmp'
    // 原子写入：先写临时文件再 rename
    fs.writeFileSync(tmp, lines.join('\n') + '\n', 'utf-8')
    fs.renameSync(tmp, fp)
  }
```

POSIX 标准保证 `rename(2)` 是原子操作——同一时刻，任何读取者要么看到完整旧文件，要么看到完整新文件，绝不可能看到写了一半的文件。这本质上等价于 SQLite 的 rollback journal，但不需要 WAL 文件、不需要 `PRAGMA journal_mode`、不需要 checkpoint。

### 铁律二：第一行是索引，后面是数据

```jsonl
{"key":"desktop:main","title":"前端重构讨论","preview":"我觉得应该...","created_at":"...","updated_at":"...","last_consolidated":0,"metadata":{}}
{"id":1,"sessionKey":"desktop:main","role":"user","content":"我觉得应该用 Compound Pattern","timestamp":"..."}
{"id":2,"sessionKey":"desktop:main","role":"assistant","content":"同意，但需要注意...","timestamp":"..."}
```

获取会话列表时，**只读第一行**就够了——不需要解析整个文件的几千条消息：

```typescript:196:218:apps/desktop/src/main/session/session-manager.ts
  list(): SessionInfo[] {
    const byKey = new Map<string, SessionInfo>()
    const files = fs.readdirSync(this._dir).filter((f) => f.endsWith('.jsonl'))
    for (const f of files) {
      const fp = path.join(this._dir, f)
      try {
        const lines = fs.readFileSync(fp, 'utf-8').split('\n').filter(Boolean)
        if (lines.length <= 1) continue    // 空会话跳过
        const info = this._parseInfoLine(lines[0])  // 只解析第一行
        if (info) byKey.set(info.key, info)
      } catch {
        // 损坏文件跳过，不阻塞整个列表
      }
    }
    // 包含内存中新建但尚未落盘的会话
    for (const info of this._cache.values()) {
      if (!byKey.has(info.key)) byKey.set(info.key, info)
    }
    return [...byKey.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  }
```

注意一个细节：`list()` 会合并 `_cache` 中的内存会话。这是配合"懒创建"策略——新建但还没发消息的会话只有内存中存在，磁盘上没有文件。

### 铁律三：懒创建——不写空文件

```typescript:23:32:apps/desktop/src/main/session/session-manager.ts
  getOrCreate(key: string): SessionInfo {
    if (this._cache.has(key)) return this._cache.get(key)!
    const existing = this.get(key)
    if (existing) return existing
    // 仅占内存，首条 addMessage 时才落盘，避免 Web 频繁「新建」产生空 JSONL
    const info = this._createEmptyInfo(key)
    this._cache.set(key, info)
    return info
  }
```

用户点"新建会话"→一个 `SessionInfo` 进内存 `Map` → 磁盘零写入。发第一条消息 → `_initSession` 创建数据 → `_save` 落盘。这种策略避免了 `sessions/` 目录被空会话文件淹没。

### 铁律四：FIFO 裁剪——2000 条上限

```typescript:92:95:apps/desktop/src/main/session/session-manager.ts
    // 上限裁剪
    if (messages.length > MAX_MESSAGES) {
      messages.splice(0, messages.length - MAX_MESSAGES)
    }
```

2000 条消息约 200KB——是 JSONL 完整重写能高效处理的甜蜜区间。配合 AutoCompact 压缩系统（后台 LLM 生成摘要存入 `metadata._last_summary`），裁剪不会丢失"记忆"。

### 铁律五：文件名沙盒——Session Key 到文件名的安全映射

```typescript:229:235:apps/desktop/src/main/session/session-manager.ts
  private _safeKey(key: string): string {
    return key.replace(/[<>:"/\\|?*]/g, '_').slice(0, 200)
  }

  private _filePath(key: string): string {
    return path.join(this._dir, `${this._safeKey(key)}.jsonl`)
  }
```

Session Key（如 `desktop:main`）包含冒号，这在 Windows 文件名中非法。`_safeKey` 把所有危险字符替换为下划线，同时截断到 200 字符防止路径过长。

### 铁律六：损坏容错

```typescript:60:67:apps/desktop/src/main/session/session-manager.ts
    try {
      const { info } = this._load(fp)
      return info
    } catch {
      return null   // 损坏文件静默跳过，不影响其他会话
    }
```

JSONL 文件可能因磁盘满、进程崩溃等原因损坏。`try/catch` 保证一个损坏的会话文件不会拖垮整个会话列表。

---

## 20.3 MySQL 侧：三张表，一个缓存

Gateway 的 MySQL 承担的是**跨端缓存**的角色——Desktop 把自己本地的 JSONL 数据同步到 MySQL，Web 端从 MySQL 读取展示。它不做"主存储"，它是 JSONL 的云端副本。

### 表结构：和 JSONL 第一行一一对应

```typescript:2:33:gateway/packages/gateway/src/session/database/schema.ts
export const GATEWAY_SCHEMA_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS gateway_users (
    email VARCHAR(255) NOT NULL PRIMARY KEY,
    password_hash VARCHAR(255) NOT NULL,
    created_at DATETIME(3) NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS gateway_sessions (
    session_key VARCHAR(512) NOT NULL PRIMARY KEY,
    title VARCHAR(512) NOT NULL DEFAULT '',
    preview TEXT NOT NULL,
    created_at DATETIME(3) NOT NULL,
    updated_at DATETIME(3) NOT NULL,
    last_consolidated BIGINT NOT NULL DEFAULT 0,
    metadata JSON NOT NULL,
    INDEX idx_gateway_sessions_updated (updated_at DESC)
  )`,
  `CREATE TABLE IF NOT EXISTS gateway_session_messages (
    session_key VARCHAR(512) NOT NULL,
    message_id BIGINT NOT NULL,
    role ENUM('user', 'assistant', 'tool', 'system') NOT NULL,
    content MEDIUMTEXT NOT NULL,
    tool_calls JSON NULL,
    tool_call_id VARCHAR(64) NULL,
    name VARCHAR(128) NULL,
    media JSON NULL,
    ts DATETIME(3) NOT NULL,
    PRIMARY KEY (session_key, message_id),
    CONSTRAINT fk_gateway_messages_session
      FOREIGN KEY (session_key) REFERENCES gateway_sessions (session_key)
      ON DELETE CASCADE
  )`,
] as const
```

三张表的职责非常清晰：

| 表 | JSONL 对应 | 职责 |
|----|-----------|------|
| `gateway_users` | 无 | 用户认证（email + password_hash） |
| `gateway_sessions` | JSONL 第一行 | 会话元数据（key, title, preview, metadata） |
| `gateway_session_messages` | JSONL 第2+行 | 消息记录（id, role, content, tool_calls） |

注意设计上的对齐：
- `gateway_sessions.session_key` 和 `gateway_session_messages.session_key` 直接对应 JSONL 中的 `key` 和 `sessionKey`
- `metadata JSON` 列和 JSONL 第一行的 `metadata` 字段是同一个结构
- `role` 用了 MySQL 的 `ENUM` 类型做约束，比 JSONL 的纯字符串多了一层数据库级别的校验
- `FOREIGN KEY ... ON DELETE CASCADE` 保证删会话时消息自动连带删除

### upsert 模式：ON DUPLICATE KEY UPDATE

Gateway 接收 Desktop 推送的会话元数据时，不知道这条记录是新增还是更新。`MysqlSessionStore` 用了 MySQL 的 `ON DUPLICATE KEY UPDATE` 语法——一条 SQL 覆盖插入和更新：

```typescript:388:409:gateway/packages/gateway/src/session/storage/mysql/mysql-session-store.ts
  private async writeSession(conn: PoolConnection, info: SessionInfo): Promise<void> {
    await conn.execute(
      `INSERT INTO gateway_sessions
         (session_key, title, preview, created_at, updated_at, last_consolidated, metadata)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         title = VALUES(title),
         preview = VALUES(preview),
         updated_at = VALUES(updated_at),
         last_consolidated = VALUES(last_consolidated),
         metadata = VALUES(metadata)`,
      [...]
    )
  }
```

值得注意的是 `created_at` 不在 UPDATE 子句中——首次创建的时间戳不可覆盖。这是"缓存"身份的体现：你不能改变记录"首次出现"的时间。

### 事务保证：addMessage 的 8 步操作

`MysqlSessionStore.addMessage()` 是 Gateway 最复杂的写操作——它在一个事务中完成了 8 步：

```typescript:96:143:gateway/packages/gateway/src/session/storage/mysql/mysql-session-store.ts
  async addMessage(sessionKey, msg) {
    const conn = await this.db.getPool().getConnection()
    try {
      await conn.beginTransaction()
      const { info, messages } = await this.loadOrInit(conn, sessionKey)  // 1. 加载或初始化
      // 2. 计算 nextId
      // 3. 构造 MessageRecord
      messages.push(record)
      if (messages.length > MAX_MESSAGES) {
        // 4. DELETE 所有旧消息
        // 5. 重新 INSERT 裁剪后的消息
      } else {
        // 6. INSERT 单条新消息
      }
      info.updatedAt = now
      info.preview = this.extractPreview(messages)
      await this.writeSession(conn, info)  // 7. upsert 元数据
      await conn.commit()                   // 8. 提交
      this.cache.set(sessionKey, info)
    } catch (err) {
      await conn.rollback()
      throw err
    } finally {
      conn.release()
    }
  }
```

每步都可能失败（网络断开、磁盘满、唯一键冲突），但事务保证了**要么全部成功，要么全部回滚**。这在 JSONL 端是通过原子 rename 实现的，在 MySQL 端是通过 `BEGIN/COMMIT/ROLLBACK` 实现——不同的机制，相同的保证。

---

## 20.4 两个存储的"镜像设计"

把 `SessionManager`（JSONL）和 `MysqlSessionStore`（MySQL）并排看，它们的 API 惊人地一致：

| 方法 | JSONL (SessionManager) | MySQL (MysqlSessionStore) |
|------|----------------------|--------------------------|
| `getOrCreate` | 查内存缓存 → 查文件 → 内存创建 | 查内存缓存 → `SELECT` → `INSERT` |
| `get` | `_load(fp)` 读文件第一行 | `SELECT ... LIMIT 1` |
| `addMessage` | `_load` → `push` → 裁剪 → `_save` (原子rename) | BEGIN TX → loadOrInit → INSERT → upsert → COMMIT |
| `list` | `readdirSync` + 每文件读第一行 | `SELECT ... ORDER BY updated_at DESC` |
| `delete` | `unlinkSync(fp)` | `DELETE FROM` (CASCADE) |
| `importWebui*` | 时间戳比较 → 完整重写 | 时间戳比较 → DELETE ALL + 批量 INSERT |

这是刻意设计的结果。两个存储共享同一套 TypeScript 类型——`SessionInfo`、`MessageRecord`、`SessionDetail`——来自 `@catbuddy/shared`。上层代码（Channel、AgentLoop）不关心数据存在 JSONL 文件还是 MySQL 表中。**类型即接口，存储是实现细节。**

### 关键差异：并发模型

但它们的实现逻辑有本质不同，根源在于**并发模型**：

| | JSONL | MySQL |
|----|-------|-------|
| 写者数量 | 单写者（一个 AgentLoop） | 多写者（Desktop 同步 + Web 用户消息） |
| 锁策略 | 不需要锁（单写者） | `PoolConnection` + 事务隔离 |
| 写入策略 | 完整重写 + 原子 rename | `INSERT` 追加 + 定期整理 |
| 缓存策略 | `Map<key, SessionInfo>` | `Map<key, SessionInfo>` |

两者都用了内存 `Map` 做一级缓存，但缓存的生命周期不同：JSONL 的缓存是进程级（Electron 常驻），MySQL 的缓存也是进程级但可能因为多实例而失效（Gateway 可能跑多个副本）。

---

## 20.5 Gateway 的"缓存"身份

Gateway 的 MySQL 有两个身份在博弈：

**身份一：缓存。** Desktop 是本地的"真理源"（source of truth），MySQL 里的数据是 Desktop 推送过来的副本。如果 MySQL 挂了，Desktop 的 JSONL 数据毫发无损。

**身份二：Web 端的存储。** Web 端没有本地磁盘，它的所有数据都来自 Gateway。对 Web 用户来说，MySQL 就是他们的"主存储"——Gateway HTTP 接口把消息写入 MySQL，`sync_push` 把 MySQL 的数据推回 Desktop。

这两个身份在 `MysqlSessionStore.importWebuiPayload` 和 `SessionManager.importWebuiThread` 之间形成一个闭环：

```
Web用户发消息 → Gateway HTTP → MysqlSessionStore.addMessage (MySQL写入)
                                    ↓
Gateway → Desktop (inbound_message) → AgentLoop 处理
                                    ↓
Desktop → Gateway (publishSessionsSync) → MysqlSessionStore.mergeSessionRow
                                    ↓                          ↓
                          JSONL 原子rename           MySQL ON DUPLICATE KEY UPDATE
```

**两边都写了，谁是"真理源"？** 答案在时间戳。`importWebuiThread` 里有一行关键代码：

```typescript:181:185:apps/desktop/src/main/session/session-manager.ts
    const incomingAt =
      typeof payload.savedAt === 'string' ? payload.savedAt : ''
    if (local && localUpdated && incomingAt && incomingAt <= localUpdated) {
      return  // 本地数据更新，忽略旧数据
    }
```

同样，`MysqlSessionStore.mergeSessionRow` 里也有：

```typescript:209:210:gateway/packages/gateway/src/session/storage/mysql/mysql-session-store.ts
    if (row.updatedAt > local.updatedAt || metadataChanged) {
      local.title = row.title ?? local.title
```

**Last-Write-Wins**——谁的时间戳更新，谁就是真理。没有分布式共识算法，没有 CRDT。对于一个单用户聊天应用来说，LWW 足够了。

---

## 20.6 "文件即数据库"的哲学

回到那个被问了无数次的问题：**为什么不用 SQLite？**

第 9 章已经详细回答过——访问模式是 append-only + 顺序读取 + 单写者，SQLite 提供的 90% 能力用不上。但这里想补充一个更深层的原因：

**JSONL 的可观测性。**

当用户报告"我昨天的对话丢了"时：
- SQLite 时代：你得让用户找到 `sessions.db` 发过来 → 你用 `sqlite3` CLI 打开 → `SELECT * FROM messages WHERE ...` → 排查
- JSONL 时代：用户可以直接打开 `desktop_main.jsonl`，截图发给你。你一眼就能看到第 47 行的 `toolCallId` 是不是 null。

纯文本文件可以被任何工具打开——`cat`、`grep`、`jq`、记事本、VS Code。你的备份脚本不需要知道 `sqlite3 .backup`，直接 `cp *.jsonl ~/backup/` 就行。你的 CI 不需要安装 `libsqlite3-dev`。

**这不是"放弃数据库"，这是"选择正确的数据库"。** CatBuddy 选择的数据库叫"文件系统"——POSIX 的 `open/write/rename/close` 就是它的查询语言，JSON 是它的行格式，换行符是它的分隔符。它没有 ACID 承诺，但原子 rename 提供了等价的保证。它没有 B-tree 索引，但 `split('\n')[0]` 提供了等价的元数据访问。

而 Gateway 选择 MySQL，是因为它面临的约束完全不同——多写者并发、Web 用户随机查询、需要 JOIN 多表。不同场景，不同选型。

---

## 20.7 总结

> **这篇讲了什么？**
>
> 1. CatBuddy 有两个"数据库"：Desktop 端的 **JSONL 文件**和 Gateway 端的 **MySQL**。Desktop 端的 311 行 `SessionManager` 用六条铁律撑起了一个完整的本地存储系统——原子 rename、第一行索引、懒创建、FIFO 裁剪、文件名沙盒、损坏容错。
>
> 2. Gateway 的 MySQL 由三张表组成——`gateway_users`（认证）、`gateway_sessions`（会话元数据）、`gateway_session_messages`（消息记录）。`ON DUPLICATE KEY UPDATE` 实现了 upsert 语义，事务保证了多步写入的一致性。表结构和 JSONL 的第一行/消息行结构一一对应。
>
> 3. 两个存储共享同一套 TypeScript 类型（`SessionInfo`、`MessageRecord`），API 镜像设计，但实现逻辑因并发模型不同而分道扬镳——JSONL 单写者不需要锁，MySQL 用事务+连接池处理多写者。Last-Write-Wins 时间戳策略解决了"哪个存储是真理源"的问题。
>
> 4. "文件即数据库"不是反智主义——它是基于访问模式的最优选择。纯文本的 JSONL 提供了 SQLite 无法比拟的可观测性（`cat`/`grep`/`jq` 直接操作），而 POSIX 原子 rename 提供了等价于 ACID 事务的安全性。

> 下一篇聊 CatBuddy 的传输层抽象——Desktop 里用 IPC，Web 端用 WebSocket，上层代码怎么做到"不关心底层是哪种通信方式"？"二层抽象 + 一个总线"的三段式传输层架构是怎么设计的？
