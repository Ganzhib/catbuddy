export {
  findStreamingAssistantIndex,
  attachReasoningChunk,
  findActiveAssistantPlaceholderIndex,
  replaceMessageAt,
  closeReasoningStream,
  isReasoningOnlyPlaceholder,
  isToolTrace,
  pruneReasoningOnlyPlaceholders,
  stampLastAssistantTurnStats,
  stampLastAssistantLatency,
  appendToolsUsedSummary,
  optimisticFileEditFromToolStart,
  absorbCompleteAssistantMessage,
  mergeFileEdits,
  mergeFileEditIntoTrace,
  appendToolProgressTrace,
} from "./message-tree";

export { useStreamBuffer } from "./stream-buffer";
export type { StreamBufferControl } from "./stream-buffer";

// Re-export PendingStreamEvent for hook consumers that need to push events directly
export type { PendingStreamEvent } from "./stream-buffer";
