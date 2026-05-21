/** Truncate the first user message into a chat title. */
export declare function deriveTitle(preview: string | undefined, fallback: string): string;
export declare function relativeTime(value: string | number | null | undefined, locale?: string): string;
export declare function fmtDateTime(value: string | number | null | undefined, locale?: string): string;
/** Human-readable turn duration (wall-clock), locale-aware via ``Intl`` (seconds/minutes). */
export declare function formatTurnLatency(ms: number, locale?: string): string;
//# sourceMappingURL=format.d.ts.map