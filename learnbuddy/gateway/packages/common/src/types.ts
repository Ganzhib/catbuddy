// ===== 连接类型 =====

export type ConnectionType = 'web' | 'desktop';
export type ConnectionStatus = 'active' | 'idle' | 'reconnecting' | 'closed';

export interface Connection {
  id: string;
  userId: string;
  type: ConnectionType;
  status: ConnectionStatus;
  gatewayId: string;
  lastHeartbeat: number;
  metadata: Record<string, string>;
  send(frame: MessageFrame): Promise<void>;
  close(): Promise<void>;
}

export interface ConnectionStats {
  total: number;
  web: number;
  desktop: number;
  active: number;
  idle: number;
}

// ===== 消息帧 =====

export type MessageType = 'push' | 'ack' | 'ping' | 'pong' | 'auth';

export interface MessageFrame {
  type: MessageType;
  id: string;
  from: string;
  to: string;
  payload?: Record<string, unknown>;
  timestamp: number;
  ttl?: number;
}

export interface AckFrame extends MessageFrame {
  type: 'ack';
  ackMsgId: string;
  status: 'ok' | 'failed';
  error?: string;
}

// ===== 可靠投递 =====

export interface PendingMessage {
  msgId: string;
  targetId: string;
  frame: MessageFrame;
  retries: number;
  maxRetries: number;
  timestamp: number;
  nextRetryAt: number;
}

export type DeliverStatus = 'delivered' | 'pending' | 'failed' | 'offline_stored';

export interface DeliverResult {
  msgId: string;
  status: DeliverStatus;
  error?: string;
}

// ===== 鉴权 =====

export interface AuthPayload {
  sub: string;   // userId
  type: ConnectionType;
  iat: number;
  exp: number;
}

export interface AuthResult {
  ok: boolean;
  userId?: string;
  sessionId?: string;
  error?: string;
}

// ===== 错误码 =====

export enum ErrorCode {
  AUTH_EXPIRED = 'AUTH_EXPIRED',
  AUTH_INVALID = 'AUTH_INVALID',
  SESSION_NOT_FOUND = 'SESSION_NOT_FOUND',
  USER_OFFLINE = 'USER_OFFLINE',
  DELIVERY_TIMEOUT = 'DELIVERY_TIMEOUT',
  RATE_LIMITED = 'RATE_LIMITED',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
}
