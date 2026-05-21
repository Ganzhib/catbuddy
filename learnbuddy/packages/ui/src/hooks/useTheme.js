import { createContext, createElement, useCallback, useContext, useEffect, useState, } from "react";
const STORAGE_KEY = "learnbuddy-webui.theme";
const ThemeContext = createContext("light");
function readStored() {
    try {
        const v = localStorage.getItem(STORAGE_KEY);
        return v === "light" || v === "dark" ? v : null;
    }
    catch {
        return null;
    }
}
function applyTheme(theme) {
    const root = document.documentElement;
    if (theme === "dark")
        root.classList.add("dark");
    else
        root.classList.remove("dark");
}
export function useTheme() {
    const [theme, setThemeState] = useState(() => {
        const stored = readStored();
        if (stored)
            return stored;
        if (typeof window !== "undefined" && window.matchMedia) {
            return window.matchMedia("(prefers-color-scheme: dark)").matches
                ? "dark"
                : "light";
        }
        return "light";
    });
    useEffect(() => {
        applyTheme(theme);
        try {
            localStorage.setItem(STORAGE_KEY, theme);
        }
        catch {
            // ignore
        }
    }, [theme]);
    const setTheme = useCallback((t) => setThemeState(t), []);
    const toggle = useCallback(() => setThemeState((t) => (t === "dark" ? "light" : "dark")), []);
    return { theme, toggle, setTheme };
}
export function ThemeProvider({ theme, children }) {
    return createElement(ThemeContext.Provider, { value: theme }, children);
}
export function useThemeValue() {
    return useContext(ThemeContext);
}
//# sourceMappingURL=useTheme.js.map