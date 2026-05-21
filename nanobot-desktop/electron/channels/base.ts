/**
 * BaseChannel — 通道抽象接口
 *
 * 每个通道（WebUI、WhatsApp、Desktop Notification）实现此接口。
 * 参考 nanobot/channels/base.py
 */
import type { OutboundMessage } from "../../shared/types";

export interface BaseChannel {
  readonly name: string;
  readonly displayName: string;

  /** 启动通道（如监听 IPC 事件、连接 WhatsApp） */
  start(): Promise<void>;

  /** 停止通道 */
  stop(): Promise<void>;

  /** 发送完整消息（非流式） */
  send(msg: OutboundMessage): Promise<void>;

  /** 发送流式增量片段 */
  sendDelta?(chatId: string, delta: string, metadata?: Record<string, unknown>): Promise<void>;

  /** 流式结束标记 */
  sendStreamEnd?(chatId: string, metadata?: Record<string, unknown>): Promise<void>;

  /** 发送推理思考片段 */
  sendReasoningDelta?(chatId: string, delta: string): Promise<void>;

  /** 推理思考结束 */
  sendReasoningEnd?(chatId: string): Promise<void>;
}
