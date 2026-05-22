import { EventEmitter } from 'events';
import { ConnectionManager } from './connection-manager';
import { Connection, ConnectionStatus } from '@learnbuddy/gateway-common';

interface HeartbeatConfig {
  /** 检测间�?(ms) */
  interval: number;
  /** 超时阈�? 连续多少次心跳无响应视为超时 */
  maxMissed: number;
  /** 超时后的处理 */
  onTimeout: (sessionId: string) => Promise<void>;
}

export class HeartbeatMonitor extends EventEmitter {
  private timers = new Map<string, NodeJS.Timeout>();
  private missedCounts = new Map<string, number>();

  constructor(
    private connManager: ConnectionManager,
    private configs: {
      web: HeartbeatConfig;
      desktop: HeartbeatConfig;
    },
  ) {
    super();
  }

  /** 开始监测某个连�?*/
  start(sessionId: string): void {
    const conn = this.connManager.getBySession(sessionId);
    if (!conn) return;

    const config = this.configs[conn.type];
    const timer = setInterval(() => {
      this.check(sessionId, conn);
    }, config.interval);
    this.timers.set(sessionId, timer);
    this.missedCounts.set(sessionId, 0);
  }

  /** 收到心跳时调�?*/
  heartbeat(sessionId: string): void {
    this.connManager.updateHeartbeat(sessionId);
    this.missedCounts.set(sessionId, 0);

    const conn = this.connManager.getBySession(sessionId);
    if (conn && conn.status === 'idle') {
      this.connManager.updateStatus(sessionId, 'active');
    }
  }

  /** 停止监测 */
  stop(sessionId: string): void {
    const timer = this.timers.get(sessionId);
    if (timer) {
      clearInterval(timer);
      this.timers.delete(sessionId);
      this.missedCounts.delete(sessionId);
    }
  }

  /** 检查连�?*/
  private async check(sessionId: string, conn: Connection): Promise<void> {
    const config = this.configs[conn.type];
    const missed = (this.missedCounts.get(sessionId) ?? 0) + 1;
    this.missedCounts.set(sessionId, missed);

    if (missed >= config.maxMissed) {
      // 超时，执行回�?      await config.onTimeout(sessionId);
      this.stop(sessionId);
      this.emit('heartbeat:timeout', sessionId);
    } else {
      this.connManager.updateStatus(sessionId, 'idle');
      this.emit('heartbeat:missed', sessionId, missed);
    }
  }

  /** 停止所有监�?*/
  stopAll(): void {
    for (const [sessionId] of this.timers) {
      this.stop(sessionId);
    }
  }
}
