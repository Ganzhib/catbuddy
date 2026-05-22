import { EventEmitter } from 'events';
import {
  MessageFrame,
  PendingMessage,
  DeliverResult,
  DeliverStatus,
  ErrorCode,
} from '@learnbuddy/shared';
import { createAck } from '@learnbuddy/shared';
import { backoffDelay } from '@learnbuddy/shared';
import { ConnectionManager } from './connection-manager';

interface DeliveryConfig {
  ackTimeout: number;        // 等待 ACK 超时 (ms)
  maxRetries: number;        // 最大重试次�?  retryBaseMs: number;       // 重试基础间隔
}

export class ReliableDelivery extends EventEmitter {
  private pending = new Map<string, PendingMessage>();
  private ackTimers = new Map<string, NodeJS.Timeout>();

  constructor(
    private connManager: ConnectionManager,
    private config: DeliveryConfig = {
      ackTimeout: 10_000,
      maxRetries: 3,
      retryBaseMs: 5_000,
    },
  ) {
    super();
  }

  /** 发送消息并等待确认 */
  async send(targetId: string, frame: MessageFrame): Promise<DeliverResult> {
    const pendingMsg: PendingMessage = {
      msgId: frame.id,
      targetId,
      frame,
      retries: 0,
      maxRetries: this.config.maxRetries,
      timestamp: Date.now(),
      nextRetryAt: 0,
    };

    this.pending.set(frame.id, pendingMsg);
    this.emit('delivery:pending', pendingMsg);

    return this.doDeliver(pendingMsg);
  }

  /** 处理 ACK */
  handleAck(ackFrame: MessageFrame): void {
    const ackMsgId = ackFrame.payload?.ackMsgId as string;
    if (!ackMsgId) return;

    const pending = this.pending.get(ackMsgId);
    if (!pending) return;

    // 取消重试定时�?    this.clearTimer(ackMsgId);
    this.pending.delete(ackMsgId);

    this.emit('delivery:acked', { msgId: ackMsgId, status: ackFrame.payload?.status });
  }

  /** 发送消�?*/
  private async doDeliver(pending: PendingMessage): Promise<DeliverResult> {
    const conn = this.connManager.getBySession(pending.targetId);

    if (!conn || conn.status === 'closed') {
      return this.handleOffline(pending);
    }

    try {
      await conn.send(pending.frame);

      // 启动 ACK 超时定时�?      this.startAckTimer(pending);

      return {
        msgId: pending.msgId,
        status: 'pending',
      };
    } catch (err) {
      return this.handleRetry(pending, err instanceof Error ? err.message : 'send_failed');
    }
  }

  /** 处理重试 */
  private async handleRetry(
    pending: PendingMessage,
    error: string,
  ): Promise<DeliverResult> {
    pending.retries++;

    if (pending.retries > pending.maxRetries) {
      return this.handleOffline(pending);
    }

    pending.nextRetryAt = Date.now() + backoffDelay(pending.retries, this.config.retryBaseMs);

    this.emit('delivery:retry', {
      msgId: pending.msgId,
      retryCount: pending.retries,
      nextRetryAt: pending.nextRetryAt,
    });

    // 设置重试定时�?    const delay = backoffDelay(pending.retries, this.config.retryBaseMs);
    const timer = setTimeout(() => {
      this.doDeliver(pending);
    }, delay);
    this.ackTimers.set(pending.msgId, timer);

    return {
      msgId: pending.msgId,
      status: 'pending',
      error,
    };
  }

  /** 处理离线 */
  private async handleOffline(pending: PendingMessage): Promise<DeliverResult> {
    this.pending.delete(pending.msgId);
    this.clearTimer(pending.msgId);

    this.emit('delivery:offline', pending);

    return {
      msgId: pending.msgId,
      status: 'offline_stored',
    };
  }

  /** 启动 ACK 超时定时�?*/
  private startAckTimer(pending: PendingMessage): void {
    const timer = setTimeout(() => {
      const msg = this.pending.get(pending.msgId);
      if (msg) {
        this.handleRetry(msg, 'ack_timeout');
      }
    }, this.config.ackTimeout);
    this.ackTimers.set(pending.msgId, timer);
  }

  private clearTimer(msgId: string): void {
    const timer = this.ackTimers.get(msgId);
    if (timer) {
      clearTimeout(timer);
      this.ackTimers.delete(msgId);
    }
  }

  /** 获取待确认消息数�?*/
  get pendingCount(): number {
    return this.pending.size;
  }
}
