import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Res,
} from '@nestjs/common'
import type { Response } from 'express'
import { AuthService } from '../auth/auth.service'
import { GatewayStateService } from './gateway-state.service'

@Controller()
export class GatewayRelayController {
  constructor(
    private readonly state: GatewayStateService,
    private readonly auth: AuthService,
  ) {}

  @Get('health')
  health() {
    const ex = this.state.countExecutors()
    return {
      ok: true,
      gateway: true,
      gateway_shim: true,
      executors: ex.total,
      online: ex.online > 0,
      executor_online: ex.online > 0,
      storage: 'jsonl',
    }
  }

  @Post('api/pair')
  pair(@Body() body: { pairingCode?: string; token?: string }) {
    const pairingCode = String(body.pairingCode || '').trim()
    const token = String(body.token || '').trim()
    if (!pairingCode || !token) {
      return { ok: false, error: 'missing_fields' }
    }
    return this.state.pairViewer(pairingCode, token)
  }

  @Post('api/sessions/:sessionKey/messages')
  async sendMessage(
    @Param('sessionKey') sessionKeyRaw: string,
    @Headers('authorization') authorization: string | undefined,
    @Body() body: { content?: string; media?: unknown[] },
    @Res() res: Response,
  ) {
    const token = await this.auth.resolveViewerToken(authorization)
    const sessionKey = decodeURIComponent(sessionKeyRaw)
    const content = String(body.content || '')
    if (!content.trim()) {
      return res.status(400).json({ ok: false, error: 'empty_content' })
    }
    this.state.ensureViewerSubscribedForToken(token, sessionKey)
    const chatId = this.state.chatIdFromSessionKey(sessionKey)
    const result = this.state.handleWebInbound(
      sessionKey,
      chatId,
      content,
      body.media,
      'web',
    )
    const status = result.ok ? 200 : 503
    return res.status(status).json(result)
  }
}
