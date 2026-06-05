# 20｜让 AI 画架构图：Prompt 工程的一线实践

> 这是 CatBuddy 技术专栏的第 20 篇。上篇讲了 Gateway 会话同步——一块数据，三地一致。这篇聊一个更靠近 LLM 的话题：CatBuddy 有个功能——你描述系统，它自动生成 Draw.io 架构图。这篇聊聊这个功能背后的 Prompt 是怎么设计的，踩过哪些坑，"反向剔除"哲学是什么。

> **核心问题**：从自然语言描述到 Draw.io XML 的完整链路是怎样的？Prompt 模板的结构怎么设计？生成结果不准确时怎么修正？

---

## 19.1 Draw.io XML：不止是"又一个 XML 格式"

Draw.io（现在叫 diagrams.net）的底层存储格式是 **mxGraph XML**——一个描述图形节点、连线、布局的标记语言。一个完整的 `.drawio` 文件结构是这样的：

```xml
<mxfile>
  <diagram name="架构图" id="diagram-1">
    <mxGraphModel dx="1422" dy="794" grid="1" page="1" ...>
      <root>
        <mxCell id="0"/>                              <!-- 根节点（必须） -->
        <mxCell id="1" parent="0"/>                   <!-- 默认图层（必须） -->
        <mxCell id="2" value="前端" style="..." vertex="1" parent="1">  <!-- 你的第一个图形 -->
          <mxGeometry x="40" y="40" width="160" height="60" as="geometry"/>
        </mxCell>
        <mxCell id="3" style="..." edge="1" parent="1" source="2" target="4">  <!-- 一条连线 -->
          <mxGeometry relative="1" as="geometry"/>
        </mxCell>
      </root>
    </mxGraphModel>
  </diagram>
</mxfile>
```

如果你让 LLM 直接生成上面这样的完整 XML，99% 的情况下会出问题——缺少 `id="0"`、`parent` 属性搞错、嵌套关系混乱、甚至 XML 格式错误。

**那 CatBuddy 是怎么做的？** 答案是：**不要让它生成完整的 XML。让它只生成最核心的 `<mxCell>` 元素，剩下的包装工作由代码完成。**

---

## 19.2 "反向剔除"哲学：系统做 boilerplate，LLM 做创意

这是 Prompt 设计中最关键的洞察。大多数 Prompt 工程师的思路是"给 LLM 看完整的输出格式，让它原样照抄"。但面对 Draw.io XML 这种 650 行才出一个基础三层架构图的格式，这条路是死胡同。

**我们的做法是反过来：从完整 XML 中反向剔除 LLM 不需要关心的部分。**

### 包装层：代码承担

CatBuddy 的 `display_diagram` 工具在收到 LLM 生成的裸 `mxCell` 片段后，自动包裹成完整的 `.drawio` 文件：

```typescript:12:19:apps/desktop/src/main/agent/tools/display-diagram.ts
function ensureMxFile(xml: string): string {
  const trimmed = xml.trim()
  if (trimmed.startsWith('<mxfile')) return trimmed
  if (trimmed.startsWith('<mxGraphModel')) {
    return `<mxfile><diagram name="架构图" id="diagram-1">${trimmed}</diagram></mxfile>`
  }
  // 最常见的分支：裸 mxCell 片段
  return `<mxfile><diagram name="架构图" id="diagram-1"><mxGraphModel dx="1422" dy="794" grid="1" gridSize="10" ...><root><mxCell id="0"/><mxCell id="1" parent="0"/>${trimmed}</root></mxGraphModel></diagram></mxfile>`
}
```

三个分支覆盖了 LLM 可能输出的三种情况——有的模型会"自作聪明"加包装，有的不会。不管哪种，代码都能兜底。

### 创作层：LLM 负责

LLM 只需要生成**裸 mxCell 元素**。SKILL.md 的第 19 行写得非常直接：

> **Generate ONLY bare `<mxCell>` elements** — NO wrapper tags. The system auto-wraps them into a valid `.drawio` file.

同时给出三条核心约束：

- IDs 从 `"2"` 开始，唯一递增（`"0"`和`"1"`已被系统占用）
- 所有 `mxCell` 是平级兄弟元素，不能嵌套
- 顶级元素的 `parent` 设为 `"1"`

**你不需要告诉 LLM 什么是 `<mxfile>`、`<mxGraphModel>`、`<root>`**。它只需要关心"这个方块放在 x=40, y=40，宽 160，高 60"。

### 为什么这条路能走通

- **降低认知负担**：LLM 不需要理解 5 层嵌套的 XML 模板，只需要理解 `<mxCell>` 一种元素
- **降低错误面**：每层包装都是潜在的出错点，去掉 4 层包装就消灭了 4 类错误
- **token 更省**：生成的 XML 长度减少约 40%，意味着同样上下文窗口能生成更复杂的图

这就是"反向剔除"的核心：**不是教 LLM 生成完整 XML，而是让代码补全它不擅长的机械部分。**

---

## 19.3 Prompt 模板的迭代过程：从 40% 到 90% 可用率

### 第一版：零约束，只给一个示例

最初的 Prompt 很简单——告诉 LLM "请生成 Draw.io 架构图"，附上一个三节点示例：

```
你是一个 Draw.io 图表生成专家。请分析项目架构，生成对应的 XML。
```

**结果**：可用率约 40%。主要失败模式：
- 忘记 `id="0"` 和 `id="1"` 根节点
- 容器内的子元素 parent 指向错误
- 连线忘了设置 `source` 和 `target`
- XML 字符未转义（`<`、`&`）

### 第二版：加上布局约束

在第一版基础上增加了空间布局规则：

```
- 所有元素 x: 0-800, y: 0-600
- 起点 x=40, y=40
- 相邻元素间距 150-200px
```

**结果**：可用率提升到 55%。布局不再挤成一团，但连线问题仍然严重——多条连线重叠、双向连线互相穿过。

### 第三版：连线五规则（突破性提升）

这是我们投入最多的一版。观察了上百个失败案例后，提炼出 5 条连线规则：

```markdown:49:63:apps/desktop/skills/diagram/SKILL.md
## Edge Routing — 5 Rules

1. **Stagger parallel edges**: Use `exitY=0.3` / `exitY=0.7` on edges between same nodes.
2. **Bidirectional**: A→B exits RIGHT (`exitX=1`), B→A exits LEFT (`exitX=0`).
3. **Always set exitX/exitY/entryX/entryY** on every edge.
4. **Avoid obstacles with waypoints**: Route around shapes between source and target.
5. **Use natural connection points** (edge centers), never corners (no entryX=1,entryY=1).
```

特别是第 4 条——waypoint 绕行——专门解决"连线穿过中间节点"这个高频问题：

```xml
<mxCell id="e1" style="edgeStyle=orthogonalEdgeStyle;..." edge="1" parent="1" source="a" target="b">
  <mxGeometry relative="1" as="geometry">
    <Array as="points">
      <mxPoint x="300" y="200"/>
      <mxPoint x="500" y="200"/>
    </Array>
  </mxGeometry>
</mxCell>
```

**结果**：可用率跃升至 75%。这个版本的连线质量已经达到"基本不需要手动调整"的水平。

### 第四版（当前）：完整 Skill + 工具链

当前版本把 Prompt 搬到了 `SKILL.md`，作为一个可插拔的技能包。关键改进：

1. **分层颜色体系**：前端蓝 `#dae8fc`、后端绿 `#d5e8d4`、数据橙 `#ffe6cc`、基础设施紫 `#e1d5e7`、外部红 `#f8cecc`——LLM 不需要"猜"用什么色，一张表搞定
2. **Swimlane 完整示例**：游泳道是出错率最高的元素，给完整示例避免了"子元素 parent 指向容器"的常见错误
3. **三种连线示例**：基础连线、容器连线、带 waypoint 绕行——覆盖了 90% 的场景
4. **工具链衔接**：明确写出"Call `display_diagram({ xml: "..." })`"，让 LLM 知道下一步做什么

**当前可用率**：约 90%。剩下的 10% 失败主要是极复杂图（20+ 节点）导致 ID 冲突或超出画布范围。

---

## 19.4 三个工具的"委托式"架构

Prompt 只是设计的一部分。**工具链设计才是保证输出质量和用户体验的关键。** CatBuddy 为架构图功能设计了三个独立的 Agent Tool：

### display_diagram：一次性生成

适用于中等复杂度的图（10-15 个节点以内）：

```typescript:71:77:apps/desktop/src/main/agent/tools/display-diagram.ts
    execute: async (call) => {
      const { xml, path: requestedPath, title } = call.arguments as Record<string, unknown>
      const rawXml = String(xml ?? '').trim()
      if (!rawXml) return 'Error: display_diagram requires a non-empty xml string.'
      if (!looksLikeDrawioXml(rawXml)) {
        return 'Error: display_diagram.xml must be actual Draw.io XML starting with <mxfile>, <mxGraphModel>, or <mxCell>.'
      }
```

注意 `looksLikeDrawioXml()` 这个校验——它不是用 XML parser，而是直接检查开头字符：

```typescript:5:10:apps/desktop/src/main/agent/tools/display-diagram.ts
function looksLikeDrawioXml(xml: string): boolean {
  const trimmed = xml.trim()
  return trimmed.startsWith('<mxfile')
    || trimmed.startsWith('<mxGraphModel')
    || trimmed.startsWith('<mxCell')
}
```

**比 XML 解析更宽容，比不校验更严格。** 如果 LLM 输出的是 Mermaid 语法或 Markdown 表格，直接拒绝并给出明确指引。

### append_diagram：处理截断输出

当 LLM 的上下文窗口不足以一次输出完整图表时（大项目 30+ 节点的架构图），`append_diagram` 允许分片追加：

```typescript:95:101:apps/desktop/src/main/agent/tools/append-diagram.ts
      const idx = rootCloseIndex(before)
      if (idx < 0) return `Error: could not find </root> in ${display}`

      const cells = extractMxCells(fragment)
      const validationError = validateCells(before, cells)
      if (validationError) return `Error appending diagram: ${validationError}`
```

`extractMxCells()` 用正则从截断的不完整输出中提取完整 `<mxCell>` 元素，然后逐条验证：
- 每个 cell 必须有 `id` 属性
- 不能是根节点 `"0"` 或 `"1"`
- ID 不能与已有节点重复

### edit_diagram：增量修改

生成后用户可能需要修改。`edit_diagram` 提供了**基于 ID 的增删改**操作，核心是一个精密的 `cellRegex()`：

```typescript:31:37:apps/desktop/src/main/agent/tools/edit-diagram.ts
function cellRegex(cellId: string): RegExp {
  const id = escapeRegExp(cellId)
  return new RegExp(
    `<mxCell\\b(?=[^>]*\\bid=["']${id}["'])[^>]*(?:\\/>|>[\\s\\S]*?<\\/mxCell>)`,
    'm',
  )
}
```

这个正则用 **lookahead 断言**在 `<mxCell` 标签内部匹配 `id` 属性值，然后捕获整个自闭合或成对闭合的 mxCell 元素。因为用的是 lookahead 而非 capture group，保证了匹配的精确性——只替换目标 ID 的 cell，不会误伤其他。

删除操作还会级联清理引用该节点的连线：

```typescript:67:77:apps/desktop/src/main/agent/tools/edit-diagram.ts
  const edge = new RegExp(
    `<mxCell\\b(?=[^>]*\\bedge=["']1["'])(?=[^>]*(?:\\bsource=["']${id}["']|\\btarget=["']${id}["']))[^>]*(?:\\/>|>[\\s\\S]*?<\\/mxCell>)`,
    'gm',
  )
  next = next.replace(edge, () => {
    removed += 1
    return ''
  })
```

**三个工具的分工非常清晰**：`display_diagram` 负责"造"、`append_diagram` 负责"续"、`edit_diagram` 负责"改"。每个工具的 Prompt（tool description）都包含完整的示例和错误指引，让 LLM 知道自己该在什么时候用哪个。

---

## 19.5 Shape Library：按需加载的"图例手册"

对于云架构图（AWS、Kubernetes），你需要的不只是方块和连线——你需要 EC2 图标、S3 图标、Lambda 图标。Draw.io 内置了 1000+ 专业图标，但 style 格式各不相同。

**如果把所有图标语法塞进 System Prompt，不仅浪费 token，还会让 LLM 在不需要的时候也"看到"这些信息，干扰判断。**

CatBuddy 的做法是**按需加载 Shape Library**。`get_shape_library` 工具让 LLM 在需要时主动查询：

```typescript:46:68:apps/desktop/src/main/agent/tools/get-shape-library.ts
    execute: async (call) => {
      const { library } = call.arguments as Record<string, unknown>
      const raw = String(library ?? '').trim()
      if (!raw) return 'Error: library name is required.'

      const safe = sanitizeName(raw)
      // ...
      const filePath = path.join(libDir, `${safe}.md`)
      const resolved = path.resolve(filePath)

      // Path traversal protection
      if (!resolved.startsWith(path.resolve(libDir))) {
        return 'Error: invalid library path.'
      }

      try {
        const content = fs.readFileSync(filePath, 'utf-8')
        return content
      }
```

Shape Library 文件是纯 Markdown（如 `aws4.md`），包含每个服务的 shape 名称和 style 语法：

```markdown:8:12:apps/desktop/src/main/agent/tools/shape-libraries/aws4.md
<mxCell value="label" style="shape=mxgraph.aws4.resourceIcon;resIcon=mxgraph.aws4.{shape};fillColor=#ED7100;..." vertex="1" parent="1">
  <mxGeometry x="0" y="0" width="78" height="78" as="geometry" />
</mxCell>
```

然后是一个 100+ 条目的**分类服务列表**：Compute（ec2, lambda, ecs...）、Storage（s3, efs...）、Database（rds, dynamodb...）、Networking（vpc, api_gateway...）——每个条目给出了服务名、shape 名称和一句话描述。

**设计要点**：
- **文件即图例**：不需要维护代码，加一个 `.md` 文件就能支持新图标库
- **路径遍历防护**：`sanitizeName` + `startsWith` 双重保护，防止 LLM 用 `../../` 读取系统文件
- **友好降级**：如果库不存在，返回的是可用库列表，而不是模糊的 "not found"

---

## 19.6 校验三层防线：从 Prompt 到代码的防御体系

CatBuddy **没有一个显式的"生成→解析XML→失败→把错误喂回LLM→重新生成"循环**。取而代之的是**三层渐进式校验**：

### 第一层：Prompt 级约束（SKILL.md）

在 LLM 开始生成之前，SKILL.md 就设下了严格的格式规范。这层约束的特点是**预防性**——在错误发生之前就消除最常见的出错路径：

- "Generate ONLY bare `<mxCell>` elements" → 消除包装格式错误
- "ID starts from '2', unique and sequential" → 消除 ID 冲突
- "Escape: `&lt;` `&gt;` `&amp;` `&quot;`" → 消除 XML 转义错误
- "x=0~800, y=0~600" → 消除越界布局

### 第二层：工具级校验（Tool description + execute）

每个工具的 `definition.function.description` 中包含了精简版的格式约束——当 LLM 读取可用工具列表时，它会再次看到这些约束。

`display_diagram` 的 `execute()` 入口的 `looksLikeDrawioXml()` 是第一道硬校验：

```typescript:75:77:apps/desktop/src/main/agent/tools/display-diagram.ts
      if (!looksLikeDrawioXml(rawXml)) {
        return 'Error: display_diagram.xml must be actual Draw.io XML starting with <mxfile>, <mxGraphModel>, or <mxCell>. Do not pass Markdown, ASCII diagrams, Mermaid, or plain text. Generate valid Draw.io XML and retry.'
      }
```

**注意这个错误消息的措辞**——它不是简单说"格式错误"，而是明确列出 LLM 最容易犯的替代方案（Markdown / ASCII / Mermaid）。这给了 LLM 足够的上下文来"理解自己做错了什么"，然后在下一次 tool call 中修正。

`append_diagram` 的 `validateCells()` 则更进一步——逐条检查 ID 的唯一性、格式完整性、重复检测：

```typescript:33:46:apps/desktop/src/main/agent/tools/append-diagram.ts
function validateCells(existingXml: string, cells: string[]): string | null {
  if (cells.length === 0) return 'No complete <mxCell> elements found in xml'
  const seen = new Set<string>()
  for (const cell of cells) {
    const id = cellId(cell)
    if (!id) return 'Every appended mxCell must have an id attribute'
    if (id === '0' || id === '1') return 'Do not append root cells id="0" or id="1"'
    if (seen.has(id)) return `Duplicate cell id in appended fragment: ${id}`
    if (hasCell(existingXml, id)) return `Cell already exists in diagram: ${id}`
    seen.add(id)
  }
  return null
}
```

### 第三层：正则级精确校验（操作执行时）

`edit_diagram` 的 `cellRegex()` 和 `deleteCellAndReferencingEdges()` 是第三层——在执行修改操作时进行精确的模式匹配。它不信任 LLM 传过来的 cell_id 一定存在，每次都做真实性检查：

```typescript:95:108:apps/desktop/src/main/agent/tools/edit-diagram.ts
    if (op.operation === 'update') {
      const err = validateNewCellXml(op.cell_id, op.new_xml)
      if (err) { errors.push(...); continue }
      const re = cellRegex(op.cell_id)
      if (!re.test(next)) {
        errors.push({ operation: 'update', cellId: op.cell_id, message: 'Cell not found' })
        continue
      }
```

### 为什么没有"解析XML→修正循环"？

因为**把解析错误喂回 LLM 的效率太低**。XML 解析器返回的错误通常是 "line 47: unexpected token"，LLM 很难从这个信息反推出"哦，是我第 12 个 mxCell 的 parent 属性写错了"。

三层校验的策略是：**让每一层的错误消息都对 LLM 友好**。
- 第一层（Prompt）：从不犯错
- 第二层（Tool 校验）：返回"你用了 Markdown，请用 Draw.io XML"
- 第三层（正则校验）：返回"cell '5' 不存在，试试先读 `.drawio` 文件看实际有哪些 ID"

每个错误消息本身就是一个微型的修正 Prompt。

---

## 19.7 经验总结：Prompt 工程的四条原则

### 原则一：反向剔除 > 正向包装

**让系统做 boilerplate，让 LLM 做 creative。** 这条原则不仅适用于 Draw.io——任何需要 LLM 生成结构化数据的场景都适用：

- 生成 JSON？别让 LLM 写 `{ "data": { "items": [...] } }` 的外壳，让它只写 `items`
- 生成 HTML？别让 LLM 写 `<!DOCTYPE html><html><head>...`，让它只写 `<body>` 内的内容
- 生成 SQL？别让它写完整的 DDL，让它只写字段定义

**判断标准**：如果一个输出模板中 60% 以上的内容每次都是机械重复的，这些重复部分就不应该由 LLM 生成。

### 原则二：示例的密度决定质量

观察 SKILL.md 的结构，你会发现**示例占比极高**：
- 总行数 128 行，其中示例代码（含注释）占 60+ 行，接近 50%
- 每种图形类型都有示例：shape、edge、swimlane、waypoint
- 最后有一个完整的**三层架构完整示例**——8 个 mxCell + 2 条连线，够"完整"但不过分

**单个复杂示例 > 十条文字规则。** LLM 从示例中提取模式的能力远强于从文字规则中推导。

### 原则三：错误消息就是微 Prompt

工具返回的错误消息不是给用户看的——是给 LLM 看的。每条错误消息都应该包含：
1. **发生了什么**（"Cell not found"）
2. **可能的原因**（"check the XML for correct IDs"）
3. **建议的下一步**（"read the .drawio file with read_file first"）

格式上，用 `Error:` 前缀让 LLM 能准确判断这是错误而非正常结果。

### 原则四：分层约束 ≠ 单一巨型 Prompt

不要把所有的规则塞进一个 System Prompt。CatBuddy 的架构图功能有四层信息来源：

| 层级 | 内容 | 作用 |
|------|------|------|
| Skill（SKILL.md） | 完整的格式规范 + 示例 | 提供"全局知识" |
| Tool description | 特定工具的用法 + 约束 | 提供"局部知识" |
| Shape Library | 图标名称 + 语法 | 提供"领域知识" |
| 校验错误消息 | 具体的失败原因 + 修正建议 | 提供"反馈知识" |

LLM 在决策时会综合考虑这四个层次，但**每次 tool call 只需要看到相关的那部分**。这比一个 2000 字的巨型 System Prompt 效率高得多。

---

## 19.8 总结

> **这篇讲了什么？**
>
> 1. CatBuddy 的架构图生成功能遵循**"反向剔除"哲学**——代码负责包装层（`<mxfile>`、`<mxGraphModel>`、`<root>`），LLM 只负责生成核心的 `<mxCell>` 元素。`ensureMxFile()` 函数处理三种输入格式（mxCell/mxGraphModel/mxfile），无论 LLM "自作聪明"加了什么包装都能兜底。
>
> 2. Prompt 模板经历了四轮迭代：从初始的 40% 可用率，到加入布局约束（55%），到连线五规则（75%），最终到完整 Skill + 工具链（90%）。突破性提升来自**从失败案例中提炼具体规则**——特别是连线错开（`exitY=0.3/0.7`）和 waypoint 绕行。
>
> 3. 三个工具（`display_diagram`、`append_diagram`、`edit_diagram`）形成了完整的生成-续写-修改工具链。`get_shape_library` 按需加载 100+ 云服务图标语法。校验体系采用三层渐进式设计：Prompt 级约束 → Tool 级正则校验 → 操作执行时的精确匹配。
>
> 4. 四条 Prompt 工程原则：反向剔除（系统做 boilerplate）、示例密度（50% 内容为示例）、错误消息即微 Prompt（含原因+建议）、分层约束（Skill/Tool/Library/Error 四个信息来源）。

> 下一篇是专栏的最后一篇——三端部署与发布。Gateway 用 Docker Compose，Web 是静态文件 + CDN，Desktop 用 electron-builder 打包成三平台安装包。三者怎么协同发版？CI/CD 流水线怎么设计？
