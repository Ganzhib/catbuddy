import { useMemo, useState } from "react";
import {
  FolderTree,
  Menu,
  Plug,
  Puzzle,
  Search,
  Settings,
  SquarePen,
} from "lucide-react";
import { useTranslation } from "react-i18next";

import { BrandLogo } from "@/components/BrandLogo";
import { ChatList } from "@/components/ChatList";
import { ConnectionBadge } from "@/components/ConnectionBadge";
import { DesktopClientDownload } from "@/components/DesktopClientDownload";
import { GatewayRemoteSwitch } from "@/components/GatewayRemoteSwitch";
import { SidebarNavButton } from "@/components/SidebarNavButton";
import { WorkspaceChatSection } from "@/components/workspace/WorkspaceChatSection";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useWorkspaceFolders } from "@/hooks/useWorkspaceFolders";
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
  const { store, loading: workspaceLoading } = useWorkspaceFolders();
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
      className="flex h-full w-full min-w-0 flex-col border-r border-sidebar-border/60 bg-sidebar text-sidebar-foreground"
    >
      <div className="px-4 pb-2 pt-4">
        <BrandLogo />
      </div>

      <div className="space-y-2 px-3 pb-2">
        <Button
          onClick={props.onNewChat}
          className="h-9 w-full justify-start gap-2.5 rounded-full px-3.5 text-[13px] font-medium text-sidebar-foreground/92 hover:bg-sidebar-accent/75 hover:text-sidebar-foreground"
          variant="ghost"
        >
          <SquarePen className="h-4 w-4 shrink-0 text-[#4f9de8] dark:text-[#6eb3f5]" />
          {t("sidebar.newChat")}
        </Button>

        <div className="flex justify-end">
          <Button
            variant="ghost"
            size="icon"
            aria-label={t("sidebar.collapse")}
            onClick={props.onCollapse}
            className="h-8 w-8 rounded-lg text-muted-foreground/85 hover:bg-sidebar-accent/75 hover:text-sidebar-foreground"
          >
            <Menu className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="space-y-2 px-3 pb-3">
        <label className="relative block">
          <span className="sr-only">{t("sidebar.searchAria")}</span>
          <Search
            className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/70"
            aria-hidden
          />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("sidebar.searchPlaceholder")}
            aria-label={t("sidebar.searchAria")}
            className={cn(
              "h-9 w-full rounded-full border border-transparent bg-sidebar-accent/45",
              "pl-9 pr-3.5 text-[13px] text-sidebar-foreground outline-none",
              "placeholder:text-muted-foreground/75",
              "transition-colors hover:bg-sidebar-accent/65",
              "focus:border-sidebar-border/80 focus:bg-sidebar-accent/70",
              "focus:ring-1 focus:ring-sidebar-border/70",
            )}
          />
        </label>

        <GatewayRemoteSwitch />
        <DesktopClientDownload variant="sidebar" />

        {isDesktop ? (
          <div className="space-y-1 pt-0.5">
            <SidebarNavButton
              icon={Plug}
              label={t("sidebar.nav.mcp")}
              active={props.activePanel === "mcp"}
              onClick={() => props.onSelectPanel("mcp")}
            />
            <SidebarNavButton
              icon={Puzzle}
              label={t("sidebar.nav.skills")}
              active={props.activePanel === "skills"}
              onClick={() => props.onSelectPanel("skills")}
            />
            <SidebarNavButton
              icon={FolderTree}
              label={t("sidebar.nav.workspace")}
              active={props.activePanel === "workspace"}
              onClick={() => props.onSelectPanel("workspace")}
            />
          </div>
        ) : null}
      </div>

      {isDesktop ? (
        <div className="min-h-0 shrink overflow-y-auto border-y border-sidebar-border/40 py-2">
          <p className="mb-1 px-3 text-[13px] font-semibold text-sidebar-foreground/90">
            {t("sidebar.nav.workspace")}
          </p>
          <WorkspaceChatSection
            folders={store.folders}
            sessions={workspaceSessions}
            activeKey={props.activeKey}
            loading={workspaceLoading}
            onSelectChat={selectChat}
            onRequestDelete={props.onRequestDelete}
            compact
          />
        </div>
      ) : null}

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        {!isDesktop || ungroupedSessions.length > 0 ? (
          <>
            {isDesktop && store.folders.length > 0 ? (
              <div className="px-4 pb-1 pt-2 text-[13px] font-medium text-muted-foreground/65">
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

      <Separator className="bg-sidebar-border/50" />
      <div className="flex items-center gap-2 px-3.5 py-3.5 text-xs">
        <Button
          type="button"
          variant="ghost"
          onClick={props.onOpenSettings}
          className="h-9 min-w-0 flex-1 justify-start gap-2.5 rounded-full px-3 text-[13px] font-medium text-sidebar-foreground/85 hover:bg-sidebar-accent/75 hover:text-sidebar-foreground"
        >
          <Settings className="h-4 w-4" aria-hidden />
          {t("sidebar.settings")}
        </Button>
        <ConnectionBadge />
      </div>
    </nav>
  );
}
