import type { AgentTransport, CreateTransportOptions } from "./types";
export type { CreateTransportOptions } from "./types";
import { IpcTransport } from "./ipc-transport";
import { WsTransport } from "./ws-transport";

export function hasLearnbuddyIpc(): boolean {
  return typeof window !== "undefined" && !!window.learnbuddy;
}

export function detectTransportMode(): "desktop" | "web" {
  return hasLearnbuddyIpc() ? "desktop" : "web";
}

export function createAgentTransport(
  options: CreateTransportOptions,
): AgentTransport {
  const mode =
    options.mode === "auto" || !options.mode
      ? detectTransportMode()
      : options.mode;

  if (mode === "desktop") {
    return new IpcTransport();
  }

  return new WsTransport(options.token, options.wsPath);
}
