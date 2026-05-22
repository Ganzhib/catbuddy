import { GatewayErrorCode } from './gateway-protocol.js'

export class GatewayError extends Error {
  constructor(
    public code: GatewayErrorCode,
    message: string,
    public statusCode: number = 400,
  ) {
    super(message)
    this.name = 'GatewayError'
  }
}

export class AuthError extends GatewayError {
  constructor(
    code: GatewayErrorCode.AUTH_EXPIRED | GatewayErrorCode.AUTH_INVALID,
    message: string,
  ) {
    super(code, message, 401)
    this.name = 'AuthError'
  }
}

export class DeliveryError extends GatewayError {
  constructor(public msgId: string, message: string) {
    super(GatewayErrorCode.DELIVERY_TIMEOUT, message, 408)
    this.name = 'DeliveryError'
  }
}
