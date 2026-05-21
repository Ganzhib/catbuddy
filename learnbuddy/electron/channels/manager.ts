/**
 * ChannelManager — 通道管理与出站消息路由
 *
 * 从 bus.outbound 消费消息，按 channel 字段路由到对应通道。
 * desktop 出站可同时 fan-out 到 relay（Web 订阅 ui_event）。
 */
import type { OutboundMessage } from "../../shared/types";
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

  private targetsFor(msg: OutboundMessage): BaseChannel[] {
    const primary = this.channels.get(msg.channel);
    const out: BaseChannel[] = [];
    if (primary) out.push(primary);
    if (msg.channel === "desktop") {
      const relay = this.channels.get("relay");
      if (relay && relay !== primary) out.push(relay);
    }
    return out;
  }

  private async _dispatchLoop(): Promise<void> {
    while (this._running) {
      try {
        const msg = await this.bus.consumeOutbound(1000);
        if (!msg) continue;

        const targets = this.targetsFor(msg);
        if (targets.length === 0) {
          console.warn(`[manager] Unknown channel: ${msg.channel}`);
          continue;
        }

        for (const channel of targets) {
          await this._deliver(channel, msg);
        }
      } catch (err) {
        console.error("[manager] Error dispatching message:", err);
      }
    }
  }

  private async _deliver(
    channel: BaseChannel,
    msg: OutboundMessage,
  ): Promise<void> {
    const meta = msg.metadata ?? {};

    if (meta._reasoning_delta) {
      await channel.sendReasoningDelta?.(msg.chatId, msg.content);
      return;
    }
    if (meta._reasoning_end) {
      await channel.sendReasoningEnd?.(msg.chatId);
      return;
    }
    if (meta._stream_delta) {
      await channel.sendDelta?.(msg.chatId, msg.content, meta);
      return;
    }
    if (meta._stream_end) {
      await channel.sendStreamEnd?.(msg.chatId, meta);
      return;
    }
    if (meta._tool_progress && meta._tool_event) {
      await channel.sendToolProgress?.(
        msg.chatId,
        meta._tool_event as import("../../shared/types").ToolEvent,
      );
      return;
    }
    if (meta._file_edit && meta._file_edit_event) {
      await channel.sendFileEdit?.(
        msg.chatId,
        meta._file_edit_event as import("../../shared/types").FileEditEvent,
      );
      return;
    }
    if (meta._turn_complete && meta._turn_data) {
      await channel.sendTurnComplete?.(
        msg.chatId,
        meta._turn_data as import("../../shared/types").TurnCompleteData,
      );
      return;
    }
    if (meta._progress) {
      await channel.send?.(msg);
      return;
    }
    if (meta._assistant_complete && msg.content) {
      await channel.sendAssistantMessage?.(msg.chatId, msg.content);
    }
  }
}
