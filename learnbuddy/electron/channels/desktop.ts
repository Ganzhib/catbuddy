/**
 * WebUIChannel — 连接 Electron IPC 与 MessageBus
 *
 * 从 bus.outbound 消费 Agent 响应，通过 webContents.send 投送到渲染进程。
 */
import { BrowserWindow } from "electron";
import type { FileEditEvent, OutboundMessage, ToolEvent, TurnCompleteData } from "../../shared/types";
import type { BaseChannel } from "./base";

export class DesktopChannel implements BaseChannel {
  readonly name = "desktop";
  readonly displayName = "desktop";

  private _running = false;

  get running(): boolean {
    return this._running;
  }

  private win(): Electron.BrowserWindow | null {
    return BrowserWindow.getAllWindows()[0] ?? null;
  }

  private sendIpc(channel: string, data: unknown): void {
    this.win()?.webContents.send(channel, data);
  }

  async start(): Promise<void> {
    this._running = true;
  }

  async stop(): Promise<void> {
    this._running = false;
  }

  async send(msg: OutboundMessage): Promise<void> {
    if (msg.metadata?._progress && msg.content) {
      this.sendIpc("agent:system-message", { text: msg.content });
    }
  }

  async sendAssistantMessage(_chatId: string, text: string): Promise<void> {
    this.sendIpc("agent:assistant-message", { text });
  }

  async sendDelta(
    chatId: string,
    delta: string,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    const streamId = (metadata?._stream_id as string) ?? chatId;
    this.sendIpc("agent:stream-delta", { content: delta, streamId });
  }

  async sendStreamEnd(
    _chatId: string,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    const streamId = (metadata?._stream_id as string) ?? "";
    this.sendIpc("agent:stream-end", { streamId, resuming: false });
  }

  async sendReasoningDelta(chatId: string, delta: string): Promise<void> {
    this.sendIpc("agent:reasoning-delta", { content: delta });
  }

  async sendReasoningEnd(_chatId: string): Promise<void> {
    this.sendIpc("agent:reasoning-end", {});
  }

  async sendToolProgress(_chatId: string, event: ToolEvent): Promise<void> {
    this.sendIpc("agent:tool-progress", event);
  }

  async sendFileEdit(_chatId: string, edit: FileEditEvent): Promise<void> {
    this.sendIpc("agent:file-edit", edit);
  }

  async sendTurnComplete(_chatId: string, data: TurnCompleteData): Promise<void> {
    this.sendIpc("agent:turn-complete", data);
  }
}
