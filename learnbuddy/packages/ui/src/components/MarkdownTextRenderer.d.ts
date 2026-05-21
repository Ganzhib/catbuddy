import "katex/dist/katex.min.css";
interface MarkdownTextRendererProps {
    children: string;
    className?: string;
    highlightCode?: boolean;
}
/**
 * Heavy markdown stack (GFM, math, KaTeX, syntax highlighting) kept in a
 * separate chunk so the app shell can paint sooner on refresh.
 */
export default function MarkdownTextRenderer({ children, className, highlightCode, }: MarkdownTextRendererProps): import("react/jsx-runtime").JSX.Element;
export {};
//# sourceMappingURL=MarkdownTextRenderer.d.ts.map