/**
 * Lightweight interval scheduler for background agent jobs.
 */
export interface CronJob {
  name: string;
  /** Interval in milliseconds. */
  intervalMs: number;
  /** Run once when registered (before first interval tick). */
  runOnStart?: boolean;
  run: () => Promise<void>;
}

export class CronScheduler {
  private readonly _timers = new Map<string, NodeJS.Timeout>();

  register(job: CronJob): void {
    this.unregister(job.name);

    const tick = (): void => {
      void job.run().catch((err) => {
        console.error(`[cron] ${job.name} failed:`, err);
      });
    };

    if (job.runOnStart) tick();
    const id = setInterval(tick, job.intervalMs);
    this._timers.set(job.name, id);
    console.info(
      "[cron] Registered %s every %d min",
      job.name,
      Math.round(job.intervalMs / 60_000),
    );
  }

  unregister(name: string): void {
    const id = this._timers.get(name);
    if (id !== undefined) clearInterval(id);
    this._timers.delete(name);
  }

  stopAll(): void {
    for (const name of [...this._timers.keys()]) {
      this.unregister(name);
    }
  }
}
