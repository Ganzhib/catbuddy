import { IpcTransport } from "./ipc-transport";
import { WsTransport } from "./ws-transport";
export function hasLearnbuddyIpc() {
    return typeof window !== "undefined" && !!window.learnbuddy;
}
export function detectTransportMode() {
    return hasLearnbuddyIpc() ? "desktop" : "web";
}
export function createAgentTransport(options) {
    const mode = options.mode === "auto" || !options.mode
        ? detectTransportMode()
        : options.mode;
    if (mode === "desktop") {
        return new IpcTransport();
    }
    return new WsTransport(options.token, options.wsPath);
}
//# sourceMappingURL=create-transport.js.map