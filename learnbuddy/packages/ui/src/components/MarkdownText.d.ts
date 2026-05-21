interface MarkdownTextProps {
    children: string;
    className?: string;
    streaming?: boolean;
}
export declare function preloadMarkdownText(): void;
/**
 * Lightweight markdown renderer mirroring agent-chat-ui: GFM + math via
 * ``remark-math`` / ``rehype-katex``, and fenced code blocks delegated to
 * ``CodeBlock`` for copy-to-clipboard and syntax highlighting.
 */
export declare function MarkdownText({ children, className, streaming, }: MarkdownTextProps): import("react/jsx-runtime").JSX.Element;
export {};
//# sourceMappingURL=MarkdownText.d.ts.map