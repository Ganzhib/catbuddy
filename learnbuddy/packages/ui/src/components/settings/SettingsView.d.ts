interface SettingsViewProps {
    theme: "light" | "dark";
    onToggleTheme: () => void;
    onBackToChat: () => void;
    onModelNameChange: (modelName: string | null) => void;
    onLogout?: () => void;
    onRestart?: () => void;
    isRestarting?: boolean;
}
export declare function SettingsView({ theme, onToggleTheme, onBackToChat, onModelNameChange, onLogout, onRestart, isRestarting, }: SettingsViewProps): import("react/jsx-runtime").JSX.Element;
export {};
//# sourceMappingURL=SettingsView.d.ts.map