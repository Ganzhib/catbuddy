/**
 * Langfuse 客户端单例 — 管理 Langfuse SDK 初始化和生命周期
 *
 * 配置来源（优先级从高到低）：
 * 1. catbuddy config 中的 langfuse 配置块
 * 2. 环境变量 LANGFUSE_PUBLIC_KEY / LANGFUSE_SECRET_KEY / LANGFUSE_BASE_URL
 *
 * Langfuse Skill 最佳实践参考:
 * - https://github.com/langfuse/skills/blob/main/skills/langfuse/references/instrumentation.md
 */
import { Langfuse } from 'langfuse'
import type { LangfuseConfig } from '@catbuddy/shared'
import { logger } from '../utils/logger'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

let _instance: LangfuseClient | null = null

/** 从 package.json 读取应用版本（缓存） */
let _cachedVersion = ''

function getAppVersion(): string {
  if (_cachedVersion) return _cachedVersion
  try {
    // Electron 打包后使用 app.getVersion()，开发环境从 package.json 读取
    const pkgPath = resolve(__dirname, '../../package.json')
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'))
    _cachedVersion = typeof pkg.version === 'string' ? pkg.version : '0.0.0'
  } catch {
    _cachedVersion = '0.0.0'
  }
  return _cachedVersion
}

/** 当前运行环境 */
function getEnvironment(): string {
  const devMode = process.env.CATBUDDY_DEV_MODE?.trim()
  if (devMode === 'local' || devMode === 'remote') return devMode
  if (process.env.NODE_ENV === 'production') return 'production'
  return 'development'
}

export interface LangfuseInitOptions {
  enabled: boolean
  publicKey: string
  secretKey: string
  baseUrl: string
  /** 批量上报间隔（毫秒），默认 5000 */
  flushInterval?: number
  /** 批量上报阈值，默认 10 */
  flushAt?: number
}

export interface ScoreParams {
  traceId: string
  name: string
  value: number
  /** 可选评分数据类型: NUMERIC, BOOLEAN, CATEGORICAL */
  dataType?: 'NUMERIC' | 'BOOLEAN' | 'CATEGORICAL'
  comment?: string
}

export class LangfuseClient {
  private client: Langfuse | null = null
  private _enabled = false
  private _shuttingDown = false
  /** 存储初始化选项，用于 REST API 调用（如 Scores） */
  private _opts: LangfuseInitOptions | null = null

  /** 应用版本（用于 trace 标签） */
  readonly version = getAppVersion()
  /** 运行环境（用于 trace 标签） */
  readonly environment = getEnvironment()

  get enabled(): boolean {
    return this._enabled && this.client !== null
  }

  get raw(): Langfuse | null {
    return this.client
  }

  initialize(opts: LangfuseInitOptions): void {
    if (this.client) {
      logger.info('[langfuse] already initialized, shutting down previous instance')
      this.shutdown()
    }

    if (!opts.enabled) {
      logger.info('[langfuse] disabled by config')
      this._enabled = false
      return
    }

    if (!opts.publicKey || !opts.secretKey) {
      console.warn('[langfuse] missing publicKey or secretKey, tracing disabled')
      this._enabled = false
      return
    }

    try {
      this._opts = { ...opts }
      this.client = new Langfuse({
        publicKey: opts.publicKey,
        secretKey: opts.secretKey,
        baseUrl: opts.baseUrl || 'https://cloud.langfuse.com',
        flushAt: opts.flushAt ?? 10,
        flushInterval: opts.flushInterval ?? 5000,
        // 注意: 不自设 release 参数
        // v3.38.20 SDK 不自带该字段，自托管 v3 服务端 protobuf schema 亦不支持
        // 版本信息通过 tags + metadata 追踪即可
      })
      this._enabled = true
      this._shuttingDown = false
      logger.info(
        `[langfuse] initialized v${this.version} env=${this.environment} ` +
        `baseUrl=${opts.baseUrl || 'https://cloud.langfuse.com'}`
      )
    } catch (err: any) {
      logger.error(`[langfuse] initialization failed: ${err.message}`)
      this._enabled = false
    }
  }

  /** 从 catbuddy 配置和环境变量构建初始化选项 */
  static buildOptions(config?: LangfuseConfig): LangfuseInitOptions {
    const envEnabled = process.env.LANGFUSE_ENABLED?.toLowerCase()
    const enabled =
      config?.enabled ??
      (envEnabled === 'true' || envEnabled === '1') ??
      false

    return {
      enabled,
      publicKey: config?.publicKey?.trim() || process.env.LANGFUSE_PUBLIC_KEY?.trim() || '',
      secretKey: config?.secretKey?.trim() || process.env.LANGFUSE_SECRET_KEY?.trim() || '',
      baseUrl: config?.baseUrl?.trim() || process.env.LANGFUSE_BASE_URL?.trim() || 'https://cloud.langfuse.com',
      flushAt: config?.flushAt ?? 10,
      flushInterval: config?.flushInterval ?? 5000,
    }
  }

  /** 创建新的 Trace（自动注入 version / environment 标签） */
  createTrace(params: {
    name: string
    userId?: string
    sessionId?: string
    metadata?: Record<string, any>
    tags?: string[]
    input?: any
  }) {
    if (!this.client) return null
    return this.client.trace({
      name: params.name,
      userId: params.userId,
      sessionId: params.sessionId,
      metadata: params.metadata,
      tags: [
        ...(params.tags ?? []),
        `env:${this.environment}`,
        `v:${this.version}`,
      ],
      input: maskSensitiveData(params.input),
    })
  }

  /** 创建错误 Trace（用于未被 agent hook 覆盖的错误场景） */
  createErrorTrace(params: {
    name: string
    sessionId?: string
    error: string
    metadata?: Record<string, any>
  }) {
    if (!this.client) return null
    const trace = this.client.trace({
      name: `error:${params.name}`,
      sessionId: params.sessionId,
      tags: ['error', `env:${this.environment}`, `v:${this.version}`],
      metadata: { ...params.metadata, error: true },
      input: maskSensitiveData(params.error),
    })
    // 通过 metadata.error 标记错误（自托管 v3 服务端不支持 level 字段）
    if (trace) {
      ;(trace as any).update({ output: params.error })
    }
    return trace
  }

  /** 为 Trace 创建 Score（用于评估和质量追踪）
   *
   * Langfuse Skill 最佳实践:
   * - 工具成功率、用户反馈、延迟分布都应通过 Score 追踪
   * - Score 值: NUMERIC(0-1) / BOOLEAN / CATEGORICAL
   * - v3 SDK 无 score() 方法，通过 REST API 创建
   * - 了解更多: https://langfuse.com/docs/scores/overview
   */
  async createScore(params: ScoreParams): Promise<void> {
    if (!this._opts) return
    const { publicKey, secretKey, baseUrl } = this._opts
    if (!publicKey || !secretKey) return

    try {
      const auth = Buffer.from(`${publicKey}:${secretKey}`).toString('base64')
      const url = `${baseUrl}/api/public/scores`
      await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          traceId: params.traceId,
          name: params.name,
          value: params.value,
          dataType: params.dataType ?? 'NUMERIC',
          comment: params.comment,
        }),
      })
    } catch (err: any) {
      console.warn(`[langfuse] score creation failed: ${err.message}`)
    }
  }

  /** 确保缓冲数据上报 */
  async flush(): Promise<void> {
    if (!this.client) return
    try {
      await this.client.flushAsync()
    } catch (err: any) {
      console.warn(`[langfuse] flush error: ${err.message}`)
    }
  }

  /** 关闭 SDK，flush 剩余数据 */
  async shutdown(): Promise<void> {
    if (this._shuttingDown || !this.client) return
    this._shuttingDown = true
    try {
      logger.info('[langfuse] shutting down...')
      await this.client.shutdownAsync()
    } catch (err: any) {
      console.warn(`[langfuse] shutdown error: ${err.message}`)
    } finally {
      this.client = null
      this._enabled = false
      this._shuttingDown = false
    }
  }

  /** 重置实例（用于测试或热重载配置） */
  async reset(): Promise<void> {
    await this.shutdown()
    _instance = null
  }
}

/** 获取全局单例 */
export function getLangfuseClient(): LangfuseClient {
  if (!_instance) {
    _instance = new LangfuseClient()
  }
  return _instance
}

/**
 * 敏感数据遮蔽（PII / Secret 脱敏）
 *
 * Langfuse Skill 最佳实践:
 * "Never record PII or secrets in trace data"
 * 参考: https://langfuse.com/docs/security/data-masking
 */
const SENSITIVE_KEY_PATTERNS = [
  /(api[_-]?key|apikey|secret|password|token|auth|credential|private[_-]?key|access[_-]?key)/i,
]

const SENSITIVE_VALUE_PATTERNS = [
  // sk- / pk- 开头的 API key
  /sk-[a-zA-Z0-9_-]{20,}/g,
  /pk-[a-zA-Z0-9_-]{20,}/g,
  // JWT tokens
  /eyJ[a-zA-Z0-9_-]{30,}\.[a-zA-Z0-9_-]{30,}\.[a-zA-Z0-9_-]{10,}/g,
  // AWS Access Key ID (AKIA* — 20-char 大写字母数字)
  /AKIA[0-9A-Z]{16}/g,
  // GitHub tokens (ghp_, gho_, ghu_, ghs_, github_pat_)
  /gh[pous]_[A-Za-z0-9_]{36,}/g,
  /github_pat_[A-Za-z0-9_]{22,}/g,
  // Authorization: Bearer tokens
  /Bearer\s+([A-Za-z0-9_\-\.=]{20,})/gi,
  /x-api-key\s*[:=]\s*[A-Za-z0-9_\-]{16,}/gi,
  // 常见 secret 格式
  /(secret|password|token)=[^&\s]{8,}/gi,
]

/**
 * 估算 LLM 调用成本（USD）
 *
 * Langfuse Skill 最佳实践:
 * - 对于 Langfuse 定价表已知的模型，使用精确名称让 Dashboard 自动计算
 * - 对于自定义/本地模型，通过 generation.costDetails 手动附加成本
 * - 参考: https://langfuse.com/docs/model-usage-and-cost
 *
 * 定价参考（每 1M tokens, USD）:
 * - deepseek-chat:    input $0.14  output $0.28
 * - deepseek-reasoner: input $0.55  output $2.19
 * - gpt-4o:           input $2.50  output $10.00
 * - gpt-4o-mini:      input $0.15  output $0.60
 * - claude-sonnet-4:  input $3.00  output $15.00
 * - claude-haiku-4:   input $0.80  output $4.00
 */
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  'deepseek-chat': { input: 0.14, output: 0.28 },
  'deepseek-reasoner': { input: 0.55, output: 2.19 },
  'deepseek-v3': { input: 0.14, output: 0.28 },
  'deepseek-r1': { input: 0.55, output: 2.19 },
  'gpt-4o': { input: 2.50, output: 10.00 },
  'gpt-4o-mini': { input: 0.15, output: 0.60 },
  'gpt-4-turbo': { input: 10.00, output: 30.00 },
  'claude-sonnet-4-20250514': { input: 3.00, output: 15.00 },
  'claude-haiku-4-5-20251001': { input: 0.80, output: 4.00 },
  'claude-opus-4-20250514': { input: 15.00, output: 75.00 },
}

export interface CostEstimate {
  inputCost: number
  outputCost: number
  totalCost: number
  /** 是否为估算值（非精确定价表匹配） */
  estimated: boolean
}

export function estimateCost(
  model: string,
  inputTokens: number,
  outputTokens: number,
): CostEstimate {
  const pricing = MODEL_PRICING[model]
  if (pricing) {
    const inputCost = (inputTokens / 1_000_000) * pricing.input
    const outputCost = (outputTokens / 1_000_000) * pricing.output
    return {
      inputCost: Math.round(inputCost * 1e6) / 1e6,
      outputCost: Math.round(outputCost * 1e6) / 1e6,
      totalCost: Math.round((inputCost + outputCost) * 1e6) / 1e6,
      estimated: false,
    }
  }
  // 未知模型的粗略估算（$0.50/$2.00 每 1M tokens）
  const inputCost = (inputTokens / 1_000_000) * 0.50
  const outputCost = (outputTokens / 1_000_000) * 2.00
  return {
    inputCost: Math.round(inputCost * 1e6) / 1e6,
    outputCost: Math.round(outputCost * 1e6) / 1e6,
    totalCost: Math.round((inputCost + outputCost) * 1e6) / 1e6,
    estimated: true,
  }
}

export function maskSensitiveData(input: any): any {
  if (input === null || input === undefined) return input

  if (typeof input === 'string') {
    let masked = input
    for (const pattern of SENSITIVE_VALUE_PATTERNS) {
      masked = masked.replace(pattern, (match: string) => {
        if (match.length <= 8) return '***'
        return match.slice(0, 3) + '***' + match.slice(-3)
      })
    }
    return masked
  }

  if (Array.isArray(input)) {
    return input.map(maskSensitiveData)
  }

  if (typeof input === 'object') {
    const sanitized: Record<string, any> = {}
    for (const [key, value] of Object.entries(input)) {
      if (SENSITIVE_KEY_PATTERNS.some((p) => p.test(key))) {
        sanitized[key] = '[REDACTED]'
      } else {
        sanitized[key] = maskSensitiveData(value)
      }
    }
    return sanitized
  }

  return input
}
