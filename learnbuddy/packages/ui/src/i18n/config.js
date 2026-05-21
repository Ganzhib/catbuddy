export const LOCALE_STORAGE_KEY = "learnbuddy.locale";
export const supportedLocales = [
    { code: "en", label: "English", nativeLabel: "English" },
    { code: "zh-CN", label: "Chinese (Simplified)", nativeLabel: "简体中文" },
    { code: "zh-TW", label: "Chinese (Traditional)", nativeLabel: "繁體中文" },
    { code: "fr", label: "French", nativeLabel: "Français" },
    { code: "ja", label: "Japanese", nativeLabel: "日本語" },
    { code: "ko", label: "Korean", nativeLabel: "한국어" },
    { code: "es", label: "Spanish", nativeLabel: "Español" },
    { code: "vi", label: "Vietnamese", nativeLabel: "Tiếng Việt" },
    { code: "id", label: "Indonesian", nativeLabel: "Bahasa Indonesia" },
];
export const defaultLocale = "en";
export const fallbackLocale = "en";
export function normalizeLocale(input) {
    if (!input)
        return defaultLocale;
    const trimmed = input.trim();
    if (!trimmed)
        return defaultLocale;
    const exact = supportedLocales.find((locale) => locale.code === trimmed);
    if (exact)
        return exact.code;
    const lower = trimmed.toLowerCase();
    if (lower === "zh" || lower.startsWith("zh-cn") || lower.startsWith("zh-sg")) {
        return "zh-CN";
    }
    if (lower.startsWith("zh-tw") ||
        lower.startsWith("zh-hk") ||
        lower.startsWith("zh-mo") ||
        lower.startsWith("zh-hant")) {
        return "zh-TW";
    }
    const base = lower.split("-")[0];
    const baseMatch = supportedLocales.find((locale) => locale.code.toLowerCase() === base);
    return baseMatch?.code ?? defaultLocale;
}
export function readStoredLocale() {
    if (typeof window === "undefined")
        return null;
    try {
        const raw = window.localStorage.getItem(LOCALE_STORAGE_KEY);
        return raw ? normalizeLocale(raw) : null;
    }
    catch {
        return null;
    }
}
export function detectNavigatorLocale() {
    if (typeof navigator === "undefined")
        return defaultLocale;
    const candidates = [
        ...(navigator.languages ?? []),
        navigator.language,
    ].filter(Boolean);
    for (const locale of candidates) {
        const normalized = normalizeLocale(locale);
        if (normalized)
            return normalized;
    }
    return defaultLocale;
}
export function resolveInitialLocale() {
    return readStoredLocale() ?? detectNavigatorLocale();
}
export function persistLocale(locale) {
    if (typeof window === "undefined")
        return;
    try {
        window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
    }
    catch {
        // ignore storage errors
    }
}
export function applyDocumentLocale(locale) {
    if (typeof document === "undefined")
        return;
    document.documentElement.lang = locale;
}
export function localeOption(locale) {
    return supportedLocales.find((entry) => entry.code === locale) ?? supportedLocales[0];
}
//# sourceMappingURL=config.js.map