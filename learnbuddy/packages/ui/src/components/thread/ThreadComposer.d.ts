import type { SendImage, SendOptions } from "@/hooks/uselearnbuddyStream";
import type { SlashCommand, GoalStateWsPayload } from "@learnbuddy/shared";
interface ThreadComposerProps {
    onSend: (content: string, images?: SendImage[], options?: SendOptions) => void;
    disabled?: boolean;
    placeholder?: string;
    isStreaming?: boolean;
    modelLabel?: string | null;
    variant?: "thread" | "hero";
    slashCommands?: SlashCommand[];
    imageMode?: boolean;
    onImageModeChange?: (enabled: boolean) => void;
    onStop?: () => void;
    /** Unix seconds from server; turn elapsed timer above input while set. */
    runStartedAt?: number | null;
    /** Sustained objective for this chat (WebSocket ``goal_state``). */
    goalState?: GoalStateWsPayload;
}
export declare function ThreadComposer({ onSend, disabled, placeholder, isStreaming, modelLabel, variant, slashCommands, imageMode: controlledImageMode, onImageModeChange, onStop, runStartedAt, goalState, }: ThreadComposerProps): import("react/jsx-runtime").JSX.Element;
export {};
//# sourceMappingURL=ThreadComposer.d.ts.map