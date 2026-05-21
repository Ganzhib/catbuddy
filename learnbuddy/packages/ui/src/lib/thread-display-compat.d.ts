import type { UIMessage } from "@learnbuddy/shared";
/**
 * Older WebUI disk snapshots and historical sessions may still contain
 * ``kind: "long_task"`` rows from the retired orchestrator UI. Map them to
 * ordinary trace rows so the thread stays readable without bespoke cards.
 */
export declare function normalizeLegacyLongTaskMessages(messages: UIMessage[]): UIMessage[];
//# sourceMappingURL=thread-display-compat.d.ts.map