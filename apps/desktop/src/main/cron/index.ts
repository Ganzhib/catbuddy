import type { DesktopRuntimeRefs } from "../services/workspace-anchor.js";
import { CronScheduler } from "./scheduler.js";

const DEFAULT_DREAM_INTERVAL_MINUTES = 120;

export function startDesktopCron(runtime: DesktopRuntimeRefs): CronScheduler {
  const scheduler = new CronScheduler();
  const minutes =
    runtime.config.agents?.defaults?.dreamIntervalMinutes ??
    DEFAULT_DREAM_INTERVAL_MINUTES;
  const intervalMs = Math.max(5, minutes) * 60_000;

  scheduler.register({
    name: "dream",
    intervalMs,
    run: async () => {
      if (!runtime.agentLoop.dream) return;
      const summary = await runtime.agentLoop.runDreamOnce();
      if (summary) {
        console.info("[cron/dream] wrote memory (%d chars)", summary.length);
      }
    },
  });

  return scheduler;
}

export { CronScheduler } from "./scheduler.js";
export type { CronJob } from "./scheduler.js";
