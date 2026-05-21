interface ComposerProps {
    onSend: (content: string) => void;
    disabled?: boolean;
    placeholder?: string;
    /** Visually collapse the outer padding when embedded inside a welcome screen. */
    compact?: boolean;
}
/**
 * Rounded, shadowed composer with an embedded send button — modeled after the
 * agent-chat-ui input: a single surface that looks like one interactive unit
 * rather than a textarea + button pair.
 */
export declare function Composer({ onSend, disabled, placeholder, compact, }: ComposerProps): import("react/jsx-runtime").JSX.Element;
export {};
//# sourceMappingURL=Composer.d.ts.map