/**
 * Langfuse 客户端单例 — 管理 Langfuse SDK 初始化和生命周期
 *
 * 配置来源（优先级从高到低）：
 * 1. catbuddy config 中的 langfuse 配置块
 * 2. 环境变量 LANGFUSE_PUBLIC_KEY / LANGFUSE_SECRET_KEY / LANGFUSE_BASE_URL
 */
import { Langfuse } from 'langfuse'
import type { LangfuseConfig } from '@catbuddy/shared'
import { logger } from '../utils/logger'

let _instance: LangfuseClient | null = null

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

export class LangfuseClient {
  private client: Langfuse | null = null
  private _enabled = false
  private _shuttingDown = false

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
      this.client = new Langfuse({
        publicKey: opts.publicKey,
        secretKey: opts.secretKey,
        baseUrl: opts.baseUrl || 'https://cloud.langfuse.com',
        flushAt: opts.flushAt ?? 10,
        flushInterval: opts.flushInterval ?? 5000,
      })
      this._enabled = true
      this._shuttingDown = false
      logger.info(`[langfuse] initialized, baseUrl=${opts.baseUrl || 'https://cloud.langfuse.com'}`)
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

  /** 创建新的 Trace */
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
      tags: params.tags,
      input: params.input,
    })
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
