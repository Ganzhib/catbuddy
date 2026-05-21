interface ThreadHeaderProps {
    title: string;
    onToggleSidebar: () => void;
    theme: "light" | "dark";
    onToggleTheme: () => void;
    hideSidebarToggleOnDesktop?: boolean;
    minimal?: boolean;
}
export declare function ThreadHeader({ title, onToggleSidebar, theme, onToggleTheme, hideSidebarToggleOnDesktop, minimal, }: ThreadHeaderProps): import("react/jsx-runtime").JSX.Element;
export {};
//# sourceMappingURL=ThreadHeader.d.ts.map