import type { ChatSummary } from "@learnbuddy/shared";
interface ThreadShellProps {
    session: ChatSummary | null;
    title: string;
    onToggleSidebar: () => void;
    onGoHome?: () => void;
    onNewChat?: () => void;
    onCreateChat?: () => Promise<string | null>;
    onTurnEnd?: () => void;
    theme?: "light" | "dark";
    onToggleTheme?: () => void;
    hideSidebarToggleOnDesktop?: boolean;
}
export declare function ThreadShell({ session, title, onToggleSidebar, onCreateChat, onTurnEnd, theme, onToggleTheme, hideSidebarToggleOnDesktop, }: ThreadShellProps): import("react/jsx-runtime").JSX.Element;
export {};
//# sourceMappingURL=ThreadShell.d.ts.map