import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Query,
  Res,
} from '@nestjs/common'
import type { Response } from 'express'
import { randomBytes } from 'node:crypto'
import { AuthService } from '../auth/auth.service'
import { gatewayEnv } from '../config/env'
import { GatewayStateService } from './gateway-state.service'

const SETTINGS_STUB = {
  agent: {
    model: 'desktop',
    provider: 'gateway',
    resolved_provider: 'gateway',
    has_api_key: true,
  },
  providers: [],
  web_search: { provider: 'none', providers: [] },
  runtime: { config_path: '(learnbuddy gateway — desktop executor)' },
  requires_restart: false,
}

@Controller()
export class GatewayShimController {
  constructor(
    private readonly state: GatewayStateService,
    private readonly auth: AuthService,
  ) {
    this.auth.ensureDevViewerRegistered()
  }

  @Get('webui/bootstrap')
  async bootstrap(
    @Query('secret') secret: string | undefined,
    @Headers('authorization') authorization?: string,
  ) {
    const token = await this.auth.resolveBootstrapToken(authorization, secret)
    return this.bootstrapPayload(token)
  }

  private bootstrapPayload(token: string) {
    const ex = this.state.countExecutors()
    return {
      token,
      ws_path: gatewayEnv.publicWsPath,
      expires_in: 86_400,
      model_name: null,
      gateway_mode: 'gateway' as const,
      executor_online: ex.online > 0,
    }
  }

  @Get('api/sessions')
  async listSessions(@Headers('authorization') authorization?: string) {
    await this.auth.resolveViewerToken(authorization)
    return this.state.fetchSessionsFromExecutor()
  }

  /** Web 新建对话 → 通知桌面 executor 创建 JSONL 会话并订阅 relay。 */
  @Post('api/sessions')
  async createSession(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: { chatId?: string },
    @Res() res: Response,
  ) {
    await this.auth.resolveViewerToken(authorization)
    const raw = String(body.chatId || '').trim()
    const bare = raw.startsWith('desktop:') ? raw.slice('desktop:'.length) : raw
    const chatId = bare || `${Date.now()}_${randomBytes(3).toString('hex')}`
    const sessionKey = `desktop:${chatId}`
    const result = this.state.forwardCreateSessionToExecutor(
      sessionKey,
      chatId,
    )
    if (!result.ok) {
      return res.status(503).json({ ok: false, error: result.error })
    }
    const now = new Date().toISOString()
    return res.status(201).json({
      key: sessionKey,
      channel: 'desktop',
      chatId,
      createdAt: now,
      updatedAt: now,
      title: '',
      preview: '',
    })
  }

  @Get('api/webui-thread')
  async webuiThread(
    @Query('key') key: string | undefined,
    @Headers('authorization') authorization?: string,
  ) {
    await this.auth.resolveViewerToken(authorization)
    const sessionKey = decodeURIComponent(String(key || '').trim())
    if (!sessionKey) return null
    return this.state.fetchThreadFromExecutor(sessionKey)
  }

  @Delete('api/sessions/:sessionKey')
  async deleteSession(
    @Headers('authorization') authorization?: string,
  ) {
    await this.auth.resolveViewerToken(authorization)
    return { ok: true }
  }

  @Get('api/settings')
  async settings(@Headers('authorization') authorization?: string) {
    await this.auth.resolveViewerToken(authorization)
    return SETTINGS_STUB
  }

  @Post('api/settings/update')
  async updateSettings(@Headers('authorization') authorization?: string) {
    await this.auth.resolveViewerToken(authorization)
    return SETTINGS_STUB
  }

  @Post('api/settings/provider/update')
  async updateProvider(@Headers('authorization') authorization?: string) {
    await this.auth.resolveViewerToken(authorization)
    return SETTINGS_STUB
  }

  @Post('api/settings/web-search/update')
  async updateWebSearch(@Headers('authorization') authorization?: string) {
    await this.auth.resolveViewerToken(authorization)
    return SETTINGS_STUB
  }

  @Get('api/commands')
  async commands(@Headers('authorization') authorization?: string) {
    await this.auth.resolveViewerToken(authorization)
    return []
  }
}
