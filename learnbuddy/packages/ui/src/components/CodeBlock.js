import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Suspense, lazy, useCallback, useState } from "react";
import { Check, Copy } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useThemeValue } from "@/hooks/useTheme";
import { cn } from "@/lib/utils";
const LazyHighlightedCode = lazy(async () => {
    const [{ default: SyntaxHighlighter }, { default: oneDark }, { default: oneLight },] = await Promise.all([
        import("react-syntax-highlighter/dist/esm/prism-async-light"),
        import("react-syntax-highlighter/dist/esm/styles/prism/one-dark"),
        import("react-syntax-highlighter/dist/esm/styles/prism/one-light"),
    ]);
    return {
        default({ language, code, isDark }) {
            return (_jsx(SyntaxHighlighter, { language: language, style: isDark ? oneDark : oneLight, customStyle: {
                    margin: 0,
                    padding: "1rem",
                    fontSize: "0.875rem",
                    lineHeight: 1.6,
                }, PreTag: "pre", wrapLongLines: true, children: code }));
        },
    };
});
function PlainCodeFallback({ code }) {
    return (_jsx("pre", { className: "m-0 overflow-x-auto whitespace-pre-wrap p-4 font-mono text-sm leading-[1.6]", children: _jsx("code", { children: code }) }));
}
export function CodeBlock({ language, code, className, highlight = true, }) {
    const { t } = useTranslation();
    const [copied, setCopied] = useState(false);
    const isDark = useThemeValue() === "dark";
    const onCopy = useCallback(() => {
        if (!navigator.clipboard)
            return;
        navigator.clipboard.writeText(code).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1_500);
        });
    }, [code]);
    return (_jsxs("div", { className: cn("overflow-hidden rounded-lg border", isDark ? "border-white/10" : "border-black/10", className), children: [_jsxs("div", { className: cn("flex items-center justify-between px-4 py-1.5 text-xs font-medium", isDark
                    ? "bg-zinc-800 text-zinc-300"
                    : "bg-zinc-100 text-zinc-600"), children: [_jsx("span", { className: "lowercase font-mono", children: language || t("code.fallbackLanguage") }), _jsxs("button", { type: "button", onClick: onCopy, className: cn("inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-mono transition-colors", isDark
                            ? "text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200"
                            : "text-zinc-500 hover:bg-zinc-200 hover:text-zinc-700"), "aria-label": t("code.copyAria"), children: [copied ? (_jsx(Check, { className: "h-3.5 w-3.5" })) : (_jsx(Copy, { className: "h-3.5 w-3.5" })), _jsx("span", { children: copied ? t("code.copied") : t("code.copy") })] })] }), highlight ? (_jsx(Suspense, { fallback: _jsx(PlainCodeFallback, { code: code }), children: _jsx(LazyHighlightedCode, { language: language, code: code, isDark: isDark }) })) : (_jsx(PlainCodeFallback, { code: code }))] }));
}
//# sourceMappingURL=CodeBlock.js.map