/**
 * 全量类型检查 — 并行对所有 workspace 包运行 tsc --noEmit
 *
 * 使用方式: 在 Claude Code 中输入 "run workflow type-check-all"
 */
export const meta = {
  name: 'type-check-all',
  description: '并行运行所有 workspace 包的类型检查',
  phases: [
    { title: '构建 shared', detail: '先构建 shared 包确保下游引用可用' },
    { title: '并行检查', detail: '所有包并行 tsc --noEmit' },
    { title: '汇总', detail: '收集所有错误并分类' },
  ],
}

phase('构建 shared')

await agent(
  '运行 pnpm --filter @catbuddy/shared build。如果失败，报告错误并停止。',
  { label: '构建shared' }
)

phase('并行检查')

// 所有需要检查的包
const PACKAGES = [
  { name: 'shared',         dir: 'packages/shared' },
  { name: 'client',         dir: 'packages/client' },
  { name: 'platform',       dir: 'packages/platform' },
  { name: 'ui',             dir: 'packages/ui' },
  { name: 'desktop',        dir: 'apps/desktop' },
  { name: 'web',            dir: 'apps/web' },
  { name: 'gateway',        dir: 'gateway' },
  { name: 'gateway-sdk',    dir: 'gateway/packages/gateway-sdk-desktop' },
]

const results = await parallel(
  PACKAGES.map((pkg) => () =>
    agent(
      `在 ${pkg.dir} 目录运行 npx tsc --noEmit。返回 JSON: { "package": "${pkg.name}", "success": true/false, "errors": ["错误信息..."] }。如果成功 errors 为空数组。`,
      {
        label: `检查:${pkg.name}`,
        phase: '并行检查',
        schema: {
          type: 'object',
          properties: {
            package: { type: 'string' },
            success: { type: 'boolean' },
            errors: { type: 'array', items: { type: 'string' } },
          },
          required: ['package', 'success', 'errors'],
        },
      }
    )
  )
)

phase('汇总')

const valid = results.filter(Boolean)
const failed = valid.filter((r) => !r.success)
const passed = valid.filter((r) => r.success)

log(`${passed.length}/${valid.length} 包通过，${failed.length} 失败`)

if (failed.length > 0) {
  log('失败包: ' + failed.map((f) => f.package).join(', '))
  for (const f of failed) {
    log(`\n--- ${f.package} ---`)
    for (const e of f.errors) {
      log(`  ${e}`)
    }
  }
}

return {
  total: PACKAGES.length,
  passed: passed.length,
  failed: failed.length,
  failures: failed.map((f) => ({ package: f.package, errors: f.errors })),
}
