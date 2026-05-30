import { useMemo, useState } from "react";
import {
  ChevronRight,
  Folder,
  FolderPlus,
  Loader2,
  MoreHorizontal,
  Plus,
  Trash2,
} from "lucide-react";
import { useTranslation } from "react-i18next";

import { SidebarSectionHeader } from "@/components/SidebarSectionHeader";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { deriveTitle } from "@/lib/format";
import { sb, sbSectionTitle } from "@/lib/sidebar-styles";
import { cn } from "@/lib/utils";
import type { ChatSummary, WorkspaceFolder } from "@catbuddy/shared";

const COLLAPSED_CHAT_LIMIT = 3;
export const DEFAULT_WORKSPACE_FOLDER_ID = "__catbuddy_default_workspace__";

function createDefaultWorkspaceFolder(name: string): WorkspaceFolder {
  return {
    id: DEFAULT_WORKSPACE_FOLDER_ID,
    name,
    createdAt: "",
    projectRoot: "",
    catbuddyDir: "",
    dataDir: "",
  };
}

interface WorkspaceChatSectionProps {
  folders: WorkspaceFolder[];
  sessions: ChatSummary[];
  activeKey: string | null;
  activeFolderId?: string | null;
  loading?: boolean;
  onSelectChat: (key: string, workspaceFolderId?: string) => void;
  onRequestDelete: (key: string, label: string) => void;
  onCreateChat?: (workspaceFolderId: string) => unknown;
  onImportFolder?: () => void | Promise<void>;
  onSelectFolder?: (folderId: string) => void | Promise<void>;
  compact?: boolean;
}

export function WorkspaceChatSection({
  folders,
  sessions,
  activeKey,
  activeFolderId = null,
  loading = false,
  onSelectChat,
  onRequestDelete,
  onCreateChat,
  onImportFolder,
  onSelectFolder,
  compact = false,
}: WorkspaceChatSectionProps) {
  const { t } = useTranslation();
  const [sectionExpanded, setSectionExpanded] = useState(true);
  const [expandedFolderIds, setExpandedFolderIds] = useState<Set<string>>(() => new Set());

  const displayFolders = useMemo(
    () => [createDefaultWorkspaceFolder(t("workspace.defaultWorkspace")), ...folders],
    [folders, t],
  );

  const sessionsByFolder = useMemo(() => {
    const map = new Map<string, ChatSummary[]>();
    for (const folder of displayFolders) {
      map.set(folder.id, []);
    }
    for (const session of sessions) {
      const folderId = session.workspaceFolderId ?? DEFAULT_WORKSPACE_FOLDER_ID;
      if (!map.has(folderId)) continue;
      map.get(folderId)!.push(session);
    }
    for (const list of map.values()) {
      list.sort((a, b) =>
        (b.updatedAt ?? b.createdAt ?? "").localeCompare(
          a.updatedAt ?? a.createdAt ?? "",
        ),
      );
    }
    return map;
  }, [displayFolders, sessions]);

  if (loading) {
    return (
      <div className={cn("flex items-center gap-2 py-2 text-[12px]", sb.px, sb.textMuted)}>
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        {t("workspace.loading")}
      </div>
    );
  }

  const importButton = onImportFolder ? (
    <button
      type="button"
      onClick={() => void onImportFolder()}
      className={cn(
        "inline-flex h-8 w-8 items-center justify-center rounded-md transition-colors duration-200",
        sb.icon,
        sb.iconButtonHover,
      )}
      aria-label={t("workspace.importFolder")}
    >
      <FolderPlus className="h-4 w-4" aria-hidden />
    </button>
  ) : null;

  return (
    <div className={cn("min-w-0", compact ? "py-1" : "px-2")}>
      {compact ? (
        <SidebarSectionHeader
          title={t("sidebar.nav.workspace")}
          expanded={sectionExpanded}
          onToggle={() => setSectionExpanded((v) => !v)}
          trailing={importButton}
        />
      ) : (
        <p className={cn("mb-2 px-1", sbSectionTitle)}>{t("sidebar.nav.workspace")}</p>
      )}

      {sectionExpanded ? (
        displayFolders.length === 0 ? (
          <div className={cn("space-y-2 px-3 py-2", compact ? "mt-1" : "mt-3")}>
            <p className={cn("text-[12px] leading-relaxed", sb.textMuted)}>
              {t("workspace.emptyHint")}
            </p>
            {onImportFolder ? (
              <button
                type="button"
                onClick={() => void onImportFolder()}
                className={cn(
                  "flex w-full items-center gap-2 rounded px-2 py-2 text-[14px]",
                  sb.text,
                  sb.hover,
                )}
              >
                <FolderPlus className={cn("h-4 w-4 shrink-0", sb.icon)} />
                {t("workspace.importFolder")}
              </button>
            ) : null}
          </div>
        ) : (
          <ul className={cn("space-y-0.5 pb-1", compact ? "mt-0.5 px-1" : "mt-3")} role="tree">
            {displayFolders.map((folder) => (
              <FolderGroup
                key={folder.id}
                folder={folder}
                sessions={sessionsByFolder.get(folder.id) ?? []}
                activeKey={activeKey}
                isActiveFolder={folder.id === (activeFolderId ?? DEFAULT_WORKSPACE_FOLDER_ID)}
                expanded={expandedFolderIds.has(folder.id)}
                onToggleExpanded={() => {
                  setExpandedFolderIds((current) => {
                    const next = new Set(current);
                    if (next.has(folder.id)) next.delete(folder.id);
                    else next.add(folder.id);
                    return next;
                  });
                }}
                onSelectChat={onSelectChat}
                onRequestDelete={onRequestDelete}
                onCreateChat={onCreateChat}
                onSelectFolder={onSelectFolder}
              />
            ))}
          </ul>
        )
      ) : null}
    </div>
  );
}

function FolderGroup({
  folder,
  sessions,
  activeKey,
  isActiveFolder,
  expanded,
  onToggleExpanded,
  onSelectChat,
  onRequestDelete,
  onCreateChat,
  onSelectFolder,
}: {
  folder: WorkspaceFolder;
  sessions: ChatSummary[];
  activeKey: string | null;
  isActiveFolder: boolean;
  expanded: boolean;
  onToggleExpanded: () => void;
  onSelectChat: (key: string, workspaceFolderId?: string) => void;
  onRequestDelete: (key: string, label: string) => void;
  onCreateChat?: (workspaceFolderId: string) => unknown;
  onSelectFolder?: (folderId: string) => void | Promise<void>;
}) {
  const { t } = useTranslation();
  const [hovered, setHovered] = useState(false);
  const [showAll, setShowAll] = useState(false);

  const visible = showAll ? sessions : sessions.slice(0, COLLAPSED_CHAT_LIMIT);
  const hiddenCount = Math.max(0, sessions.length - COLLAPSED_CHAT_LIMIT);
  const hasSessions = sessions.length > 0;

  return (
    <li role="treeitem" aria-expanded={expanded}>
      <div
        className={cn(
          "flex min-w-0 items-center gap-0.5 rounded-lg px-2 py-1.5 transition-colors duration-200",
          "hover:bg-[#E0F0FF]/50 dark:hover:bg-sidebar-accent/35",
        )}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <button
          type="button"
          onClick={() => {
            if (hasSessions) onToggleExpanded();
            if (!isActiveFolder && onSelectFolder) void onSelectFolder(folder.id);
          }}
          className={cn(
            "flex min-w-0 flex-1 items-center gap-1.5 text-left text-[14px]",
            isActiveFolder ? "font-medium" : "font-normal",
            sb.text,
          )}
          aria-expanded={hasSessions ? expanded : undefined}
          aria-label={hasSessions ? t("workspace.toggleFolderChats", { name: folder.name }) : folder.name}
        >
          <Folder className={cn("h-4 w-4 shrink-0 stroke-[1.5]", sb.icon)} aria-hidden />
          <span className="min-w-0 flex-1 truncate">{folder.name}</span>
          {hasSessions ? (
            <ChevronRight
              className={cn(
                "h-3.5 w-3.5 shrink-0 transition-transform duration-200",
                expanded && "rotate-90",
              )}
              aria-hidden
            />
          ) : null}
        </button>

        {hovered && onCreateChat ? (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              setShowAll(false);
              if (!expanded) onToggleExpanded();
              void onCreateChat(folder.id);
            }}
            className={cn(
              "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-colors duration-200",
              sb.iconMuted,
              sb.iconHover,
              sb.iconButtonHover,
            )}
            aria-label={t("sidebar.newChat")}
          >
            <Plus className="h-4 w-4" />
          </button>
        ) : null}
      </div>

      {expanded && hasSessions ? (
        <ul className="mt-0.5 space-y-0.5 pl-7" role="group">
          {visible.map((session) => (
            <ChatRow
              key={session.key}
              session={session}
              active={session.key === activeKey}
              onSelect={() => onSelectChat(session.key, folder.id)}
              onRequestDelete={onRequestDelete}
            />
          ))}
          {!showAll && hiddenCount > 0 ? (
            <li>
              <button
                type="button"
                onClick={() => setShowAll(true)}
                className={cn(
                  "w-full rounded-lg px-2 py-1.5 text-left text-[12px] transition-colors duration-200",
                  sb.textMuted,
                  cn(sb.hover, "hover:text-[#666]"),
                )}
              >
                {t("workspace.expandMore", { count: hiddenCount })}
              </button>
            </li>
          ) : null}
        </ul>
      ) : null}
    </li>
  );
}

function ChatRow({
  session,
  active,
  onSelect,
  onRequestDelete,
}: {
  session: ChatSummary;
  active: boolean;
  onSelect: () => void;
  onRequestDelete: (key: string, label: string) => void;
}) {
  const { t } = useTranslation();
  const title = session.title?.trim() || deriveTitle(session.preview, t("chat.newChat"));
  const label = deriveTitle(session.preview, title);

  return (
    <li className="min-w-0">
      <div
        className={cn(
          "group flex min-h-8 w-full min-w-0 items-stretch rounded-lg text-[13px] transition-colors duration-200",
          active ? cn(sb.active, "font-medium") : cn(sb.text, sb.bubbleHover),
        )}
      >
        <button
          type="button"
          onClick={onSelect}
          title={label}
          className="min-w-0 flex-1 rounded-lg px-2 py-1.5 text-left"
        >
          <span className="block min-w-0 truncate">{label}</span>
        </button>
        <div className="flex shrink-0 items-center pr-1 opacity-0 transition-opacity duration-200 group-hover:opacity-100 focus-within:opacity-100">
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger
              className={cn(
                "inline-flex h-7 w-7 items-center justify-center rounded-md transition-colors duration-200",
                sb.iconMuted,
                sb.iconHover,
                sb.iconButtonHover,
              )}
              aria-label={t("chat.actions", { title })}
            >
              <MoreHorizontal className="h-4 w-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              onCloseAutoFocus={(event) => event.preventDefault()}
            >
              <DropdownMenuItem
                onSelect={() => {
                  window.setTimeout(() => onRequestDelete(session.key, label), 0);
                }}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                {t("chat.delete")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </li>
  );
}
