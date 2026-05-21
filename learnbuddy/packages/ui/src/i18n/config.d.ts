export declare const LOCALE_STORAGE_KEY = "learnbuddy.locale";
export declare const supportedLocales: readonly [{
    readonly code: "en";
    readonly label: "English";
    readonly nativeLabel: "English";
}, {
    readonly code: "zh-CN";
    readonly label: "Chinese (Simplified)";
    readonly nativeLabel: "简体中文";
}, {
    readonly code: "zh-TW";
    readonly label: "Chinese (Traditional)";
    readonly nativeLabel: "繁體中文";
}, {
    readonly code: "fr";
    readonly label: "French";
    readonly nativeLabel: "Français";
}, {
    readonly code: "ja";
    readonly label: "Japanese";
    readonly nativeLabel: "日本語";
}, {
    readonly code: "ko";
    readonly label: "Korean";
    readonly nativeLabel: "한국어";
}, {
    readonly code: "es";
    readonly label: "Spanish";
    readonly nativeLabel: "Español";
}, {
    readonly code: "vi";
    readonly label: "Vietnamese";
    readonly nativeLabel: "Tiếng Việt";
}, {
    readonly code: "id";
    readonly label: "Indonesian";
    readonly nativeLabel: "Bahasa Indonesia";
}];
export type SupportedLocale = (typeof supportedLocales)[number]["code"];
export declare const defaultLocale: SupportedLocale;
export declare const fallbackLocale: SupportedLocale;
export declare function normalizeLocale(input: string | null | undefined): SupportedLocale;
export declare function readStoredLocale(): SupportedLocale | null;
export declare function detectNavigatorLocale(): SupportedLocale;
export declare function resolveInitialLocale(): SupportedLocale;
export declare function persistLocale(locale: SupportedLocale): void;
export declare function applyDocumentLocale(locale: SupportedLocale): void;
export declare function localeOption(locale: SupportedLocale): {
    readonly code: "en";
    readonly label: "English";
    readonly nativeLabel: "English";
} | {
    readonly code: "zh-CN";
    readonly label: "Chinese (Simplified)";
    readonly nativeLabel: "简体中文";
} | {
    readonly code: "zh-TW";
    readonly label: "Chinese (Traditional)";
    readonly nativeLabel: "繁體中文";
} | {
    readonly code: "fr";
    readonly label: "French";
    readonly nativeLabel: "Français";
} | {
    readonly code: "ja";
    readonly label: "Japanese";
    readonly nativeLabel: "日本語";
} | {
    readonly code: "ko";
    readonly label: "Korean";
    readonly nativeLabel: "한국어";
} | {
    readonly code: "es";
    readonly label: "Spanish";
    readonly nativeLabel: "Español";
} | {
    readonly code: "vi";
    readonly label: "Vietnamese";
    readonly nativeLabel: "Tiếng Việt";
} | {
    readonly code: "id";
    readonly label: "Indonesian";
    readonly nativeLabel: "Bahasa Indonesia";
};
//# sourceMappingURL=config.d.ts.map