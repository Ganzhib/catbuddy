import { ErrorCode } from './types.js';

export class GatewayError extends Error {
  constructor(
    public code: ErrorCode,
    message: string,
    public statusCode: number = 400,
  ) {
    super(message);
    this.name = 'GatewayError';
  }
}

export class AuthError extends GatewayError {
  constructor(code: ErrorCode.AUTH_EXPIRED | ErrorCode.AUTH_INVALID, message: string) {
    super(code, message, 401);
    this.name = 'AuthError';
  }
}

export class DeliveryError extends GatewayError {
  constructor(public msgId: string, message: string) {
    super(ErrorCode.DELIVERY_TIMEOUT, message, 408);
    this.name = 'DeliveryError';
  }
}
