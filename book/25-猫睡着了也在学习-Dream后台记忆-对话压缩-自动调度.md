# 24｜猫睡着了也在学习：Dream 后台记忆 + 对话压缩 + 自动调度

> 这是 CatBuddy 技术专栏的第 24 篇。上篇讲了 ContextBuilder 五层流水线——系统提示词怎么从 Handlebars 模板、引导文件、分层记忆、技能清单逐层拼装。这篇讲记忆的**写入端**：那些在系统提示词里出现的"Long-Term Memory"和"Project Memory"是怎么来的？Agent 怎么在后台默默地"记住"关于你和项目的所有事？

> **核心问题**：Dream 两阶段记忆提取怎么在后台周期性运行？Consolidator 怎么把长对话压缩成结构化事实？AutoCompact 怎么用"空闲时间 × 消息量"的优先级公式调度压缩？三层组件（Dream → Consolidator → AutoCompact）怎么协作实现"猫睡着了也在学习"？

---

第 23 篇讲了系统提示词的**读取端**——ContextBuilder 怎么把 MEMORY.md 注入 LLM 的视野。但"记忆"不是凭空出现的。这些记忆是从哪来的？谁在写？什么时候写？

答案是三个组件的协作：**Dream（记忆提取）→ Consolidator（对话压缩）→ AutoCompact（调度编排）**。它们构成了 CatBuddy 的 **"记忆处理管道"**——Agent 在后台"睡着"时默默消化对话、提取事实、更新记忆。等你下次和它对话时，它已经"记住"了更多关于你的事。

整个过程涉及 5 个文件、670 行 TypeScript。先看全景图：

```text
┌─────────────────────────────────────────────────────────┐
│  AutoCompact (调度层)                                     │
│  定期扫描会话 → 按优先级排序 → 触发压缩                    │
│  空闲越久 + 消息越多 = 越优先                              │
│  指数退避：失败 5min → 10min → 20min ...                  │
└────────────┬────────────────────────────────────────────┘
             │ 调用 compactIdleSession(key)
             ▼
┌─────────────────────────────────────────────────────────┐
│  Consolidator (压缩层)                                    │
│  读取旧消息 → 调 LLM 提取关键事实                         │
│  → appendLayeredMemory() 分开写入 Memory + MEMORY.md      │
└────────────┬────────────────────────────────────────────┘
             │ 写入历史条目
             ▼
┌─────────────────────────────────────────────────────────┐
│  Dream (记忆提取层)                                       │
│  两阶段处理：                                             │
│  Phase 1: 读 history.jsonl 新条目 → 调 LLM 提取事实       │
│  Phase 2: 格式验证 → 不合法则重试 → 写入 MEMORY.md       │
│  基于游标的增量处理，每次只处理新条目                      │
└─────────────────────────────────────────────────────────┘
```

---

## 24.1 先看底层：MemoryStore——记忆文件的纯 I/O

三层之上是一个最底层的 `MemoryStore` 类，负责四个文件的读写：

```typescript:8:31:apps/desktop/src/main/agent/memory-store.ts
export class MemoryStore {
  static readonly DEFAULT_MAX_HISTORY = 1000

  readonly workspace: string
  readonly memoryDir: string
  readonly memoryFile: string    // workspace/memory/MEMORY.md
  readonly historyFile: string   // workspace/memory/history.jsonl
  readonly soulFile: string      // workspace/SOUL.md
  readonly userFile: string      // workspace/USER.md

  private _cursor = 0

  constructor(workspace: string, maxHistoryEntries = MemoryStore.DEFAULT_MAX_HISTORY) {
    this.workspace = workspace
    const memDir = path.join(workspace, 'memory')
    fs.mkdirSync(memDir, { recursive: true })
    this.memoryDir = memDir
    this.memoryFile = path.join(memDir, 'MEMORY.md')
    this.historyFile = path.join(memDir, 'history.jsonl')
    this.soulFile = path.join(workspace, 'SOUL.md')
    this.userFile = path.join(workspace, 'USER.md')
    this._loadCursor()
  }
```

四个文件各有用途：

| 文件 | 读/写 | 用途 |
|------|-------|------|
| `MEMORY.md` | R/W | 结构化记忆（Dream 写入，ContextBuilder 读取） |
| `history.jsonl` | R/W | 对话历史条目（Dream 读取游标之后的新条目） |
| `SOUL.md` | R | Agent 性格（用户定义，只读） |
| `USER.md` | R | 用户画像（用户定义，只读） |

关键方法是 `appendHistory()` 和 `readEntriesSince()`，它们实现了一个**基于游标的增量读取**：

```typescript:53:77:apps/desktop/src/main/agent/memory-store.ts
  appendHistory(entry: string, maxChars = 64_000): number {
    const raw = entry.trimEnd()
    const content = raw.length > maxChars ? raw.slice(0, maxChars) : raw
    this._cursor += 1
    const row = { cursor: this._cursor, content, at: new Date().toISOString() }
    fs.appendFileSync(this.historyFile, `${JSON.stringify(row)}\n`, 'utf-8')
    fs.writeFileSync(path.join(this.memoryDir, '.cursor'), String(this._cursor), 'utf-8')
    return this._cursor
  }

  *readEntriesSince(cursor: number): Generator<{ cursor: number; content: string }, void> {
    if (!fs.existsSync(this.historyFile)) return
    const lines = fs.readFileSync(this.historyFile, 'utf-8').split('\n')
    for (const line of lines) {
      if (!line.trim()) continue
      try {
        const row = JSON.parse(line) as { cursor?: number; content?: string }
        if (typeof row.cursor === 'number' && row.cursor > cursor && row.content) {
          yield { cursor: row.cursor, content: row.content }
        }
      } catch {
        // skip corrupt line
      }
    }
  }
```

每写入一条历史记录，游标自增并持久化到 `.cursor` 文件。下次 Dream 运行时，`readEntriesSince(this._processedCursor)` 只返回游标之后的新条目——**不会重复处理已提取过的历史**。

---

## 24.2 Dream：两阶段记忆提取

`Dream.runOnce()` 是记忆处理管道的入口。它由 `AgentLoop.runDreamOnce()` 暴露，可以被 cron 定时触发或手动 `/dream` 命令触发。

整个流程分两个阶段：

### Phase 1：收集新条目 + 调用 LLM 提取事实

```typescript:116:146:apps/desktop/src/main/agent/dream.ts
  async runOnce(): Promise<string | null> {
    // 阶段 1：收集新条目
    const newEntries = [...this.store.project.readEntriesSince(this._processedCursor)]
    if (newEntries.length === 0) {
      return null // 无新消息，跳过
    }

    // 更新游标
    this._processedCursor = Math.max(...newEntries.map(e => e.cursor), this._processedCursor)

    // 读取现有记忆
    const existingMemory = this.store.project.readMemory() || '(none)'
    const existingUser = this.store.project.readUser() || '(none)'
    const existingSoul = this.store.project.readSoul() || '(none)'

    // 构建提示词 — 使用 dream_phase1 模板 + 格式指令
    const extractionGuidance = this.templates.renderDreamPhase1(90)
    const prompt = `${extractionGuidance}

Existing MEMORY.md:
${existingMemory.slice(0, 3000)}

Existing USER.md:
${existingUser.slice(0, 1000)}

Existing SOUL.md:
${existingSoul.slice(0, 1000)}

New conversation entries (up to 30):
${newEntries.slice(-30).map(e => `- ${e.content.slice(0, 1000)}`).join('\n')}
${FORMAT_SUFFIX}`
```

这段代码的几个关键设计：

1. **增量处理**：`readEntriesSince(this._processedCursor)` 只读游标之后的新条目。游标在 Phase 1 开头就更新——即使 LLM 调用失败，游标也前进了，不会在下次运行时重复读取同一批条目。这是一个"至少一次"的语义而不是"恰好一次"。

2. **带上下文提取**：LLM 的输入不仅包含新条目，还包含现有的 MEMORY.md、USER.md、SOUL.md（截断到合理长度）。这让 LLM 可以判断新信息是"已知事实的更新"还是"全新发现"。

3. **最多 30 条，每条截断 1000 字符**：防止一次送入太多内容导致 token 爆炸。

4. **格式指令后缀**：`FORMAT_SUFFIX` 要求 LLM 返回两个 Markdown 区块——`## User Profile` 和 `## Project Context`。

### Phase 2：格式验证 + 自动重试 + 写入记忆

```typescript:148:189:apps/desktop/src/main/agent/dream.ts
    let raw = await this._callLLM(prompt)
    let validation = validateFormat(raw)
    let retried = false

    // 重试（格式不合法时）
    if (!validation.valid) {
      process.stderr.write(`[Dream] format invalid (${validation.reason}), retrying...\n`)
      const retryPrompt = `${this.templates.renderDreamPhase2()}

Your previous output (which was rejected):
${raw.slice(0, 2000)}

Now please regenerate following the instructions above.`
      const retryRaw = await this._callLLM(retryPrompt)
      retried = true
      const retryValidation = validateFormat(retryRaw)
      if (retryValidation.valid) {
        raw = retryRaw
        validation = retryValidation
      } else {
        process.stderr.write(`[Dream] retry also invalid (${retryValidation.reason}), using raw fallback\n`)
        raw = retryRaw
      }
    }

    // 空内容防护
    if (raw.trim().length < MIN_CONTENT_LENGTH) {
      process.stderr.write(`[Dream] skipped storage: content too short\n`)
      return null
    }

    // 阶段 2：写入记忆
    try {
      this.store.appendMemorySummary(raw, 'Dream')
      process.stderr.write(`[Dream] memory updated (retried=${retried}, validated=${validation.valid})\n`)
    } catch (err) {
      process.stderr.write(`[Dream] appendMemorySummary failed: ${err}\n`)
      return null
    }
```

这里有三级防护：

**第一级：格式验证。** `validateFormat()` 检查三件事——输出非空、长度 ≥ 20 字符、包含 `## User Profile` 和 `## Project Context` 两个头部、每个区块下有实质性内容（不是 `(nothing)` 或 `n/a` 这种占位符）。

```typescript:28:55:apps/desktop/src/main/agent/dream.ts
function validateFormat(output: string): ValidationResult {
  const trimmed = output.trim()
  if (!trimmed) return { valid: false, reason: 'empty output' }
  if (trimmed.length < MIN_CONTENT_LENGTH)
    return { valid: false, reason: `too short (${trimmed.length} chars)` }

  for (const header of REQUIRED_HEADERS) {
    if (!trimmed.includes(header))
      return { valid: false, reason: `missing header: "${header}"` }
  }

  const sections = trimmed.split(/\n(?=## )/)
  for (const section of sections) {
    const lines = section.split('\n').filter(l => l.trim())
    const body = lines.slice(1)
    if (body.length === 0)
      return { valid: false, reason: `empty section: "${lines[0]?.trim() ?? 'unknown'}"` }

    const meaningful = body.filter(l => {
      const t = l.trim().replace(/^[-*]\s*/, '')
      return t && !/^(\(nothing\)|none|n\/a)$/i.test(t)
    })
    if (meaningful.length === 0)
      return { valid: false, reason: `no meaningful content in "${lines[0]?.trim()}"` }
  }

  return { valid: true }
}
```

**第二级：自动重试。** 格式不合法时不直接丢弃——调用 Phase 2 模板，把 LLM 之前的输出附在提示词里，要求它按照正确格式重新生成。只重试一次。

**第三级：优雅降级。** 重试后仍然不合法？不丢弃。用"不合法但可能有信息"的原始输出继续。同时检查内容长度，太短的就跳过。

这和前面第 22 篇讲的"永远不在用户面前崩溃"是同一个设计哲学——只不过这次应用在后台上。

---

## 24.3 LayeredMemory：记忆的分层存储

Dream 提取完事实后，调用 `LayeredMemoryStore.appendMemorySummary()` 写入 MEMORY.md。但写入不是简单追加——它有**分层路由**逻辑。

核心函数是 `splitMemorySections()` 和 `appendLayeredMemory()`：

```typescript:35:67:apps/desktop/src/main/agent/layered-memory.ts
export function splitMemorySections(raw: string): MemorySectionSplit {
  const trimSection = (s: string): string | null => {
    const t = s.trim();
    if (!t || t === "(nothing)") return null;
    return t;
  };

  const userIdx = raw.search(/##\s*User\s*Profile/i);
  const projectIdx = raw.search(/##\s*Project\s*Context/i);

  if (userIdx === -1 && projectIdx === -1) {
    return { userProfile: trimSection(raw), projectContext: null };
  }

  let userProfile: string | null = null;
  let projectContext: string | null = null;

  if (userIdx !== -1) {
    const start = raw.indexOf("\n", userIdx);
    const bodyStart = start === -1 ? userIdx : start + 1;
    const end = projectIdx !== -1 && projectIdx > userIdx ? projectIdx : raw.length;
    userProfile = trimSection(raw.slice(bodyStart, end));
  }

  if (projectIdx !== -1) {
    const start = raw.indexOf("\n", projectIdx);
    const bodyStart = start === -1 ? projectIdx : start + 1;
    projectContext = trimSection(raw.slice(bodyStart));
  }

  return { userProfile, projectContext };
}
```

`splitMemorySections` 用正则匹配 `## User Profile` 和 `## Project Context` 头部，把 LLM 输出切分成两个区块。

然后 `appendLayeredMemory` 根据是否分层来路由：

```typescript:93:126:apps/desktop/src/main/agent/layered-memory.ts
export function appendLayeredMemory(opts: {
  summary: string; projectWorkspace: string; globalWorkspace?: string; label: string;
}): void {
  const { userProfile, projectContext } = splitMemorySections(opts.summary);

  if (!layered) {
    appendToMemoryFile(globalWorkspace, opts.label, opts.summary);
    return;
  }

  if (userProfile) {
    appendToMemoryFile(globalWorkspace, opts.label, userProfile, "User Profile");
  }
  if (projectContext) {
    appendToMemoryFile(opts.projectWorkspace, opts.label, projectContext, "Project");
  }

  if (!userProfile && !projectContext) {
    const fallback = opts.summary.trim();
    if (fallback) {
      appendToMemoryFile(globalWorkspace, opts.label, fallback, "User Profile");
    }
  }
}
```

三个分支：
- **非分层模式**（简单项目）：整段记忆直接写入全局 `MEMORY.md`
- **分层模式**：User Profile 写入 `~/.catbuddy/workspace/memory/MEMORY.md`，Project Context 写入 `{project}/memory/MEMORY.md`
- **兜底**：如果 split 失败（两个区块都没匹配到），整段写入全局记忆

这样，你在不同项目里和 CatBuddy 的对话，关于"你"的事实会集中在一个地方（全局 MEMORY.md），关于"这个项目"的事实会分散在各项目的 MEMORY.md 里。下次 ContextBuilder 构建系统提示词时，两个记忆源都会被注入。

---

## 24.4 Consolidator：长对话的主动压缩

Dream 处理的是"当前对话产生的增量记忆"。但还有另一个问题：**长对话本身占用了太多上下文窗口**。

第 06 篇讲了三层上下文防线——token 预算截断、微压缩、历史截断。但那些是**被动防御**——上下文快超了才紧急处理。Consolidator 做的是**主动压缩**——在会话空闲时就提前把旧消息压缩成结构化的记忆摘要，减轻后续对话的上下文压力。

```typescript:58:126:apps/desktop/src/main/agent/memory.ts
  async compactIdleSession(sessionKey: string, keepRecent: number = 8): Promise<string | null> {
    if (this._compacting.has(sessionKey)) return null
    this._compacting.add(sessionKey)

    try {
      const allMessages = this.sessions.getAllMessages(sessionKey, { maxMessages: 9999 })
      
      if (allMessages.length <= keepRecent) {
        return null
      }

      const toArchive = allMessages.slice(0, allMessages.length - keepRecent)
      
      const userMessages = toArchive.filter(m => m.role === 'user')
      if (userMessages.length === 0) {
        return null
      }

      const conversationText = toArchive
        .map(m => `[${m.role}] ${(m.content || '').slice(0, 300)}`)
        .join('\n')

      const compactPrompt = memoryExtractionPrompt(`${this.templates.renderConsolidatorArchive()}

Conversation:
${conversationText}`)

      const response = await this.provider.chat({
        messages: [{ role: 'user', content: compactPrompt }],
        model: this.model,
        maxTokens: 1024,
        temperature: 0.3,
      })

      const summary = response.content?.trim()
      if (!summary || summary === '(nothing)') {
        return null
      }

      appendLayeredMemory({
        summary,
        projectWorkspace: this.workspace,
        globalWorkspace: this.globalWorkspace,
        label: 'Archived',
      })

      const session = this.sessions.getOrCreate(sessionKey)
      session.lastConsolidated = (session.lastConsolidated || 0) + toArchive.length
      session.metadata = { ...session.metadata, _last_summary: { text: summary, last_active: now } }

      return summary
    } catch (err: any) {
      return null
    } finally {
      this._compacting.delete(sessionKey)
    }
  }
```

`compactIdleSession` 的流程：

1. **去重锁**：`this._compacting` Set 防止同一个会话被并发压缩两次
2. **保留最近 N 条**：`keepRecent = 8`，保留最近 8 条消息不被压缩（它们是"活跃上下文"）
3. **过滤**：如果待压缩的消息里没有 user 消息（全是 assistant/tool），跳过
4. **调用 LLM 提取**：每条消息截断到 300 字符，拼成 `[role] content` 格式
5. **分层写入**：提取结果通过 `appendLayeredMemory` 写入 `MEMORY.md`，label 为 `'Archived'`
6. **更新会话元数据**：记录压缩数量和摘要文本

`_compacting` 的 `finally` 保证锁一定被释放——即使 LLM 调用失败。

---

## 24.5 AutoCompact：优先级调度 + 指数退避

Consolidator 是一个"引擎"，但它不知道什么时候该运行。AutoCompact 就是那个**调度器**。

它有两个触发时机：
- **定时触发**：通过 cron 定期调用 `checkExpired()`
- **对话触发**：在 AgentLoop 的每次 `_dispatch()` 前调用，检查有没有会话需要压缩

```typescript:97:136:apps/desktop/src/main/agent/autocompact.ts
  checkExpired(
    scheduleBackground: (task: () => Promise<void>) => void,
    activeSessionKeys: Iterable<string> = [],
  ): CompactStats {
    const active = new Set(activeSessionKeys)
    const candidates: Array<{ key: string; updatedAt: string }> = []

    for (const info of this.sessions.list()) {
      if (!info.key) continue
      if (this._archiving.has(info.key) || active.has(info.key)) continue
      if (this._isBackedOff(info.key)) continue
      if (this._isExpired(info.updatedAt)) {
        candidates.push({ key: info.key, updatedAt: info.updatedAt })
      }
    }

    // 按优先级降序排列（高价值靠前）
    candidates.sort((a, b) => {
      const pa = this._priorityWeight(a)
      const pb = this._priorityWeight(b)
      return pb - pa
    })

    // 截取本轮限额
    const toArchive = candidates.slice(0, this.maxPerCycle)

    for (const c of toArchive) {
      this._archiving.add(c.key)
      scheduleBackground(() => this._archive(c.key))
    }

    return {
      scanned: candidates.length,
      attempted: toArchive.length,
      succeeded: 0,
      failed: 0,
      skipped: candidates.length - toArchive.length,
      totalCompacted: this._totalCompacted,
    }
  }
```

这里有一个很精妙的**优先级排序**公式：

```typescript:58:63:apps/desktop/src/main/agent/autocompact.ts
  private _priorityWeight(info: { updatedAt: string; metadata?: Record<string, unknown> }): number {
    const idleMs = Date.now() - Date.parse(info.updatedAt)
    const idleMinutes = Math.max(1, idleMs / 60_000)
    const msgCount = (typeof info.metadata?.msgCount === 'number' ? info.metadata.msgCount : 50) as number
    return idleMinutes * msgCount
  }
```

**优先级 = 空闲时间（分钟）× 消息数量。** 空闲越久 + 消息越多 = 越值得压缩。这个公式很直觉：一个刚刚还在活跃的会话不需要压缩（空闲 1 分钟 × 100 条消息 = 100），但一个三天没动过的长对话值得优先处理（4320 分钟 × 200 条 = 864000）。

然后是**指数退避**：

```typescript:76:85:apps/desktop/src/main/agent/autocompact.ts
  private _recordFailure(key: string) {
    const entry = this._backoff.get(key) ?? { fails: 0, nextRetryAt: 0 }
    entry.fails++
    entry.nextRetryAt = Date.now() + AutoCompact.BACKOFF_BASE_MS * Math.pow(2, entry.fails - 1)
    this._backoff.set(key, entry)
  }

  private _recordSuccess(key: string) {
    this._backoff.delete(key)
  }
```

失败一次 → 等 5 分钟再试。失败两次 → 等 10 分钟。三次 → 20 分钟……指数增长，上限由 `fails` 的值决定。一旦成功，退避记录删除。这是一个生产级的重试策略——防止反复冲击一个"有问题"的会话浪费 LLM API 配额。

---

## 24.6 三层协作的完整流程

把三层放在一起看：

```text
AutoCompact.checkExpired()
  │
  ├─ 扫描所有会话
  ├─ 跳过：活跃会话、正在压缩的、退避中的
  ├─ 按「空闲时间 × 消息量」降序排列
  ├─ 截取本轮限额（maxPerCycle = 3）
  │
  └─ 对每个候选：scheduleBackground(() => _archive(key))
       │
       └─ _archive(key):
            │
            └─ consolidator.compactIdleSession(key, keepRecent=8)
                 │
                 ├─ 读取历史消息（保留最近 8 条）
                 ├─ 调 LLM 提取关键事实
                 ├─ appendLayeredMemory(summary, label='Archived')
                 │    ├─ splitMemorySections(summary)
                 │    ├─ User Profile → ~/.catbuddy/workspace/memory/MEMORY.md
                 │    └─ Project Context → {project}/memory/MEMORY.md
                 │
                 └─ 更新 session.metadata._last_summary

Dream.runOnce()
  │
  ├─ 读取 history.jsonl 游标之后的新条目
  ├─ 调 LLM（Phase 1 模板）提取事实
  ├─ 格式验证 → 不合法则 Phase 2 重试
  ├─ 重试仍失败 → 优雅降级，使用原始输出
  └─ appendMemorySummary(raw, 'Dream')
       └─ 同上，分层写入 MEMORY.md
```

两者的结果最终都写入同样的 MEMORY.md 文件。ContextBuilder 在下次构建系统提示词时，指纹检测到 MEMORY.md 的 mtime 变化，缓存失效，重新读取——Agent 的"记忆"就更新了。

---

## 24.7 总结

> **这篇讲了什么？**
>
> 1. **MemoryStore**：最底层的纯文件 I/O——`MEMORY.md`（结构化记忆）、`history.jsonl`（带游标的对话历史）、`SOUL.md` / `USER.md`（用户画像）。游标持久化到 `.cursor` 文件，实现增量读取。
>
> 2. **Dream 两阶段提取**：Phase 1 收集 `history.jsonl` 中游标之后的新条目（最多 30 条，每条截断 1000 字符），带现有 MEMORY.md / USER.md / SOUL.md 上下文调 LLM 提取事实。Phase 2 做格式验证（必须有 `## User Profile` 和 `## Project Context` 头部、每个区块有实质性内容），不合法则重试一次，重试仍不合法则优雅降级使用原始输出。
>
> 3. **Consolidator 对话压缩**：保留最近 8 条消息，把旧消息每条截断 300 字符调 LLM 提取关键事实，结果通过 `appendLayeredMemory` 分层写入。有去重锁防止并发压缩同一会话。
>
> 4. **LayeredMemory 分层路由**：`splitMemorySections` 正则切分 LLM 输出为 User Profile 和 Project Context。分层模式下，前者写入全局 `~/.catbuddy/workspace/memory/MEMORY.md`，后者写入项目 `{workspace}/memory/MEMORY.md`。非分层模式下全写入全局。
>
> 5. **AutoCompact 调度**：按"空闲时间 × 消息量"降序排列候选会话，每轮最多压缩 3 个。指数退避——失败 5 分钟 → 10 分钟 → 20 分钟。跳过活跃会话和正在压缩的会话。返回统计信息供监控。

> 下一篇聊 Token 精确计数与上下文治理——js-tiktoken 的 BPE 分词是怎么工作的？`_governContext` 四步自愈（丢弃孤儿工具结果 / 回填缺失工具结果 / 微压缩旧输出 / token 预算截断）是怎么在 LLM 调用前把消息数组整理到可控范围内的？
