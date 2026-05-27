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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { deriveTitle } from "@/lib/format";
import { sb, sbSectionTitle } from "@/lib/sidebar-styles";
import { cn } from "@/lib/utils";
import type { ChatSummary, WorkspaceFolder } from "@catbuddy/shared";

const COLLAPSED_CHAT_LIMIT = 3;

interface WorkspaceChatSectionProps {
  folders: WorkspaceFolder[];
  sessions: ChatSummary[];
  activeKey: string | null;
  activeFolderId?: string | null;
  loading?: boolean;
  onSelectChat: (key: string, workspaceFolderId?: string) => void;
  onRequestDelete: (key: string, label: string) => void;
  onImportFolder?: () => void | Promise<void>;
  onRemoveFolder?: (folderId: string) => void | Promise<void>;
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
  onImportFolder,
  onRemoveFolder,
  onSelectFolder,
  compact = false,
}: WorkspaceChatSectionProps) {
  const { t } = useTranslation();
  const [sectionExpanded, setSectionExpanded] = useState(true);

  const sessionsByFolder = useMemo(() => {
    const map = new Map<string, ChatSummary[]>();
    for (const folder of folders) {
      map.set(folder.id, []);
    }
    for (const session of sessions) {
      const folderId = session.workspaceFolderId;
      if (!folderId || !map.has(folderId)) continue;
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
  }, [folders, sessions]);

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
        folders.length === 0 ? (
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
            {folders.map((folder) => (
              <FolderGroup
                key={folder.id}
                folder={folder}
                sessions={sessionsByFolder.get(folder.id) ?? []}
                activeKey={activeKey}
                isActiveFolder={folder.id === activeFolderId}
                onSelectChat={onSelectChat}
                onRemoveFolder={onRemoveFolder}
                onSelectFolder={onSelectFolder}
                onImportFolder={onImportFolder}
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
  onSelectChat,
  onRemoveFolder,
  onSelectFolder,
  onImportFolder,
}: {
  folder: WorkspaceFolder;
  sessions: ChatSummary[];
  activeKey: string | null;
  isActiveFolder: boolean;
  onSelectChat: (key: string, workspaceFolderId?: string) => void;
  onRemoveFolder?: (folderId: string) => void | Promise<void>;
  onSelectFolder?: (folderId: string) => void | Promise<void>;
  onImportFolder?: () => void | Promise<void>;
}) {
  const { t } = useTranslation();
  const [hovered, setHovered] = useState(false);
  const [expanded, setExpanded] = useState(false);
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
        <div className="flex min-w-0 flex-1 items-center gap-1.5">
          <button
            type="button"
            onClick={() => {
              if (onSelectFolder) void onSelectFolder(folder.id);
            }}
            className={cn(
              "flex min-w-0 flex-1 items-center gap-1.5 text-left text-[14px]",
              isActiveFolder ? "font-medium" : "font-normal",
              sb.text,
            )}
          >
            <Folder className={cn("h-4 w-4 shrink-0 stroke-[1.5]", sb.icon)} aria-hidden />
            <span className="truncate">{folder.name}</span>
          </button>
          {hasSessions && hovered ? (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className={cn(
                "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md",
                sb.icon,
                sb.iconButtonHover,
              )}
              aria-expanded={expanded}
              aria-label={t("workspace.toggleFolderChats", { name: folder.name })}
            >
              <ChevronRight
                className={cn(
                  "h-3.5 w-3.5 transition-transform duration-200",
                  expanded && "rotate-90",
                )}
                aria-hidden
              />
            </button>
          ) : null}
        </div>

        {hovered ? (
          <div className="flex shrink-0 items-center">
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger
              className={cn(
                "inline-flex h-7 w-7 items-center justify-center rounded-md transition-colors duration-200",
                sb.iconMuted,
                sb.iconHover,
                sb.iconButtonHover,
              )}
              aria-label={t("workspace.folderActions.menu", { name: folder.name })}
              onClick={(e) => e.stopPropagation()}
            >
              <MoreHorizontal className="h-4 w-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" onCloseAutoFocus={(e) => e.preventDefault()}>
              {onSelectFolder ? (
                <DropdownMenuItem onSelect={() => void onSelectFolder(folder.id)}>
                  {t("workspace.folderActions.setActive")}
                </DropdownMenuItem>
              ) : null}
              {onImportFolder ? (
                <DropdownMenuItem onSelect={() => void onImportFolder()}>
                  <FolderPlus className="mr-2 h-4 w-4" />
                  {t("workspace.importFolder")}
                </DropdownMenuItem>
              ) : null}
              {(onSelectFolder || onImportFolder) && onRemoveFolder ? (
                <DropdownMenuSeparator />
              ) : null}
              {onRemoveFolder ? (
                <DropdownMenuItem
                  onSelect={() => void onRemoveFolder(folder.id)}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  {t("workspace.folderActions.remove")}
                </DropdownMenuItem>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>

          {onImportFolder ? (
            <button
              type="button"
              onClick={() => void onImportFolder()}
              className={cn(
                "inline-flex h-7 w-7 items-center justify-center rounded-md transition-colors duration-200",
                sb.iconMuted,
                sb.iconHover,
                sb.iconButtonHover,
              )}
              aria-label={t("workspace.importFolder")}
            >
              <Plus className="h-4 w-4" />
            </button>
          ) : null}
          </div>
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
}: {
  session: ChatSummary;
  active: boolean;
  onSelect: () => void;
}) {
  const { t } = useTranslation();
  const title = session.title?.trim() || deriveTitle(session.preview, t("chat.newChat"));
  const label = deriveTitle(session.preview, title);

  return (
    <li className="min-w-0">
      <button
        type="button"
        onClick={onSelect}
        title={label}
        className={cn(
          "flex min-h-8 w-full min-w-0 items-center rounded-lg px-2 py-1.5 text-left text-[13px] transition-colors duration-200",
          active ? cn(sb.active, "font-medium") : cn(sb.text, sb.bubbleHover),
        )}
      >
        <span className="min-w-0 flex-1 truncate">{label}</span>
      </button>
    </li>
  );
}
