import type { ToolEvent } from "@catbuddy/shared";
import type { InboundEvent, UIFileEdit } from "@catbuddy/shared";
import { toolProgressFromBackendEvent } from "@catbuddy/client";

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
