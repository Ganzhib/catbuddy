import type { ChatSummary } from "@learnbuddy/shared";
interface ChatListProps {
    sessions: ChatSummary[];
    activeKey: string | null;
    onSelect: (key: string) => void;
    onRequestDelete: (key: string, label: string) => void;
    loading?: boolean;
    emptyLabel?: string;
}
export declare function ChatList({ sessions, activeKey, onSelect, onRequestDelete, loading, emptyLabel, }: ChatListProps): import("react/jsx-runtime").JSX.Element;
export {};
//# sourceMappingURL=ChatList.d.ts.map