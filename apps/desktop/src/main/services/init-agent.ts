import { app } from "electron";
import path from "node:path";
import { AgentLoop } from "../agent/loop.js";
import { createProvider } from "../providers/index.js";
import { SessionManager } from "../session/session-manager.js";
import { getDefaultConfig } from "../config/defaults.js";
import { saveConfig } from "../config/persist.js";
import { log } from "../utils/index.js";
import { MessageBus } from "../bus/index.js";
import { ChannelManager, DesktopChannel, GatewayChannel } from "../channels/index.js";
import { registerIpcHandlers } from "../ipcHandlers/index.js";
import {
  applyProjectAnchor,
  getDefaultHomeAnchor,
  type DesktopRuntimeRefs,
} from "./workspace-anchor.js";
import { startDesktopCron } from "../cron/index.js";
import { startDesktopHeartbeat } from "../heartbeat/index.js";
import {
  getWorkspaceFolderById,
  listWorkspaceFolders,
} from "./workspace-folders.js";

export interface AgentRuntime {
  agentLoop: AgentLoop;
  sessions: SessionManager;
  bus: MessageBus;
  channelManager: ChannelManager;
  config: any;
  configFile: string;
}

export async function initAgent(): Promise<AgentRuntime> {
  const defaultAnchor = getDefaultHomeAnchor();
  const homeDir = defaultAnchor.catbuddyDir;
  const workspace = defaultAnchor.workspace;
  let configFile = defaultAnchor.configFile;

  const fs = await import("node:fs");
  fs.mkdirSync(path.dirname(configFile), { recursive: true });

  let config: any;
  if (fs.existsSync(configFile)) {
    config = JSON.parse(fs.readFileSync(configFile, "utf-8"));
    console.log("[main] Config loaded from:", configFile);
  } else {
    config = getDefaultConfig();
    config.workspace = workspace.replace(/\\/g, "/");
    saveConfig(configFile, config);
    console.log("[main] Config written to:", configFile);
  }

  (config as any).runtime = { config_path: configFile };
  console.log("[main] Workspace:", workspace);

  let sessions = new SessionManager(workspace);
  const bus = new MessageBus();
  const channelManager = new ChannelManager(bus);
  channelManager.register(new DesktopChannel());
  channelManager.register(new GatewayChannel({
    config,
    configFile,
    sessions,
    bus,
  }));
  const provider = createProvider(config);
  const agentLoop = new AgentLoop({
    provider,
    workspace,
    projectRoot: defaultAnchor.projectRoot,
    catbuddyDir: defaultAnchor.catbuddyDir,
    model: config.agents.defaults.model,
    maxIterations: config.agents.defaults.maxToolIterations,
    maxMessages: config.agents.defaults.maxMessages,
    contextWindowTokens: config.agents.defaults.contextWindowTokens,
    restrictToWorkspace: true,
    disabledSkills: config.agents.defaults.disabledSkills ?? [],
    sessionManager: sessions,
    bus,
    config,
    sessionTtlMinutes: config.agents?.defaults?.sessionTtlMinutes ?? 0,
  });

  await agentLoop.connectMcp();

  const runtime: DesktopRuntimeRefs & { channelManager: ChannelManager } = {
    agentLoop,
    sessions,
    config,
    configFile,
    channelManager,
  };

  const registry = listWorkspaceFolders(homeDir);
  if (registry.activeFolderId) {
    const folder = getWorkspaceFolderById(homeDir, registry.activeFolderId);
    if (folder) {
      applyProjectAnchor(runtime, folder);
      channelManager.updateRuntimeRefs(runtime);
      sessions = runtime.sessions;
      config = runtime.config;
      configFile = runtime.configFile;
    }
  }

  registerIpcHandlers(runtime);

  const cron = startDesktopCron(runtime);
  const heartbeat = startDesktopHeartbeat(runtime);
  app.on("will-quit", () => {
    cron.stopAll();
    heartbeat.stopAll();
  });

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
  };
}
