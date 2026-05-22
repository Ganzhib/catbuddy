import { ConnectionType, AuthPayload, AuthResult, ErrorCode } from '@learnbuddy/gateway-common';
import { AuthError } from '@learnbuddy/gateway-common';

interface AuthConfig {
  secret: string;
  tokenExpiryMs: number;
}

/**
 * JWT 鉴权模块
 * 生产环境应使�?jsonwebtoken �? */
export class Authenticator {
  constructor(private config: AuthConfig) {}

  /** 验证连接 token */
  async authenticate(token: string, expectedType: ConnectionType): Promise<AuthResult> {
    try {
      // 简化的 JWT 验证（生产环境请�?jsonwebtoken 库）
      const payload = this.decodeToken(token);

      if (payload.exp * 1000 < Date.now()) {
        throw new AuthError(ErrorCode.AUTH_EXPIRED, 'Token expired');
      }

      if (payload.type !== expectedType) {
        throw new AuthError(ErrorCode.AUTH_INVALID, 'Token type mismatch');
      }

      return {
        ok: true,
        userId: payload.sub,
        sessionId: `sess_${payload.sub}_${Date.now()}`,
      };
    } catch (err) {
      if (err instanceof AuthError) {
        return { ok: false, error: err.message };
      }
      return { ok: false, error: 'Invalid token' };
    }
  }

  /** 生成 token（演示用�?*/
  generateToken(userId: string, type: ConnectionType): string {
    const payload: AuthPayload = {
      sub: userId,
      type,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor((Date.now() + this.config.tokenExpiryMs) / 1000),
    };
    // 简化：base64 编码（生产环境请�?jwt.sign�?    return Buffer.from(JSON.stringify(payload)).toString('base64');
  }

  /** 解码 token（演示用�?*/
  private decodeToken(token: string): AuthPayload {
    const json = Buffer.from(token, 'base64').toString('utf-8');
    return JSON.parse(json) as AuthPayload;
  }
}
