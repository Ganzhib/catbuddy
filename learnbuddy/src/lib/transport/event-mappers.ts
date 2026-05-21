import type { ToolEvent } from "../../../shared/types";
import type { InboundEvent, UIFileEdit } from "@/lib/types";
import { toolProgressFromBackendEvent } from "@/lib/tool-traces";

/** Map desktop IPC tool payload → UI tool_hint frame. */
export function inboundFromToolEvent(
  chatId: string,
  data: ToolEvent,
): InboundEvent {
  const toolEvent = toolProgressFromBackendEvent(data);
  return {
    event: "message",
    chat_id: chatId,
    text: "",
    kind: "tool_hint",
    tool_events: [toolEvent],
  };
}

export function inboundFromFileEdit(
  chatId: string,
  edit: UIFileEdit,
): InboundEvent {
  return {
    event: "file_edit",
    chat_id: chatId,
    edits: [edit],
  };
}
