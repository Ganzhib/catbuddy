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
import { WorkspaceChatSection, DEFAULT_WORKSPACE_FOLDER_ID } from "@/components/workspace/WorkspaceChatSection";
import { Separator } from "@/components/ui/separator";
import { useWorkspaceFolders } from "@/hooks/useWorkspaceFolders";
import { brandAssets } from "@/lib/brand";
import { sb, sbInput } from "@/lib/sidebar-styles";
import { cn } from "@/lib/utils";
import type { SidebarPanel } from "@/lib/sidebar-panel";
import { hasCatbuddyIpc } from "@catbuddy/platform";
import type { ChatSummary, WorkspaceFolder } from "@catbuddy/shared";

interface SidebarProps {
  sessions: ChatSummary[];
  activeKey: string | null;
  activePanel: SidebarPanel;
  loading: boolean;
  onNewChat: () => void;
  onCreateChat: (workspaceFolderId: string | null | "default") => unknown;
  onSelect: (key: string | null, workspaceFolderId?: string | null) => void;
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

  const workspaceSessions = filteredSessions;

  const derivedWorkspaceFolders = useMemo<WorkspaceFolder[]>(() => {
    if (isDesktop) return store.folders;
    const byId = new Map<string, WorkspaceFolder>();
    for (const session of filteredSessions) {
      const id = session.workspaceFolderId?.trim();
      if (!id || byId.has(id)) continue;
      byId.set(id, {
        id,
        name: session.workspaceFolderName?.trim() || id,
        createdAt: session.createdAt ?? "",
        projectRoot: "",
        catbuddyDir: "",
        dataDir: "",
      });
    }
    return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [filteredSessions, isDesktop, store.folders]);

  const selectChat = async (key: string, workspaceFolderId?: string | null) => {
    const actualFolderId = workspaceFolderId === DEFAULT_WORKSPACE_FOLDER_ID
      ? null
      : workspaceFolderId ?? null;
    if (actualFolderId) {
      if (actualFolderId !== store.activeFolderId) {
        await selectFolder(actualFolderId);
      }
    } else if (store.activeFolderId) {
      await selectFolder(null);
    }
    props.onSelectPanel("chat");
    props.onSelect(key);
  };

  const selectWorkspaceFolder = async (folderId: string) => {
    const actualFolderId = folderId === DEFAULT_WORKSPACE_FOLDER_ID ? null : folderId;
    if (actualFolderId !== store.activeFolderId) {
      await selectFolder(actualFolderId);
    }
    props.onSelectPanel("chat");
    props.onSelect(null, actualFolderId);
  };

  const createWorkspaceChat = (folderId: string) => {
    return props.onCreateChat(folderId === DEFAULT_WORKSPACE_FOLDER_ID ? "default" : folderId);
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
              onClick={() => props.onSelectPanel("mcp")}
            />
            <SidebarNavButton
              icon={Puzzle}
              label={t("sidebar.nav.skills")}
              active={props.activePanel === "skills"}
              onClick={() => props.onSelectPanel("skills")}
            />
          </div>
        ) : null}
      </div>

      {isDesktop ? (
        <div className={cn("min-h-0 flex-1 overflow-y-auto border-y py-2", sb.border)}>
          <WorkspaceChatSection
            folders={derivedWorkspaceFolders}
            sessions={workspaceSessions}
            activeKey={props.activeKey}
            activeFolderId={store.activeFolderId}
            loading={workspaceLoading}
            onSelectChat={selectChat}
            onRequestDelete={props.onRequestDelete}
            onCreateChat={createWorkspaceChat}
            onImportFolder={() => void importFolder()}
            onSelectFolder={(id) => void selectWorkspaceFolder(id)}
            compact
          />
        </div>
      ) : null}

      {!isDesktop ? (
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <WorkspaceChatSection
            folders={derivedWorkspaceFolders}
            sessions={filteredSessions}
            activeKey={props.activeKey}
            activeFolderId={null}
            loading={props.loading}
            onSelectChat={selectChat}
            onRequestDelete={props.onRequestDelete}
            compact
          />
        </div>
      ) : null}

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
