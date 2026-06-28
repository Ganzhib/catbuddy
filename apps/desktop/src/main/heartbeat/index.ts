import type { InboundMessage } from "@catbuddy/shared";
import type { DesktopRuntimeRefs } from "../services/workspace-anchor.js";
import { CronScheduler } from "../cron/scheduler.js";
import { buildHeartbeatPrompt } from "./prompt.js";
import { workspaceHasHeartbeatTasks } from "./tasks.js";

const DEFAULT_HEARTBEAT_INTERVAL_MINUTES = 30;
const HEARTBEAT_CHAT_ID = "main";

export type HeartbeatRunResult = "skipped" | "no-tasks" | "dispatched";

export function runHeartbeatOnce(
  runtime: DesktopRuntimeRefs,
  opts?: { force?: boolean },
): HeartbeatRunResult {
  const bus = runtime.agentLoop.bus;
  if (!bus) {
    console.warn("[heartbeat] MessageBus not ready");
    return "skipped";
  }

  const defaults = runtime.config.agents?.defaults;
  if (defaults?.heartbeatEnabled === false) {
    return "skipped";
  }

  const workspace = runtime.agentLoop.workspace;
  if (!opts?.force && !workspaceHasHeartbeatTasks(workspace)) {
    return "no-tasks";
  }

  const msg: InboundMessage = {
    channel: "desktop",
    senderId: "heartbeat",
    chatId: HEARTBEAT_CHAT_ID,
    content: buildHeartbeatPrompt(),
    timestamp: Date.now(),
    media: [],
    sessionKeyOverride: `desktop:${HEARTBEAT_CHAT_ID}`,
    metadata: { heartbeat: true },
  };

  bus.publishInbound(msg);
  console.info("[heartbeat] Dispatched periodic check");
  return "dispatched";
}

export function startDesktopHeartbeat(
  runtime: DesktopRuntimeRefs,
): CronScheduler {
  const scheduler = new CronScheduler();
  const defaults = runtime.config.agents?.defaults;

  if (defaults?.heartbeatEnabled === false) {
    console.info("[heartbeat] Disabled via config");
    return scheduler;
  }

  const minutes =
    defaults?.heartbeatIntervalMinutes ?? DEFAULT_HEARTBEAT_INTERVAL_MINUTES;
  const intervalMs = Math.max(5, minutes) * 60_000;

  scheduler.register({
    name: "heartbeat",
    intervalMs,
    run: async () => {
      runHeartbeatOnce(runtime);
    },
  });

  return scheduler;
}

export {
  hasActiveHeartbeatTasks,
  readHeartbeatFile,
  workspaceHasHeartbeatTasks,
  HEARTBEAT_FILENAME,
} from "./tasks.js";
export {
  buildHeartbeatPrompt,
  HEARTBEAT_OK,
  isHeartbeatMessage,
  shouldSuppressHeartbeatOutbound,
} from "./prompt.js";
