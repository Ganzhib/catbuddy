import { app } from "electron";
import path from "node:path";
import { AgentLoop } from "../agent/loop.js";
import { createProvider } from "../providers/index.js";
import { SessionManager } from "../session/session-manager.js";
import { getDefaultConfig } from "../config/defaults.js";
import { log } from "../utils/index.js";
import { MessageBus } from "../bus/index.js";
import { ChannelManager, DesktopChannel } from "../channels/index.js";
import { registerIpcHandlers } from "../ipcHandlers/index.js";
import {
  applyGatewayRemote,
  registerGatewayRemoteIpc,
  type GatewayRemoteState,
} from "./gateway-remote.js";

export interface AgentRuntime {
  agentLoop: AgentLoop;
  sessions: SessionManager;
  bus: MessageBus;
  channelManager: ChannelManager;
  config: any;
  configFile: string;
  gatewayState: GatewayRemoteState;
}

export async function initAgent(): Promise<AgentRuntime> {
  const home = app.getPath("home");
  const catbuddyDir = path.join(home, ".catbuddy-desktop");
  const workspace = path.join(catbuddyDir, "workspace");
  const configFile = path.join(catbuddyDir, "config", "config.json");

  const fs = await import("node:fs");
  fs.mkdirSync(path.dirname(configFile), { recursive: true });

  let config: any;
  if (fs.existsSync(configFile)) {
    config = JSON.parse(fs.readFileSync(configFile, "utf-8"));
    console.log("[main] Config loaded from:", configFile);
  } else {
    config = getDefaultConfig();
    config.workspace = workspace.replace(/\\/g, "/");
    fs.writeFileSync(configFile, JSON.stringify(config, null, 2), "utf-8");
    console.log("[main] Config written to:", configFile);
  }

  (config as any).runtime = { config_path: configFile };
  console.log("[main] Workspace:", workspace);

  const sessions = new SessionManager(workspace);
  const bus = new MessageBus();
  const channelManager = new ChannelManager(bus);
  channelManager.register(new DesktopChannel());

  const gatewayState: GatewayRemoteState = {
    gatewayWsClient: null,
    gatewayAccountEmail: config.gateway?.accountEmail?.trim().toLowerCase() || undefined,
    appConfig: config,
    appConfigFile: configFile,
    appSessions: sessions,
    appBus: bus,
    appChannelManager: channelManager,
  };

  applyGatewayRemote(gatewayState);
  registerGatewayRemoteIpc(gatewayState);

  const provider = createProvider(config);
  const agentLoop = new AgentLoop({
    provider,
    workspace,
    model: config.agents.defaults.model,
    maxIterations: config.agents.defaults.maxToolIterations,
    maxMessages: config.agents.defaults.maxMessages,
    contextWindowTokens: config.agents.defaults.contextWindowTokens,
    restrictToWorkspace: config.tools.restrictToWorkspace,
    disabledSkills: config.agents.defaults.disabledSkills ?? [],
    sessionManager: sessions,
    bus,
  });

  registerIpcHandlers(
    agentLoop,
    sessions,
    config,
    configFile,
    () => gatewayState.gatewayWsClient,
  );

  channelManager.start();
  agentLoop.run().catch((err) =>
    console.error("[main] AgentLoop.run() crashed:", err),
  );
  log.success("[main] Backend initialized successfully");

  return {
    agentLoop,
    sessions,
    bus,
    channelManager,
    config,
    configFile,
    gatewayState,
  };
}
