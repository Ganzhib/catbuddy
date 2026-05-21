import type { StreamError } from "@learnbuddy/client";
interface StreamErrorNoticeProps {
    error: StreamError;
    onDismiss: () => void;
}
/**
 * Dismissible banner that surfaces transport-level faults the user needs to
 * know about. Rendered above the composer so the message the fault referred
 * to remains in view just above. ``role="alert"`` + ``aria-live="assertive"``
 * ensures screen readers announce the failure.
 */
export declare function StreamErrorNotice({ error, onDismiss }: StreamErrorNoticeProps): import("react/jsx-runtime").JSX.Element;
export {};
//# sourceMappingURL=StreamErrorNotice.d.ts.map