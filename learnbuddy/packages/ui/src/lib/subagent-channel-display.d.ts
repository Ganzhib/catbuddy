import type { UIMessage } from "@learnbuddy/shared";
/** Strip Task assignment + Summarize tail from persisted subagent announce blobs. */
export declare function scrubSubagentAnnounceBody(content: string, maxResultChars?: number): string;
/** Apply scrub to assistant rows that look like subagent inject announcements. */
export declare function scrubSubagentUiMessages(messages: UIMessage[]): UIMessage[];
//# sourceMappingURL=subagent-channel-display.d.ts.map