import { type ReactNode } from "react";
type Theme = "light" | "dark";
export declare function useTheme(): {
    theme: Theme;
    toggle: () => void;
    setTheme: (t: Theme) => void;
};
export declare function ThemeProvider({ theme, children }: {
    theme: Theme;
    children: ReactNode;
}): import("react").FunctionComponentElement<import("react").ProviderProps<Theme>>;
export declare function useThemeValue(): Theme;
export {};
//# sourceMappingURL=useTheme.d.ts.map