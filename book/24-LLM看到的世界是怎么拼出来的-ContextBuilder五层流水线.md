# 23｜LLM 看到的"世界"是怎么拼出来的？——ContextBuilder 五层流水线

> 这是 CatBuddy 技术专栏的第 23 篇。上篇讲了 Agent 的四层错误防线——Provider 重试、Fallback 链、AgentRunner 自恢复、Logger 追踪。这篇回到 Agent 的"大脑"：每次对话开始前，系统提示词是怎么组装的？LLM 看到的那个"世界"到底是怎么拼出来的？

> **核心问题**：ContextBuilder 怎么把 Handlebars 模板、引导文件、分层记忆、技能清单拼成 LLM 看到的那一长串系统提示词？基于 mtime 的指纹缓存怎么避免重复构建？Jinja2→Handlebars 的翻译层是怎么工作的？

---

前面讲 Agent Loop（第 05 篇）、上下文防御（第 06 篇）、Skill 系统（第 10 篇）时，都暗含了一个前提：Agent 有一个"系统提示词"。它是 LLM 看到的第一条消息，定义了 Agent 的身份、能力、约束和记忆。

但这条提示词到底是怎么拼出来的？如果你打开 CatBuddy 的日志，会看到类似这样的内容被发送给 LLM：

```text
[system]
You are catbuddy 🐱, a smart and caring cat-spirit AI assistant.
OS: win32 / Node.js v20.14.0
Work root: C:/Users/luli_/Desktop/catbuddy

## AGENTS.md
...项目级的 Agent 行为规范...

## SOUL.md
...Agent 的性格设定...

## USER.md
...用户画像：名字、偏好、时区...

## TOOLS.md
...用户自定义的工具使用说明...

## Long-Term Memory (You)
...从历史对话中提取的关于用户的长期记忆...

## Project Memory
...关于当前项目的长期记忆...

## Always-On Skills
...memory skill 和 my skill 的完整 SKILL.md...

## Available Skills
- drawio: 生成 Draw.io 架构图
- github: 搜索 GitHub 仓库
...
```

这不是一个写死的字符串。它是由 **ContextBuilder 五层流水线**动态组装出来的，涉及 6 个源文件、530 行 TypeScript。

---

## 23.1 为什么系统提示词的构建值得一篇文章

你可能会觉得：不就是拼字符串吗？模板引擎 + 文件读取，有什么好讲的？

但这个流水线有三个不简单的点：

**1. 它是动态的，不是静态的。** 同一个 Agent，在不同项目里看到的"世界"完全不同——换一个工作区，AGENTS.md、SOUL.md、USER.md、MEMORY.md 全变了。换一个 channel（telegram vs cli vs desktop），连身份文本都会变。这不是"启动时读一次"的问题——每个请求都可能读到不同的文件。

**2. 它必须快。** 系统提示词可能有几千个 token。如果每次用户发消息都重新读文件、跑 Handlebars 渲染、拼字符串，累积的 I/O 延迟会拖慢整个响应。需要缓存，但缓存应该在文件内容变化时自动失效。

**3. 它涉及三套不同的内容来源。** Handlebars 模板（代码仓库里的 `.md` 模板）→ 引导文件（工作区里的 `AGENTS.md` 等，用户可以编辑）→ 运行时数据（当前时间、channel、技能列表）。三套来源的"变化检测"方式完全不同。

下面逐层拆解这五层流水线。

---

## 23.2 第一层：Handlebars 模板引擎——不是直接用 Markdown，而是编译成模板

CatBuddy 的系统提示词不是硬编码的字符串。它来自 `templates/agent/` 目录下的 Handlebars 模板文件。但这里有一个有趣的细节：**这些模板原本是用 Jinja2 写的**（因为原版 CatBuddy 是 Python 项目），TypeScript 重写时需要一个翻译层。

```typescript:7:25:apps/desktop/src/main/agent/context/template-loader.ts
function loadTemplate(relativePath: string): HandlebarsTemplateDelegate {
  const fullPath = path.join(TEMPLATES_DIR, relativePath)
  const raw = fs.readFileSync(fullPath, 'utf-8')
  const withIncludes = raw.replace(
    /\{%\s*include\s+['"]agent\/_snippets\/([^'"]+)['"]\s*%\}/g,
    (_, name) => {
      const snippet = fs.readFileSync(path.join(TEMPLATES_DIR, 'agent', '_snippets', name), 'utf-8')
      return snippet
    },
  )
  let hbs = withIncludes
    // Jinja2 → Handlebars 条件块
    .replace(/\{%\s*if\s+part\s*==\s*'system'\s*%\}/g, '{{#if is_system}}')
    .replace(/\{%\s*elif\s+part\s*==\s*'user'\s*%\}/g, '{{else}}')
    .replace(/\{%\s*else\s*%\}/g, '{{else}}')
    .replace(/\{%\s*endif\s*%\}/g, '{{/if}}')
    .replace(/\{\{\s+(\w+(?:\.\w+)*)\s+\}\}/g, '{{$1}}')
  return Handlebars.compile(hbs, { noEscape: true })
}
```

注意 `loadTemplate` 做了三件事：

**1. 内联 `{% include %}`。** Jinja2 的 `{% include 'agent/_snippets/xxx.md' %}` 被正则直接替换为对应文件的内容，然后一起编译。这样 Handlebars 看到的已经是完整文本了。

**2. 翻译控制流。** `{% if part == 'system' %}` → `{{#if is_system}}`，`{% endif %}` → `{{/if}}`。简单的字符串替换，但覆盖了模板中最常用的条件结构。

**3. 编译为函数。** `Handlebars.compile(hbs, { noEscape: true })`——注意 `noEscape: true`。系统提示词里可能包含 HTML 特殊字符（如 `<`、`>` 在代码示例中），Handlebars 默认会转义它们为 `&lt;`，这会导致 LLM 看到的是乱码。`noEscape` 禁用转义。

在构造函数中，`TemplateLoader` 预编译了所有需要的模板：

```typescript:40:59:apps/desktop/src/main/agent/context/template-loader.ts
  constructor() {
    try {
      this.templates.identity = loadTemplate('agent/identity.md')
      this.templates.platformPolicy = loadTemplate('agent/platform_policy.md')
      this.templates.skillsSection = loadTemplate('agent/skills_section.md')
      // 子 Agent 模板
      this.templates.subagentSystem = loadTemplate('agent/subagent_system.md')
      this.templates.subagentAnnounce = loadTemplate('agent/subagent_announce.md')
      // Dream 阶段模板
      this.templates.dreamPhase1 = loadTemplate('agent/dream_phase1.md')
      this.templates.dreamPhase2 = loadTemplate('agent/dream_phase2.md')
      // 记忆压缩模板
      this.templates.consolidatorArchive = loadTemplate('agent/consolidator_archive.md')
      // 子 Agent 通知评估器
      this.templates.evaluator = loadTemplate('agent/evaluator.md')
      // 最大迭代次数消息
      this.templates.maxIterationsMessage = loadTemplate('agent/max_iterations_message.md')
    } catch {
      console.warn('Templates not found at', TEMPLATES_DIR, '- using built-in defaults')
    }
  }
```

9 个模板在构造时就加载完成——没有懒加载，没有动态编译。启动时全部就位，运行时只做渲染。

| 模板 | 用途 | 在五层流水线的位置 |
|------|------|-----------------|
| `identity.md` | Agent 的身份声明（"You are catbuddy 🐱..."） | 第一层 |
| `platform_policy.md` | 平台策略（Windows vs macOS 的路径格式差异） | 第一层（内嵌） |
| `skills_section.md` | 技能列表的渲染格式 | 第五层 |
| `subagent_system.md` | 子 Agent 的系统提示词 | 子 Agent（非主流水线） |
| `dream_phase1.md` / `phase2.md` | Dream 记忆提取的两个阶段提示词 | Dream（非主流水线） |
| `consolidator_archive.md` | 对话压缩的提取提示词 | Consolidator（非主流水线） |

其中 `identity.md` 是流水线的起点：

```typescript:64:87:apps/desktop/src/main/agent/context/template-loader.ts
  renderIdentity(
    channel: string,
    workRoot: string,
    workspace: string,
    fileAccessMode: FileAccessMode,
  ): string {
    if (!this.templates.identity) return ''
    const isWindows = process.platform === 'win32'
    const platformPolicy = this.templates.platformPolicy
      ? this.templates.platformPolicy({ isWindows })
      : ''
    const runtime = `OS: ${process.platform} / Node.js ${process.version}`

    return this.templates.identity({
      runtime,
      work_root: workRoot.replace(/\\/g, '/'),
      workspace_path: workspace.replace(/\\/g, '/'),
      file_access_project: fileAccessMode === 'project',
      file_access_internal: fileAccessMode === 'internal',
      platform_policy: platformPolicy,
      channel,
      ...channelFlags(channel),
    })
  }
```

注意 `channelFlags(channel)`——这个函数根据 channel 名称设置不同的布尔标记：

```typescript:27:35:apps/desktop/src/main/agent/context/template-loader.ts
function channelFlags(channel: string) {
  const ch = channel.toLowerCase()
  return {
    isMessagingApp: ch === 'telegram' || ch === 'qq' || ch === 'discord',
    isPlainMessaging: ch === 'whatsapp' || ch === 'sms',
    isEmail: ch === 'email',
    isTerminalChannel: ch === 'cli' || ch === 'mochat',
  }
}
```

这意味着 `identity.md` 模板里可以写 `{{#if isMessagingApp}}` 这样的条件——同一个模板，在 Telegram bot 里渲染出来的是"简洁回复"，在 Desktop 里渲染出来的是"完整工作区上下文"。**一个模板，多个面孔。**

---

## 23.3 第二层：引导文件——用户可编辑的 Agent 配置文件

模板渲染完后，流水线加载四个引导文件。这些文件存放在用户的工作区目录下，用户可以随时编辑它们来定制 Agent 的行为：

```typescript:4:4:apps/desktop/src/main/agent/context/types.ts
export const BOOTSTRAP_FILES = ['AGENTS.md', 'SOUL.md', 'USER.md', 'TOOLS.md'] as const
```

| 文件 | 内容 | 谁编辑 | 加载逻辑 |
|------|------|--------|---------|
| `AGENTS.md` | Agent 行为规范——这个项目里 Agent 应该怎么表现 | 开发者 | 总是从项目工作区加载 |
| `SOUL.md` | Agent 的性格设定——说话风格、回复偏好 | 用户/开发者 | 总是从项目工作区加载 |
| `USER.md` | 用户画像——名字、偏好、时区、沟通风格 | 用户 | 如果启用了全局画像，从 `~/.catbuddy/workspace` 加载 |
| `TOOLS.md` | 自定义工具使用说明 | 开发者 | 总是从项目工作区加载 |

```typescript:89:97:apps/desktop/src/main/agent/context/prompt-builder.ts
    for (const name of BOOTSTRAP_FILES) {
      if (name === 'USER.md' && this.usesGlobalProfile()) {
        const content = this.fs.readWorkspaceFile('USER.md', this.globalWorkspace)
        if (content) parts.push(`## ${name}\n\n${content}`)
        continue
      }
      const content = this.fs.readWorkspaceFile(name)
      if (content) parts.push(`## ${name}\n\n${content}`)
    }
```

`USER.md` 有一个特殊处理：如果启用了全局画像（即 `~/.catbuddy/workspace` 不同于当前项目的工作区），USER.md 从全局目录加载。这意味着你在所有项目里共享同一个用户画像——不需要在每个项目里都写一遍"我叫张三，喜欢用 TypeScript"。

如果引导文件不存在，`WorkspaceFileSystem.ensureBootstrapFiles()` 会从模板目录复制默认文件：

```typescript:33:45:apps/desktop/src/main/agent/context/file-system.ts
  ensureBootstrapFiles(): void {
    ensureGlobalProfileBootstrap()
    fs.mkdirSync(this.workspace, { recursive: true })
    for (const name of BOOTSTRAP_FILES) {
      if (name === 'USER.md' && this.usesGlobalProfile()) continue
      const dest = path.join(this.workspace, name)
      if (!fs.existsSync(dest)) {
        const src = path.join(TEMPLATES_DIR, name)
        if (fs.existsSync(src)) {
          fs.copyFileSync(src, dest)
        }
      }
    }
```

默认文件只有框架性的内容（如 `SOUL.md` 默认是"Be helpful and concise."）。用户可以按需补充。

---

## 23.4 第三层：分层记忆——"你"的长期记忆 + "这个项目"的长期记忆

这是 CatBuddy 记忆系统中最精妙的设计之一。前面第 06 篇讲过上下文防御——对话太长时怎么压缩。但那些被压缩的内容去哪了？

它们被提取为结构化记忆，存储在 `MEMORY.md` 中。而且分两层：

```typescript:99:109:apps/desktop/src/main/agent/context/prompt-builder.ts
    const globalMemory = this.fs.readWorkspaceFile('memory/MEMORY.md', this.globalWorkspace)
    if (globalMemory && !this.templates.isDefaultMemory(globalMemory)) {
      const title = this.usesGlobalProfile() ? 'Long-Term Memory (You)' : 'Long-Term Memory'
      parts.push(`## ${title}\n\n${globalMemory}`)
    }
    if (this.usesGlobalProfile()) {
      const projectMemory = this.fs.readWorkspaceFile('memory/MEMORY.md')
      if (projectMemory && !this.templates.isDefaultMemory(projectMemory)) {
        parts.push(`## Project Memory\n\n${projectMemory}`)
      }
    }
```

如果启用了全局画像架构，系统提示词里会出现两个记忆区块：

- **Long-Term Memory (You)** — 从 `~/.catbuddy/workspace/memory/MEMORY.md` 加载。这是**跨项目的用户级记忆**：你叫什么、喜欢什么技术栈、常用的沟通风格。Dream 系统提取的 `User Profile` 部分存在这里。
- **Project Memory** — 从 `{workspace}/memory/MEMORY.md` 加载。这是**项目级记忆**：这个项目的技术栈是什么、最近的架构决策、正在进行的任务。Dream 系统提取的 `Project Context` 部分存在这里。

`isDefaultMemory()` 检查很重要——如果 `MEMORY.md` 还是模板默认内容（通常是空的或只有占位符），就不注入系统提示词，避免浪费 token。这个检查很简单但很聪明：

```typescript:193:200:apps/desktop/src/main/agent/context/template-loader.ts
  isDefaultMemory(content: string): boolean {
    try {
      const tmpl = fs.readFileSync(path.join(TEMPLATES_DIR, 'memory', 'MEMORY.md'), 'utf-8')
      return content.trim() === tmpl.trim()
    } catch {
      return false
    }
  }
```

就是字符串比对——如果当前 MEMORY.md 和模板一模一样，说明还没有任何记忆被写入。

---

## 23.5 第四层：始终在线技能——memory 和 my

有些技能不需要用户手动激活——它们始终在线。`SkillLoader` 加载两类技能：

- **始终在线技能**（`ALWAYS_LOAD_SKILLS = ['memory', 'my']`）——完整的 SKILL.md 内容直接注入系统提示词
- **按需技能**（其他所有 Skill）——只注入一个名称+描述的摘要，节省 token

```typescript:18:25:apps/desktop/src/main/agent/context/skill-loader.ts
  loadAlwaysSkills(): string {
    const parts: string[] = []
    for (const name of ALWAYS_LOAD_SKILLS) {
      const content = this.readSkill(name)
      if (content) parts.push(content)
    }
    return parts.join('\n\n')
  }
```

`readSkill` 先查工作区的技能目录（用户可以覆盖内置技能），再查内置技能目录：

```typescript:27:38:apps/desktop/src/main/agent/context/skill-loader.ts
  readSkill(name: string): string {
    const workspaceSkill = path.join(this.workspace, 'skills', name, 'SKILL.md')
    const builtinSkill = path.join(resolveBuiltinSkillsDir(), name, 'SKILL.md')

    for (const p of [workspaceSkill, builtinSkill]) {
      try {
        const raw = fs.readFileSync(p, 'utf-8')
        return stripFrontmatter(raw)
      } catch {}
    }
    return ''
  }
```

工作区优先，内置兜底。用户可以在项目里创建 `skills/memory/SKILL.md` 来覆盖内置的 memory skill 行为。

---

## 23.6 第五层：技能摘要——不注入全文，只注入目录

第五层处理按需技能。把所有可用的、非始终在线的技能列成一行一行的 `- **name**: description`：

```typescript:40:47:apps/desktop/src/main/agent/context/skill-loader.ts
  buildSkillsSummary(): string {
    const skills = listDiscoverableSkills(this.workspace, this.disabledSkills)
      .filter((s) => !ALWAYS_ON_SKILLS.has(s.name) && s.enabled)

    if (skills.length === 0) return ''

    return skills.map((s) => `- **${s.name}**: ${s.description}`).join('\n')
  }
```

只注入摘要而不是全文，是因为按需技能的全文可能很长（比如 drawio skill 包含完整的 Diagram DSL 指令）。全文只在 Agent 实际调用该技能时才通过 Skill 系统注入。系统提示词里只需要一个目录。

然后这个摘要通过 `templates.renderSkillsSection()` 套一层模板格式后加入流水线。

---

## 23.7 五层顺序与兜底

`PromptBuilder._assembleSystemPrompt()` 是整条流水线的核心：

```typescript:78:124:apps/desktop/src/main/agent/context/prompt-builder.ts
  private _assembleSystemPrompt(channel: string): string {
    const parts: string[] = []

    const identity = this.templates.renderIdentity(
      channel, this.workRoot, this.workspace, this.fileAccessMode,
    )
    if (identity) parts.push(identity)

    for (const name of BOOTSTRAP_FILES) {
      if (name === 'USER.md' && this.usesGlobalProfile()) {
        const content = this.fs.readWorkspaceFile('USER.md', this.globalWorkspace)
        if (content) parts.push(`## ${name}\n\n${content}`)
        continue
      }
      const content = this.fs.readWorkspaceFile(name)
      if (content) parts.push(`## ${name}\n\n${content}`)
    }

    const globalMemory = this.fs.readWorkspaceFile('memory/MEMORY.md', this.globalWorkspace)
    if (globalMemory && !this.templates.isDefaultMemory(globalMemory)) {
      const title = this.usesGlobalProfile() ? 'Long-Term Memory (You)' : 'Long-Term Memory'
      parts.push(`## ${title}\n\n${globalMemory}`)
    }
    if (this.usesGlobalProfile()) {
      const projectMemory = this.fs.readWorkspaceFile('memory/MEMORY.md')
      if (projectMemory && !this.templates.isDefaultMemory(projectMemory)) {
        parts.push(`## Project Memory\n\n${projectMemory}`)
      }
    }

    const alwaysSkills = this.skills.loadAlwaysSkills()
    if (alwaysSkills) parts.push(alwaysSkills)

    const skillsSummary = this.skills.buildSkillsSummary()
    if (skillsSummary) parts.push(this.templates.renderSkillsSection(skillsSummary))

    if (parts.length === 0) {
      parts.push(
        `You are catbuddy 🐱, a smart and caring cat-spirit AI assistant...`,
      )
    }

    return parts.join('\n\n---\n\n')
  }
```

五层之间用 `\n\n---\n\n` 分隔——Markdown 的分隔线，对 LLM 来说是一个清晰的视觉边界。

顺序是有意设计的：
1. **身份**（谁 / 在哪 / 什么规则）——先立住
2. **引导文件**（AGENTS / SOUL / USER / TOOLS）——定制行为
3. **记忆**（长期记忆 / 项目记忆）——历史上下文
4. **始终在线技能**（memory / my）——能力声明
5. **技能摘要**（drawio / github / ...）——可用工具目录

这个顺序遵循了"最重要 → 次重要 → 可忽略"的降级原则——如果 token 预算紧张，后面的层可以省略也不影响核心功能。

最后有一个兜底：如果五层拼完 `parts` 还是空的（极端情况：没有模板文件、没有引导文件、没有记忆、没有技能），就返回一个最简身份声明。Agent 不会因为没有配置文件而启动失败。

---

## 23.8 指纹缓存：怎么避免每次都重新构建

系统提示词可能有好几千 token。如果每次 `build()` 都重新读文件、跑 Handlebars、拼字符串，每次请求都有 5-10ms 的 I/O 开销——累积起来不小。

`PromptBuilder` 用一个基于文件修改时间（mtime）的指纹缓存来避免这个问题：

```typescript:29:38:apps/desktop/src/main/agent/context/prompt-builder.ts
  buildSystemPrompt(opts?: BuildSystemPromptOptions): string {
    const channel = opts?.channel ?? 'desktop'
    const key = `${channel}:${this._fingerprint()}`
    const cached = this.cache.get(key)
    if (cached !== undefined) return cached

    const prompt = this._assembleSystemPrompt(channel)
    this.cache.set(key, prompt)
    return prompt
  }
```

缓存的 key 是 `channel:指纹`。指纹是如何计算的：

```typescript:49:68:apps/desktop/src/main/agent/context/prompt-builder.ts
  private _fingerprint(): string {
    const parts = [
      this.workspace,
      this.globalWorkspace,
      this.workRoot,
      this.fileAccessMode,
    ]
    for (const name of BOOTSTRAP_FILES) {
      const root = name === 'USER.md' && this.usesGlobalProfile()
        ? this.globalWorkspace
        : this.workspace
      parts.push(`${name}:${this._mtime(path.join(root, name))}`)
    }
    parts.push(`global-memory:${this._mtime(path.join(this.globalWorkspace, 'memory/MEMORY.md'))}`)
    if (this.usesGlobalProfile()) {
      parts.push(`project-memory:${this._mtime(path.join(this.workspace, 'memory/MEMORY.md'))}`)
    }
    parts.push(`skills:${this.skills.fingerprint()}`)
    return parts.join('\0')
  }
```

指纹包含了所有可能影响系统提示词内容的因素：
- **工作区路径**（换了项目就变）
- **四个引导文件的 mtime**（文件被编辑了就变）
- **全局记忆的 mtime**（Dream 写入新记忆就变）
- **项目记忆的 mtime**
- **技能目录的指纹**（技能被添加/删除/修改就变）

所有这些用 `\0`（null 字符）连接成一个字符串。任何一个文件被修改，指纹就变化，缓存就失效。**不需要任何事件通知或文件监听器——在 `buildSystemPrompt()` 调用时，用 mtime 的同步检查来判断是否需要重建。**

指纹使用 `statSync`——这是同步 I/O，但只涉及 6-8 个文件的 stat 调用，每次 < 1ms。考虑到避免了几千 token 的字符串拼接和 Handlebars 渲染，这个开销完全值得。

缓存本身是一个简单的 LRU：

```typescript:2:32:apps/desktop/src/main/agent/context/prompt-cache.ts
export class SystemPromptCache {
  private entries = new Map<string, string>()
  private readonly maxEntries: number

  constructor(maxEntries = 8) {
    this.maxEntries = maxEntries
  }

  get(key: string): string | undefined {
    const hit = this.entries.get(key)
    if (hit === undefined) return undefined
    // Refresh insertion order for simple LRU eviction.
    this.entries.delete(key)
    this.entries.set(key, hit)
    return hit
  }

  set(key: string, prompt: string): void {
    if (this.entries.has(key)) this.entries.delete(key)
    this.entries.set(key, prompt)
    while (this.entries.size > this.maxEntries) {
      const oldest = this.entries.keys().next().value
      if (oldest === undefined) break
      this.entries.delete(oldest)
    }
  }
```

`maxEntries = 8`——8 个 channel × 工作区组合的缓存。对于单用户使用来说绰绰有余。LRU 的实现也很轻量：`get` 时 delete + set 来刷新插入顺序，`set` 时如果超了就删最早的。

---

## 23.9 build()：最终的组装

`ContextBuilder.build()` 是用户代码直接调用的方法。它把系统提示词和历史消息组合成 LLM 的 `Context`：

```typescript:88:135:apps/desktop/src/main/agent/context/index.ts
  build(opts: BuildOptions): Context {
    const system = this.buildSystemPrompt({ channel: opts.channel, ... })

    const messages: LLMMessage[] = []
    // 如果有会话摘要（AutoCompact 产生的），作为第一条用户消息注入
    if (opts.sessionSummary) {
      messages.push({ role: 'user', content: `[Previous conversation summary]:\n${opts.sessionSummary}` })
    }

    // 历史消息（从 JSONL 加载的 MessageRecord）
    for (const m of opts.history) {
      messages.push({ role: m.role, content: m.content, ... })
    }

    // 当前消息 + 运行时上下文
    const runtimeCtx = this.promptBuilder.buildRuntimeContext(channel, chatId, senderId, timezone)
    const textWithCtx = runtimeCtx
      ? `${opts.currentMessage}\n\n[runtime: ${runtimeCtx}]`
      : opts.currentMessage

    messages.push({ role: 'user', content: buildUserContent(textWithCtx, opts.media ?? []) })

    return { messages, system, ... }
  }
```

注意最后的运行时上下文注入——当前时间、channel、chatId、senderId 被拼在用户消息的末尾，而不是系统提示词里。这样做的原因是：**系统提示词被缓存了，但当前时间是实时变化的。** 如果把时间放在系统提示词里，缓存会每毫秒失效。放在用户消息里完全合理，因为每条用户消息本来就不一样。

---

## 23.10 总结

> **这篇讲了什么？**
>
> 1. **Handlebars 模板层**：CatBuddy 用 Handlebars 替代 Python 原版 Jinja2，带一个 Jinja2→Handlebars 翻译层（`{% if %}` → `{{#if}}`、`{% include %}` 内联）。9 个模板在构造时预编译，运行时只做渲染。同一个 `identity.md` 根据 channel 类型（telegram / cli / desktop）渲染出不同的身份文本。
>
> 2. **引导文件层**：四个 Markdown 文件（AGENTS.md / SOUL.md / USER.md / TOOLS.md）让用户和开发者可以定制 Agent 的行为。USER.md 在全局画像模式下从 `~/.catbuddy/workspace` 加载，跨项目共享。文件不存在时自动从模板目录复制默认文件。
>
> 3. **分层记忆层**：全局 Memory（用户级，"关于你"的事实）+ 项目 Memory（项目级，"关于这个项目"的事实）。分离存储，分离注入系统提示词。`isDefaultMemory()` 检查避免注入空的模板占位符。
>
> 4. **始终在线技能 + 技能摘要层**：memory 和 my 两个技能完整注入系统提示词，其他技能只注入名称+描述一行。工作区技能覆盖内置技能。
>
> 5. **指纹缓存**：基于 6-8 个文件的 `statSync` mtime 计算指纹。任何文件变化 → 指纹变化 → 缓存失效自动重建。LRU 上限 8，热路径零 I/O。运行时上下文（时间、channel）不放在系统提示词里以避免缓存失效。

> 下一篇聊 Agent 的记忆处理管道——Dream 两阶段记忆提取怎么在后台周期性运行？Consolidator 怎么把长对话压缩成结构化事实？AutoCompact 怎么用"空闲时间 × 消息量"的优先级公式调度压缩任务？三层协作让 Agent 真的能"记住"。
