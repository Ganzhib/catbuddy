import { useMemo, useState } from "react";
import {
  Menu,
  MessageSquarePlus,
  Plug,
  Puzzle,
  Search,
  Settings,
} from "lucide-react";
import { useTranslation } from "react-i18next";

import { ConnectionBadge } from "@/components/ConnectionBadge";
import { DesktopClientDownload } from "@/components/DesktopClientDownload";
import { GatewayRemoteSwitch } from "@/components/GatewayRemoteSwitch";
import { SidebarNavButton } from "@/components/SidebarNavButton";
import { WorkspaceChatSection } from "@/components/workspace/WorkspaceChatSection";
import { ChatList } from "@/components/ChatList";
import { Separator } from "@/components/ui/separator";
import { useWorkspaceFolders } from "@/hooks/useWorkspaceFolders";
import { brandAssets } from "@/lib/brand";
import { sb, sbInput, sbSectionTitle } from "@/lib/sidebar-styles";
import { cn } from "@/lib/utils";
import type { SidebarPanel } from "@/lib/sidebar-panel";
import { hasCatbuddyIpc } from "@catbuddy/platform";
import type { ChatSummary } from "@catbuddy/shared";

interface SidebarProps {
  sessions: ChatSummary[];
  activeKey: string | null;
  activePanel: SidebarPanel;
  loading: boolean;
  onNewChat: () => void;
  onSelect: (key: string) => void;
  onRequestDelete: (key: string, label: string) => void;
  onSelectPanel: (panel: SidebarPanel) => void;
  onOpenSettings: () => void;
  onCollapse: () => void;
}

export function Sidebar(props: SidebarProps) {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const isDesktop = hasCatbuddyIpc();
  const {
    store,
    loading: workspaceLoading,
    importFolder,
    selectFolder,
    removeFolder,
  } = useWorkspaceFolders();
  const normalizedQuery = query.trim().toLowerCase();

  const filteredSessions = useMemo(() => {
    if (!normalizedQuery) return props.sessions;
    const terms = normalizedQuery.split(/\s+/).filter(Boolean);
    return props.sessions.filter((session) => {
      const haystack = [
        session.title,
        session.preview,
        session.chatId,
        session.channel,
        session.key,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return terms.every((term) => haystack.includes(term));
    });
  }, [normalizedQuery, props.sessions]);

  const workspaceSessions = useMemo(
    () => filteredSessions.filter((s) => !!s.workspaceFolderId),
    [filteredSessions],
  );

  const ungroupedSessions = useMemo(
    () => filteredSessions.filter((s) => !s.workspaceFolderId),
    [filteredSessions],
  );

  const selectChat = (key: string) => {
    props.onSelectPanel("chat");
    props.onSelect(key);
  };

  return (
    <nav
      aria-label={t("sidebar.navigation")}
      className={cn(
        "flex h-full w-full min-w-0 flex-col border-r",
        sb.shell,
        sb.border,
      )}
    >
      {/* 顶部：头像 + 用户名 | 新建对话图标 | 菜单 */}
      <div className={cn("flex items-center justify-between pt-4", sb.px, "pb-3")}>
        <div className={cn("flex items-center", sb.gapSm)}>
          <img
            src={brandAssets.icon}
            alt=""
            className="h-12 w-12 shrink-0 rounded-full object-cover"
            draggable={false}
          />
          <span className={cn("whitespace-nowrap text-[16px] font-bold", sb.text)}>
            catbuddy
          </span>
        </div>

        <div className={cn("flex shrink-0 items-center", sb.gapLg)}>
          <button
            type="button"
            aria-label={t("sidebar.newChat")}
            onClick={props.onNewChat}
            className={cn(
              "inline-flex h-6 w-6 items-center justify-center rounded transition-colors duration-200",
              sb.iconButtonHover,
              sb.icon,
            )}
          >
            <MessageSquarePlus className="h-6 w-6" aria-hidden />
          </button>

          <button
            type="button"
            aria-label={t("sidebar.collapse")}
            onClick={props.onCollapse}
            className={cn(
              "inline-flex h-6 w-6 items-center justify-center rounded transition-colors duration-200",
              sb.iconButtonHover,
              sb.icon,
            )}
          >
            <Menu className="h-6 w-6" aria-hidden />
          </button>
        </div>
      </div>

      {/* 搜索 + 功能区 */}
      <div className={cn("space-y-3 pb-3", sb.px)}>
        <label className="relative block">
          <span className="sr-only">{t("sidebar.searchAria")}</span>
          <Search
            className={cn(
              "pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2",
              sb.iconMuted,
            )}
            aria-hidden
          />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("sidebar.searchPlaceholder")}
            aria-label={t("sidebar.searchAria")}
            className={cn(sbInput, sb.border)}
          />
        </label>

        <GatewayRemoteSwitch />
        <DesktopClientDownload variant="sidebar" />

        {isDesktop ? (
          <div className="space-y-3">
            <SidebarNavButton
              icon={Plug}
              label={t("sidebar.nav.mcp")}
              active={props.activePanel === "mcp"}
              variant="plain"
              onClick={() => props.onSelectPanel("mcp")}
            />
            <SidebarNavButton
              icon={Puzzle}
              label={t("sidebar.nav.skills")}
              active={props.activePanel === "skills"}
              variant="filled"
              onClick={() => props.onSelectPanel("skills")}
            />
          </div>
        ) : null}
      </div>

      {/* 工作空间 */}
      {isDesktop ? (
        <div className={cn("min-h-0 shrink overflow-y-auto border-y py-2", sb.border)}>
          <WorkspaceChatSection
            folders={store.folders}
            sessions={workspaceSessions}
            activeKey={props.activeKey}
            activeFolderId={store.activeFolderId}
            loading={workspaceLoading}
            onSelectChat={selectChat}
            onRequestDelete={props.onRequestDelete}
            onImportFolder={() => void importFolder()}
            onRemoveFolder={(id) => removeFolder(id)}
            onSelectFolder={(id) => selectFolder(id)}
            compact
          />
        </div>
      ) : null}

      {/* 聊天记录 */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        {!isDesktop || ungroupedSessions.length > 0 ? (
          <>
            {isDesktop && store.folders.length > 0 ? (
              <div className={cn("mb-2 mt-4", sb.px, sbSectionTitle)}>
                {t("workspace.chatHistoryTitle")}
              </div>
            ) : null}
            <ChatList
              sessions={isDesktop ? ungroupedSessions : filteredSessions}
              activeKey={props.activeKey}
              loading={props.loading}
              emptyLabel={
                normalizedQuery ? t("sidebar.noSearchResults") : t("chat.noSessions")
              }
              onSelect={selectChat}
              onRequestDelete={props.onRequestDelete}
            />
          </>
        ) : (
          <div className="flex-1" aria-hidden />
        )}
      </div>

      <Separator className={cn("bg-[#C8DCF0]/80 dark:bg-sidebar-border/50")} />
      <div className={cn("py-4", sb.px)}>
        <button
          type="button"
          onClick={props.onOpenSettings}
          className={cn(
            "flex h-10 w-full items-center gap-2 rounded-lg px-0",
            "text-[14px] transition-colors duration-200",
            sb.text,
            sb.hover,
          )}
        >
          <Settings className={cn("h-4 w-4 shrink-0", sb.icon)} aria-hidden />
          <span className="min-w-0 flex-1 truncate text-left font-normal">
            {t("sidebar.settings")}
          </span>
          <ConnectionBadge variant="dot" />
        </button>
      </div>
    </nav>
  );
}
