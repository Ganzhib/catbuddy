/**
 * 多维代码审查 — 对当前改动从安全性、正确性、性能三个维度并行审查
 *
 * 使用方式: 在 Claude Code 中输入 "run workflow review-changes"
 */
export const meta = {
  name: 'review-changes',
  description: '对当前分支的改动进行安全/正确性/性能三维并行审查',
  phases: [
    { title: '获取改动', detail: 'git diff 获取变更文件列表' },
    { title: '三维审查', detail: '安全、正确性、性能并行审查' },
    { title: '综合报告', detail: '汇总审查结果' },
  ],
}

phase('获取改动')

const FILES = await agent(
  '运行 git diff origin/master --name-only 获取变更文件列表。只返回文件名，每行一个。',
  { label: '获取变更文件' }
)

const fileList = FILES.split('\n').filter(Boolean)

if (fileList.length === 0) {
  log('当前分支没有文件变更，跳过审查')
  return { files: [], findings: [] }
}

log(`变更文件数: ${fileList.length}`)

phase('三维审查')

const DIMENSIONS = [
  {
    key: 'security',
    prompt: `审查以下文件的**安全风险**:
${fileList.join('\n')}

重点关注:
- 路径遍历 (Path Traversal)
- SSRF / 未校验的 URL 请求
- 敏感信息泄露 (API Key、Token、密码硬编码)
- 命令注入 (exec/spawn 参数未清洗)
- WebSocket 未认证访问

每个发现输出: 文件、行号、风险级别(high/medium/low)、描述`,
    schema: {
      type: 'object',
      properties: {
        findings: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              file: { type: 'string' },
              line: { type: 'number' },
              severity: { type: 'string', enum: ['high', 'medium', 'low'] },
              description: { type: 'string' },
            },
            required: ['file', 'line', 'severity', 'description'],
          },
        },
      },
      required: ['findings'],
    },
  },
  {
    key: 'correctness',
    prompt: `审查以下文件的**正确性 bug**:
${fileList.join('\n')}

重点关注:
- 空值/undefined 访问
- 异步错误未捕获
- 类型断言 (as / !) 可能失败
- 边界条件 (空数组、空字符串、0、负数)
- Map/Set 的 key 冲突

每个发现输出: 文件、行号、严重级别、描述`,
    schema: {
      type: 'object',
      properties: {
        findings: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              file: { type: 'string' },
              line: { type: 'number' },
              severity: { type: 'string', enum: ['high', 'medium', 'low'] },
              description: { type: 'string' },
            },
            required: ['file', 'line', 'severity', 'description'],
          },
        },
      },
      required: ['findings'],
    },
  },
  {
    key: 'architecture',
    prompt: `审查以下文件是否符合项目的**架构规范**:
${fileList.join('\n')}

检查要点:
- 是否引入循环依赖 (workspace 包互相引用)
- 是否违反单一职责 (单个函数/类做了太多事)
- 是否在 packages/ui/ 中引用了 Electron 专用模块
- 新增类型是否在 @catbuddy/shared 中定义
- MessageRecord 等类型新增字段是否同步了所有层

每个发现输出: 文件、行号、严重级别、描述`,
    schema: {
      type: 'object',
      properties: {
        findings: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              file: { type: 'string' },
              line: { type: 'number' },
              severity: { type: 'string', enum: ['high', 'medium', 'low'] },
              description: { type: 'string' },
            },
            required: ['file', 'line', 'severity', 'description'],
          },
        },
      },
      required: ['findings'],
    },
  },
]

const results = await parallel(
  DIMENSIONS.map((d) => () =>
    agent(d.prompt, {
      label: `审查:${d.key}`,
      phase: '三维审查',
      schema: d.schema,
    })
  )
)

phase('综合报告')

const allFindings = results
  .filter(Boolean)
  .flatMap((r, i) =>
    (r.findings || []).map((f) => ({ ...f, dimension: DIMENSIONS[i].key }))
  )

const highCount = allFindings.filter((f) => f.severity === 'high').length
const mediumCount = allFindings.filter((f) => f.severity === 'medium').length
const lowCount = allFindings.filter((f) => f.severity === 'low').length

log(
  `审查完成: ${allFindings.length} 个发现 (${highCount}高/${mediumCount}中/${lowCount}低)`
)

return {
  files: fileList,
  summary: { total: allFindings.length, high: highCount, medium: mediumCount, low: lowCount },
  findings: allFindings,
}
