/**
 * MessageBus — 异步消息总线，解耦通道与 Agent 核心
 *
 * 参考 learnbuddy/bus/queue.py
 * 单消费者模式：run() 独占 consumeInbound，ChannelDispatcher 独占 consumeOutbound
 */
import type { InboundMessage, OutboundMessage } from "../../shared/types";

type Resolver<T> = (msg: T) => void;

export class MessageBus {
  private _inbound: InboundMessage[] = [];
  private _outbound: OutboundMessage[] = [];
  private _inboundResolve: Resolver<InboundMessage> | null = null;
  private _outboundResolve: Resolver<OutboundMessage> | null = null;
  private _running = false;

  // ═══ Inbound（通道 → Agent） ═══

  /** 通道发布入站消息 */
  publishInbound(msg: InboundMessage): void {
    if (this._inboundResolve) {
      this._inboundResolve(msg);
      this._inboundResolve = null;
    } else {
      this._inbound.push(msg);
    }
  }

  /** Agent 消费入站消息（阻塞式，可超时） */
  consumeInbound(timeoutMs = 1000): Promise<InboundMessage | null> {
    if (this._inbound.length > 0) {
      return Promise.resolve(this._inbound.shift()!);
    }
    let timer: NodeJS.Timeout;
    return new Promise<InboundMessage | null>((resolve) => {
      this._inboundResolve = resolve;
      timer = setTimeout(() => {
        if (this._inboundResolve === resolve) {
          this._inboundResolve = null;
          resolve(null);
        }
      }, timeoutMs);
    }).finally(() => clearTimeout(timer));
  }

  // ═══ Outbound（Agent → 通道） ═══

  /** Agent 发布出站消息 */
  publishOutbound(msg: OutboundMessage): void {
    if (this._outboundResolve) {
      this._outboundResolve(msg);
      this._outboundResolve = null;
    } else {
      this._outbound.push(msg);
    }
  }

  /** 通道消费出站消息（阻塞式，可超时） */
  consumeOutbound(timeoutMs = 1000): Promise<OutboundMessage | null> {
    if (this._outbound.length > 0) {
      return Promise.resolve(this._outbound.shift()!);
    }
    let timer: NodeJS.Timeout;
    return new Promise<OutboundMessage | null>((resolve) => {
      this._outboundResolve = resolve;
      timer = setTimeout(() => {
        if (this._outboundResolve === resolve) {
          this._outboundResolve = null;
          resolve(null);
        }
      }, timeoutMs);
    }).finally(() => clearTimeout(timer));
  }

  // ═══ 非阻塞查询 ═══

  get inboundSize(): number {
    return this._inbound.length;
  }

  get outboundSize(): number {
    return this._outbound.length;
  }

  get running(): boolean {
    return this._running;
  }

  start(): void {
    this._running = true;
  }

  stop(): void {
    this._running = false;
  }
}
