import type { AgentTransport, CreateTransportOptions } from "./types";
export type { CreateTransportOptions } from "./types";
import { IpcTransport } from "./ipc-transport";
import { RelayTransport } from "./relay-transport";
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

  if (mode === "gateway" || mode === "relay") {
    const httpBase = (options.gatewayHttpBase ?? options.relayHttpBase)?.trim() || "";
    return new RelayTransport({
      httpBase,
      viewerToken: options.token,
    });
  }

  return new WsTransport(options.token, options.wsPath);
}
