/**
 * ChannelManager — 通道管理与出站消息路由
 *
 * 从 bus.outbound 消费消息，按 channel 字段路由到对应通道。
 * 参考 nanobot/channels/manager.py ChannelManager._dispatch_outbound
 */
import type { BaseChannel } from "./base";
import type { MessageBus } from "../bus";

export class ChannelManager {
  private channels = new Map<string, BaseChannel>();
  private _running = false;

  constructor(private bus: MessageBus) {}

  register(channel: BaseChannel): void {
    this.channels.set(channel.name, channel);
    console.log(`[manager] Registered channel: ${channel.name}`);
  }

  unregister(name: string): void {
    this.channels.delete(name);
  }

  get(name: string): BaseChannel | undefined {
    return this.channels.get(name);
  }

  async start(): Promise<void> {
    this._running = true;
    await Promise.all(
      [...this.channels.values()].map((ch) => ch.start()),
    );
    this._dispatchLoop();
  }

  async stop(): Promise<void> {
    this._running = false;
    await Promise.all(
      [...this.channels.values()].map((ch) => ch.stop()),
    );
  }

  private async _dispatchLoop(): Promise<void> {
    while (this._running) {
      try {
        const msg = await this.bus.consumeOutbound(1000);
        if (!msg) continue;

        const channel = this.channels.get(msg.channel);
        if (!channel) {
          console.warn(`[manager] Unknown channel: ${msg.channel}`);
          continue;
        }

        const meta = msg.metadata ?? {};

        // 推理流
        if (meta._reasoning_delta) {
          await channel.sendReasoningDelta?.(msg.chatId, msg.content);
          continue;
        }
        if (meta._reasoning_end) {
          await channel.sendReasoningEnd?.(msg.chatId);
          continue;
        }

        // 文本流
        if (meta._stream_delta) {
          await channel.sendDelta?.(msg.chatId, msg.content, meta);
          continue;
        }
        if (meta._stream_end) {
          await channel.sendStreamEnd?.(msg.chatId, meta);
          continue;
        }

        // 进度/进度提示
        if (meta._progress) {
          await channel.send?.(msg);
          continue;
        }

        // 普通消息
        await channel.send(msg);
      } catch (err) {
        console.error("[manager] Error dispatching message:", err);
      }
    }
  }
}
