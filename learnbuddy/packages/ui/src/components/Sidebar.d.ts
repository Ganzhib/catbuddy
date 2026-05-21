import type { ChatSummary } from "@learnbuddy/shared";
interface SidebarProps {
    sessions: ChatSummary[];
    activeKey: string | null;
    loading: boolean;
    onNewChat: () => void;
    onSelect: (key: string) => void;
    onRequestDelete: (key: string, label: string) => void;
    onOpenSettings: () => void;
    onCollapse: () => void;
}
export declare function Sidebar(props: SidebarProps): import("react/jsx-runtime").JSX.Element;
export {};
//# sourceMappingURL=Sidebar.d.ts.map