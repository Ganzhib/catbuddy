# 05｜Agent Loop：两个循环驱动整个大脑

> 这是 CatBuddy 技术专栏的第 5 篇。上篇讲了 Agent 内容引擎的四重身份——状态机（大脑）、工具执行器（手脚）、技能系统（技能包）、记忆系统。这篇深入第一重：大脑是怎么转的。

---

你有没有遇到过这种情况：打开一个号称支持"多轮工具调用"的 AI 项目，发现它的核心循环就是一个 `while(true)` 里面套了几个 `if/else`？我第一次看到 CatBuddy 的 Agent Loop 代码之前，也是这么预期的——无非是"用户发消息，调 LLM，LLM 要工具就执行，然后继续"。

但 CatBuddy 的 Agent 引擎不是一层循环，是**两层**。

外层：状态机（AgentLoop），管"一个用户请求从进来到出去"的完整生命周期。
内层：Runner（AgentRunner），管"LLM 和工具之间的反复拉扯"。

两层各司其职，互相不知道对方的存在。这个设计救了我很多次——每次加新功能，只需要改其中一层，另一层纹丝不动。

---

## 5.1 为什么一层循环不够？

先看一个场景。

你发了条消息："帮我重构 src/utils/helper.ts 这个文件，把里面的函数拆到不同模块"。

Agent 收到后：
1. 先读文件，理解当前结构
2. 调用 LLM，"这个文件怎么拆？"
3. LLM 回复："应该拆成 date.ts、string.ts、format.ts"
4. Agent 执行：创建三个新文件，修改 helper.ts 的导出，检查有没有其他地方引用了旧路径
5. 再调 LLM，"拆完了，检查一下有没有遗漏？"
6. LLM 说："git.ts 里还引用了 helper.ts 的旧路径"
7. Agent 修改 git.ts
8. 再调 LLM 确认……

这个过程中，LLM 和工具来回调了 **4 轮**。但用户的请求只有一个。

如果只有一层循环，你的代码会变成什么样？大概是：

```
发消息 → 调LLM → 执行工具 → 调LLM → 执行工具 → 调LLM → 保存 → 返回
```

看起来没问题，对吧？但等等：**用户点"取消"的时候怎么办？** 状态机在"调 LLM"，你得等它返回才能处理取消。**上下文超长需要压缩的时候怎么办？** 你得在执行工具的中途插入一段"先压缩历史再继续"的逻辑。**一条 `/help` 命令根本不需要调 LLM，怎么跳过？**

一层循环的问题不是"跑不起来"，而是**所有逻辑混在一起——每当你要加一个新的生命周期节点，就得在同一个循环里打补丁**。

CatBuddy 的做法是：把"用户请求的生命周期"和"LLM-工具的交互循环"拆成两层。

---

## 5.2 外层状态机：8 个状态，一条单向流水线

AgentLoop 管理的是**一个 turn** 的完整生命周期——从用户消息进入，到最终结果返回。这个生命周期被切成了 8 个状态：

```
 RESTORE → COMPACT → COMMAND → BUILD → RUN → SAVE → RESPOND → DONE
```

每个状态只做一件事，做完后返回一个事件名，状态机查表跳到下一个状态。没有循环，没有回退。

```typescript
// 核心循环 —— 就这么简单
while (turn.state !== State.DONE) {
  const event = await this._processState(turn);
  const next = TRANSITIONS[turn.state]?.[event];
  if (!next) throw new Error(`No transition for ${turn.state} + ${event}`);
  turn.state = next;
}
```

这 8 个状态各干了什么？

| 状态 | 职责 | 一句话 |
|------|------|--------|
| **RESTORE** | 恢复或创建 session | "这次对话是新开的还是接着上次的？" |
| **COMPACT** | 上下文压缩 | "历史消息太长了，先整理一下" |
| **COMMAND** | 命令路由 | "用户发的是 `/help` 还是普通消息？" |
| **BUILD** | 拼装 LLM 上下文 | "把 system prompt + 历史 + 用户消息拼好" |
| **RUN** | 执行 LLM+Tool 循环 | "开始真正干活" |
| **SAVE** | 持久化 | "把本轮结果存到磁盘" |
| **RESPOND** | 组装回复 | "按什么格式返回给 UI" |
| **DONE** | 终止 | "收工" |

你可能注意到了——**COMPACT、COMMAND 这些状态在简单的 Agent 实现里根本不存在**。但它们是真实场景下的刚需：

- **COMPACT**：你跟 Agent 聊了 200 轮，上下文窗口早就爆了。AgentLoop 在每次处理前检查 token 预算，超了就触发压缩——把旧消息摘要化。
- **COMMAND**：用户发 `/help` 不需要调 LLM，直接返回帮助文本，跳过 BUILD→RUN→SAVE→RESPOND，直接到 DONE。状态机让这种"快捷路径"非常清晰。

这就是状态机优于一层循环的地方：**每个生命周期节点都有独立的入口和出口，你往中间插入一个新状态，不影响前后**。

---

## 5.3 内层循环：AgentRunner 怎么跟 LLM 反复拉扯

RUN 状态内部才是真正精彩的地方。当你进入 RUN 状态，AgentLoop 把控制权交给 `AgentRunner.run()`，跑一个内层循环：

```
┌─────────────────────────────────────────────────┐
│  for (迭代 0, 1, 2, ... 最多 maxIterations)        │
│                                                   │
│  ① 上下文治理                                       │
│     - 删掉孤立的 tool 结果                          │
│     - 给没结果的 tool_call 补上错误信息               │
│     - 旧 tool 结果 → 摘要（微压缩）                   │
│     - Token 预算截断                                │
│                                                   │
│  ② 调用 LLM（流式）                                 │
│     - content delta → 推送到 UI                     │
│     - thinking delta → 推送到 UI（DeepSeek 推理）     │
│                                                   │
│  ③ 检查取消信号                                      │
│     "用户点了取消？" → 返回已生成的内容                 │
│                                                   │
│  ④ LLM 要调工具？                                   │
│     - Preflight 校验参数                            │
│     - 逐个执行工具                                    │
│     - 结果截断（最长 maxToolResultChars）             │
│     - 注入 assistant 消息 + tool 结果               │
│     - continue → 下一轮迭代                          │
│                                                   │
│  ⑤ LLM 说完了？                                     │
│     - 空回复重试（最多 2 次）                          │
│     - max_tokens 截断恢复（最多 3 次）                 │
│     - finalContent = 内容 → break                   │
└─────────────────────────────────────────────────┘
```

这个内层循环解决了一个核心问题：**LLM 的回复不可预测**。你可能调一次 LLM 它就回答完了，也可能连续调 8 次——因为它每次都说"我还需要看看这个文件"。Runner 不关心几轮结束，它只管循环，直到 LLM 不再要工具。

### 上下文治理：每次迭代之前先"打扫房间"

Runner 在每次调 LLM 之前，会先做四件事：

1. **删掉孤立的 tool 结果**：如果历史消息里有一个 tool 结果，但找不到对应的 tool_call 请求，说明是脏数据，直接删掉。
2. **补上缺失的 tool 结果**：反过来，如果有 tool_call 但没结果（可能是上次崩溃中断了），补一条 `{ error: "Tool result lost" }`。否则 LLM 拿到不完整的历史会懵。
3. **微压缩**：如果你的工具调用结果超过 10 条（比如连续读了 15 个文件），Runner 会把旧的工具结果替换成摘要。不是"删掉"，而是"压缩"。LLM 仍然知道"我们读过这些文件"，但不占用完整 token。
4. **Token 预算截断**：如果以上三步做完还是超预算，Runner 从最早的消息开始删，保证当前 user 消息不被截断。

这四步是典型的**防御性工程**——它们处理的都是"理论上不该发生但实际上经常发生的边界情况"。不处理好这些，Agent 跑不了几轮就会因为上下文爆炸或数据不一致挂掉。

### Preflight：在工具执行前多看一眼

有个细节值得单独讲。当 LLM 说"我要调用 `display_diagram`"的时候，Runner 不会直接执行。它会先跑一个 preflight 校验：

```typescript
// 检查 tool 参数格式，比如 display_diagram 需要 diagram_type 字段
const error = toolCallPreflightError(toolCall);
if (error) {
  // 不执行工具，直接注入错误消息，让 LLM 自己修正
  results.push({ error });
}
```

这个设计很聪明——把参数校验的负担从工具实现转移到了调用前。工具本身不需要管参数对不对，它假设进来的参数都是合法的。如果不对，Runner 在调用前就拦住，告诉 LLM "你参数不对，重来"，而不是执行到一半报个运行时错误。

---

## 5.4 多 Provider 适配：三个 API，一套接口

Agent 要支持 Anthropic、OpenAI、DeepSeek 三家 LLM。但它们的 API 差异巨大：

| 差异点 | Anthropic | OpenAI | DeepSeek |
|--------|-----------|--------|----------|
| system prompt | 顶级参数，不是消息 | 消息数组里的 `role:system` | 同 OpenAI |
| tool_use 格式 | content block 数组 | `tool_calls` 数组 | 同 OpenAI |
| tool_result | 必须包在 `role:user` 里 | 直接 `role:tool` | 同 OpenAI |
| streaming | `stream.on('text')` | `delta.tool_calls` 分片拼接 | 同 OpenAI |
| 推理内容 | 无 | 无 | `delta.reasoning_content` |

CatBuddy 的做法：**不是写三个完全独立的 Provider，而是抽象出共性，只在必要处做适配**。

基类 `LLMProvider` 提供了：
- 统一的重试逻辑（3 次，指数退避 1/2/4 秒）
- 错误分类（429、5xx、超时可重试，4xx 不重试）
- `enforceRoleAlternation()`：OpenAI 要求 user/assistant 必须交替出现，基类自动合并连续的 user 消息

然后 `AnthropicProvider` 和 `OpenAICompatProvider`（OpenAI/DeepSeek/Ollama 共用）各自实现 `chatStream()`。

**DeepSeek 最麻烦的地方**：DeepSeek 的推理内容（`reasoning_content`）在 tool-call 轮次中必须**往返**——assistant 消息要带着 reasoning_content，tool 结果回来后，下一条 assistant 消息也要能引用之前的推理。如果丢了，DeepSeek 会"忘记"自己为什么调用那个工具。

CatBuddy 的做法是在 SAVE 阶段把 `reasoningContent` 持久化到消息上，下次 BUILD 时再取出。这个坑我们团队调了整整一个下午才定位到——"为什么切换到 DeepSeek 之后，连续工具调用的第二轮就开始胡说？"

---

## 5.5 Fallback：主模型挂了怎么办？

CatBuddy 还支持 Fallback 链——当你配置的主模型（比如 Claude）挂了或超时了，自动切到备选模型。

```typescript
// FallbackProvider 是一个装饰器
class FallbackProvider extends LLMProvider {
  async chatStream(opts) {
    // 先试 primary
    // 如果 finishReason === 'error' 或 throw → 试 fallback[0]
    // 再失败 → 试 fallback[1]
    // 全失败 → 返回统一错误消息
  }
}
```

这个设计在整个系统里几乎"无感"——AgentRunner 不需要知道调的是主模型还是备选模型，它拿到的都是同一个 `LLMProvider` 接口。唯一的变化是日志里会多一条 `[fallback] Switched to fallback #1`。

---

## 如果重来一次

状态机设计确实有点"过度工程化"的嫌疑。8 个状态中，RESTORE 和 RESPOND 其实可以合并，COMPACT 也可以内嵌到 BUILD 里。如果一开始就设计一个 5 状态的简化版本，开发效率可能更高。

但我不后悔加 COMMAND 状态。它让我们后续加了十几个 `/` 命令（`/help`、`/clear`、`/model`、`/export`……），每个都是一行映射——完全不用碰 AgentRunner 或 LLM 调用逻辑。这种"提前为扩展预留入口"的设计，在后期疯狂加需求阶段证明了它的价值。

---

> **这篇讲了什么？**
>
> 1. Agent 引擎是**两层循环**：外层状态机管一个请求的生命周期，内层 Runner 管 LLM 和工具的反复拉扯。分离后各管各的，加新功能只改一层。
> 2. AgentRunner 在每次调 LLM 前做**上下文治理**——清理脏数据、补缺失结果、微压缩旧内容、token 预算截断。这些防御性工程决定了 Agent 能跑 10 轮还是 100 轮。
> 3. 多 Provider 适配的关键是**找到共性而不是各自实现**——基类统一重试和 role 交替，子类只处理 API 差异。DeepSeek 的 reasoning_content 往返是最隐蔽的坑。

> 下一篇聊 MCP——Agent 有了大脑，还需要手脚。MCP 协议怎么让 Agent 读文件、跑命令、操作浏览器？为什么选 MCP 而不是自己定义一套工具接口？
