import type { ToolEvent } from "@learnbuddy/shared";
import type { InboundEvent, UIFileEdit } from "@learnbuddy/shared";
/** Map desktop IPC tool payload → UI tool_hint frame. */
export declare function inboundFromToolEvent(chatId: string, data: ToolEvent): InboundEvent;
export declare function inboundFromFileEdit(chatId: string, edit: UIFileEdit): InboundEvent;
//# sourceMappingURL=event-mappers.d.ts.map