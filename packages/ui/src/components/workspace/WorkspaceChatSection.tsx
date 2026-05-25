import { useMemo, useState } from "react";
import {
  Check,
  ChevronRight,
  Folder,
  FolderOpen,
  FolderPlus,
  Loader2,
  MoreVertical,
  Trash2,
} from "lucide-react";
import { useTranslation } from "react-i18next";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { deriveTitle, relativeTime } from "@/lib/format";
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
  onSelectChat: (key: string) => void;
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
  onRequestDelete,
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

  const sectionHeader = compact ? (
    <button
      type="button"
      onClick={() => setSectionExpanded((v) => !v)}
      aria-expanded={sectionExpanded}
      className={cn(
        "flex h-10 w-full items-center gap-2 rounded-lg px-3 text-left",
        sbSectionTitle,
        "transition-colors duration-200 hover:bg-[#F5F5F5]/80 dark:hover:bg-sidebar-accent/45",
      )}
    >
      <ChevronRight
        className={cn(
          "h-4 w-4 shrink-0 transition-transform duration-300 ease-in-out",
          sb.icon,
          sectionExpanded && "rotate-90",
        )}
        aria-hidden
      />
      <span className="min-w-0 flex-1 truncate">{t("sidebar.nav.workspace")}</span>
    </button>
  ) : (
    <p className={cn("mb-2 px-1", sbSectionTitle)}>{t("sidebar.nav.workspace")}</p>
  );

  return (
    <div className={cn("min-w-0", compact ? "px-2 py-1" : "px-2")}>
      {sectionHeader}

      {sectionExpanded ? (
        folders.length === 0 ? (
          <div className={cn("space-y-2 px-3 py-2", "mt-3")}>
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
                  "transition-colors duration-200 hover:bg-[#F5F5F5]/80 dark:hover:bg-sidebar-accent/45",
                )}
              >
                <FolderPlus className={cn("h-4 w-4 shrink-0", sb.icon)} />
                {t("workspace.importFolder")}
              </button>
            ) : null}
          </div>
        ) : (
          <ul className="mt-3 space-y-2 pb-1" role="tree">
            {folders.map((folder) => (
              <FolderGroup
                key={folder.id}
                folder={folder}
                sessions={sessionsByFolder.get(folder.id) ?? []}
                activeKey={activeKey}
                isActiveFolder={folder.id === activeFolderId}
                onSelectChat={onSelectChat}
                onRequestDelete={onRequestDelete}
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
  onRequestDelete,
  onRemoveFolder,
  onSelectFolder,
  onImportFolder,
}: {
  folder: WorkspaceFolder;
  sessions: ChatSummary[];
  activeKey: string | null;
  isActiveFolder: boolean;
  onSelectChat: (key: string) => void;
  onRequestDelete: (key: string, label: string) => void;
  onRemoveFolder?: (folderId: string) => void | Promise<void>;
  onSelectFolder?: (folderId: string) => void | Promise<void>;
  onImportFolder?: () => void | Promise<void>;
}) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(true);
  const [showAll, setShowAll] = useState(false);

  const visible = showAll ? sessions : sessions.slice(0, COLLAPSED_CHAT_LIMIT);
  const hiddenCount = Math.max(0, sessions.length - COLLAPSED_CHAT_LIMIT);

  return (
    <li role="treeitem" aria-expanded={expanded}>
      <div className="group flex min-w-0 items-center gap-1 rounded-lg pr-1 transition-colors duration-200 hover:bg-[#F5F5F5]/60 dark:hover:bg-sidebar-accent/40">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className={cn(
            "flex min-w-0 flex-1 items-center gap-2 px-2 py-2 text-left text-[14px]",
            "transition-colors",
            isActiveFolder ? "font-semibold" : "font-normal",
            sb.text,
          )}
        >
          {expanded ? (
            <FolderOpen className={cn("h-4 w-4 shrink-0", sb.icon)} aria-hidden />
          ) : (
            <Folder className={cn("h-4 w-4 shrink-0", sb.icon)} aria-hidden />
          )}
          <span className="truncate">{folder.name}</span>
        </button>

        <DropdownMenu modal={false}>
          <DropdownMenuTrigger
            className={cn(
              "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md transition-colors duration-200",
              sb.iconMuted,
              sb.iconHover,
              "hover:bg-[#F5F5F5] dark:hover:bg-sidebar-accent/55",
            )}
            aria-label={t("workspace.folderActions.menu", { name: folder.name })}
            onClick={(e) => e.stopPropagation()}
          >
            <MoreVertical className="h-4 w-4" />
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
      </div>

      {expanded && sessions.length > 0 ? (
        <ul className="mt-1 space-y-1 pl-4" role="group">
          {visible.map((session) => (
            <ChatRow
              key={session.key}
              session={session}
              active={session.key === activeKey}
              onSelect={() => onSelectChat(session.key)}
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
                  "hover:bg-[#F5F5F5]/80 hover:text-[#666] dark:hover:bg-sidebar-accent/45",
                )}
              >
                {t("workspace.expandMore", { count: hiddenCount })}
              </button>
            </li>
          ) : null}
        </ul>
      ) : null}

      {expanded && sessions.length === 0 ? (
        <p className={cn("mt-1 px-3 text-[12px]", sb.textMuted)}>
          {t("workspace.folderEmpty")}
        </p>
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
  onRequestDelete: (key: string, label: string) => void;
}) {
  const { t } = useTranslation();
  const title = session.title?.trim() || deriveTitle(session.preview, t("chat.newChat"));
  const label = deriveTitle(session.preview, title);
  const time = relativeTime(session.updatedAt ?? session.createdAt);

  return (
    <li className="min-w-0">
      <button
        type="button"
        onClick={onSelect}
        title={label}
        className={cn(
          "flex min-h-8 w-full min-w-0 items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[14px] transition-colors duration-200",
          active
            ? "bg-[#F0F0F0] font-medium dark:bg-sidebar-accent/70"
            : cn(sb.text, sb.bubbleHover),
        )}
      >
        <Check className={cn("h-4 w-4 shrink-0", sb.iconMuted)} aria-hidden />
        <span className="min-w-0 flex-1 truncate">{label}</span>
        {time ? (
          <span className={cn("shrink-0 text-[12px]", sb.textMuted)}>{time}</span>
        ) : null}
      </button>
    </li>
  );
}
