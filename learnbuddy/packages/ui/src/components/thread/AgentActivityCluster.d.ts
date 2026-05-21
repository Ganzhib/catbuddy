import type { UIMessage } from "@learnbuddy/shared";
export declare function isReasoningOnlyAssistant(m: UIMessage): boolean;
export declare function isAgentActivityMember(m: UIMessage): boolean;
interface AgentActivityClusterProps {
    messages: UIMessage[];
    /** True while the session turn is still running (drives “Working…” copy + header sheen). */
    isTurnStreaming: boolean;
    hasBodyBelow: boolean;
}
/**
 * Outer fold wrapping interleaved reasoning-only assistant rows and tool-trace rows.
 * Fixed max height with inner scroll; each block keeps its own small collapsible (reasoning / tools).
 */
export declare function AgentActivityCluster({ messages, isTurnStreaming, hasBodyBelow, }: AgentActivityClusterProps): import("react/jsx-runtime").JSX.Element;
export {};
//# sourceMappingURL=AgentActivityCluster.d.ts.map