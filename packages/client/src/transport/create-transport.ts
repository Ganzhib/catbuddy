import type { AgentTransport, CreateTransportOptions } from "./types";
export type { CreateTransportOptions } from "./types";
import { IpcTransport } from "./ipc-transport";
import { GatewayTransport } from "@catbuddy/gateway-sdk-web";
import { WsTransport } from "./ws-transport";

export function hasCatbuddyIpc(): boolean {
  return typeof window !== "undefined" && !!window.catbuddy;
}

export function detectTransportMode(): "desktop" | "web" {
  return hasCatbuddyIpc() ? "desktop" : "web";
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

  if (mode === "gateway") {
    const httpBase = options.gatewayHttpBase?.trim() || "";
    return new GatewayTransport({
      httpBase,
      webToken: options.token,
    });
  }

  return new WsTransport(options.token, options.wsPath);
}
