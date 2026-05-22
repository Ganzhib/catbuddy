import WebSocket from 'ws';
import { MessageFrame, createMessageFrame } from '@learnbuddy/shared'

export interface DesktopClientConfig {
  url: string;              // wss://gateway.example.com/ws
  userId: string;
  token: string;
  heartbeatInterval?: number;  // 默认 60s
  reconnectBaseDelay?: number; // 重连基础间隔 (ms)
  maxReconnectDelay?: number;  // 最大重连间隔 (ms)
}

export type DesktopClientStatus = 
  | 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'auth_failed';

export class DesktopClient {
  private ws: WebSocket | null = null;
  private status: DesktopClientStatus = 'disconnected';
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private sessionId: string | null = null;

  constructor(private config: DesktopClientConfig) {
    // 默认配置
    config.heartbeatInterval ??= 60_000;
    config.reconnectBaseDelay ??= 2_000;
    config.maxReconnectDelay ??= 60_000;
  }

  /** 建立连接 */
  connect(): void {
    if (this.status === 'connecting' || this.status === 'connected') return;

    this.status = 'connecting';
    this.ws = new WebSocket(this.config.url, {
      headers: { 'x-client-type': 'desktop' },
    });

    this.ws.on('open', () => {
      this.authenticate();
    });

    this.ws.on('message', (data: Buffer) => {
      try {
        const frame = JSON.parse(data.toString()) as MessageFrame;
        this.handleFrame(frame);
      } catch { /* ignore */ }
    });

    this.ws.on('close', () => {
      this.status = 'disconnected';
      this.stopHeartbeat();
      this.scheduleReconnect();
    });

    this.ws.on('error', (err) => {
      console.error('[DesktopClient] WS error:', err.message);
      this.ws?.close();
    });
  }

  /** 发送消息 */
  send(to: string, payload?: Record<string, unknown>): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn('[DesktopClient] Cannot send: not connected');
      return;
    }
    const frame = createMessageFrame('push', this.config.userId, to, payload);
    this.ws.send(JSON.stringify(frame));
  }

  /** 断开连接 */
  disconnect(): void {
    this.status = 'disconnected';
    this.stopHeartbeat();
    this.clearReconnect();
    this.ws?.close();
    this.ws = null;
    this.sessionId = null;
  }

  /** 获取当前 sessionId */
  getSessionId(): string | null {
    return this.sessionId;
  }

  /** 获取连接状态 */
  getStatus(): DesktopClientStatus {
    return this.status;
  }

  /** 收到消息的回调 */
  onMessage: ((frame: MessageFrame) => void) | null = null;

  /** 连接状态变化回调 */
  onStatusChange: ((status: DesktopClientStatus) => void) | null = null;

  // ===== 私有方法 =====

  private authenticate(): void {
    const authFrame = createMessageFrame('auth', this.config.userId, 'gateway', {
      token: this.config.token,
    });
    this.ws!.send(JSON.stringify(authFrame));
  }

  private handleFrame(frame: MessageFrame): void {
    switch (frame.type) {
      case 'auth': {
        const payload = frame.payload as Record<string, unknown>;
        if (payload?.status === 'ok') {
          this.sessionId = payload.sessionId as string;
          this.status = 'connected';
          this.reconnectAttempts = 0;
          this.startHeartbeat();
          this.onStatusChange?.('connected');
        } else {
          this.status = 'auth_failed';
          this.onStatusChange?.('auth_failed');
          this.disconnect();
        }
        break;
      }
      case 'pong':
        break;
      case 'push':
        this.onMessage?.(frame);
        break;
    }
  }

  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        const ping = createMessageFrame('ping', this.config.userId, 'gateway');
        this.ws.send(JSON.stringify(ping));
      }
    }, this.config.heartbeatInterval);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private scheduleReconnect(): void {
    this.status = 'reconnecting';
    this.onStatusChange?.('reconnecting');

    const delay = Math.min(
      this.config.reconnectBaseDelay! * Math.pow(2, this.reconnectAttempts),
      this.config.maxReconnectDelay!,
    );

    this.reconnectTimer = setTimeout(() => {
      this.reconnectAttempts++;
      this.connect();
    }, delay);
  }

  private clearReconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }
}
