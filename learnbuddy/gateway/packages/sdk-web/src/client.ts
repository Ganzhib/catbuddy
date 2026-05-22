import {
  type MessageFrame,
  type GatewayConnectionType as ConnectionType,
  createMessageFrame,
} from '@learnbuddy/shared'

export interface WebClientConfig {
  url: string;
  userId: string;
  token: string;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
}

export type WebClientStatus = 'disconnected' | 'connecting' | 'connected' | 'reconnecting';

export class WebSocketClient {
  private ws: WebSocket | null = null;
  private status: WebClientStatus = 'disconnected';
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;

  constructor(private config: WebClientConfig) {}

  /** 连接 */
  connect(): void {
    if (this.status === 'connecting' || this.status === 'connected') return;

    this.status = 'connecting';
    this.ws = new WebSocket(this.config.url);

    this.ws.onopen = () => {
      this.status = 'connected';
      this.reconnectAttempts = 0;
      this.authenticate();
      this.startPing();
    };

    this.ws.onclose = () => {
      this.status = 'disconnected';
      this.stopPing();
      this.scheduleReconnect();
    };

    this.ws.onerror = () => {
      this.ws?.close();
    };

    this.ws.onmessage = (event) => {
      try {
        const frame = JSON.parse(event.data) as MessageFrame;
        this.handleFrame(frame);
      } catch { /* ignore malformed frames */ }
    };
  }

  /** 发送消息 */
  send(to: string, payload?: Record<string, unknown>): void {
    if (this.status !== 'connected' || !this.ws) {
      console.warn('Cannot send: not connected');
      return;
    }
    const frame = createMessageFrame('push', this.config.userId, to, payload);
    this.ws.send(JSON.stringify(frame));
  }

  /** 断开连接 */
  disconnect(): void {
    this.stopPing();
    this.clearReconnect();
    this.ws?.close();
    this.ws = null;
    this.status = 'disconnected';
  }

  private authenticate(): void {
    if (!this.ws) return;
    const authFrame = createMessageFrame('auth', this.config.userId, 'gateway', {
      token: this.config.token,
    });
    this.ws.send(JSON.stringify(authFrame));
  }

  private handleFrame(frame: MessageFrame): void {
    switch (frame.type) {
      case 'pong':
        // 心跳回复，不用处理
        break;
      case 'ack':
        // 消息确认
        break;
      case 'push':
        this.onMessage?.(frame);
        break;
    }
  }

  private startPing(): void {
    this.pingTimer = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        const ping = createMessageFrame('ping', this.config.userId, 'gateway');
        this.ws.send(JSON.stringify(ping));
      }
    }, 30_000);
  }

  private stopPing(): void {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= (this.config.maxReconnectAttempts ?? 10)) return;

    this.status = 'reconnecting';
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30_000);
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

  /** 收到消息的回调 */
  onMessage: ((frame: MessageFrame) => void) | null = null;

  get connectionStatus(): WebClientStatus {
    return this.status;
  }
}
