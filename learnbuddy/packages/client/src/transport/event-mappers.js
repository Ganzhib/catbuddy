import { toolProgressFromBackendEvent } from "@learnbuddy/client";
/** Map desktop IPC tool payload → UI tool_hint frame. */
export function inboundFromToolEvent(chatId, data) {
    const toolEvent = toolProgressFromBackendEvent(data);
    return {
        event: "message",
        chat_id: chatId,
        text: "",
        kind: "tool_hint",
        tool_events: [toolEvent],
    };
}
export function inboundFromFileEdit(chatId, edit) {
    return {
        event: "file_edit",
        chat_id: chatId,
        edits: [edit],
    };
}
//# sourceMappingURL=event-mappers.js.map