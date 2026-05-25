import { useMemo, useState } from "react";
import {
  Check,
  ChevronRight,
  Folder,
  FolderOpen,
  Loader2,
  MoreHorizontal,
  Trash2,
} from "lucide-react";
import { useTranslation } from "react-i18next";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { deriveTitle, relativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ChatSummary, WorkspaceFolder } from "@catbuddy/shared";

const COLLAPSED_CHAT_LIMIT = 3;

interface WorkspaceChatSectionProps {
  folders: WorkspaceFolder[];
  sessions: ChatSummary[];
  activeKey: string | null;
  loading?: boolean;
  onSelectChat: (key: string) => void;
  onRequestDelete: (key: string, label: string) => void;
  compact?: boolean;
}

export function WorkspaceChatSection({
  folders,
  sessions,
  activeKey,
  loading = false,
  onSelectChat,
  onRequestDelete,
  compact = false,
}: WorkspaceChatSectionProps) {
  const { t } = useTranslation();

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
      <div className="flex items-center gap-2 px-3 py-2 text-[12px] text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
        {t("workspace.loading")}
      </div>
    );
  }

  if (folders.length === 0) {
    return (
      <p className="px-3 py-2 text-[12px] leading-relaxed text-muted-foreground/80">
        {t("workspace.emptyHint")}
      </p>
    );
  }

  return (
    <div className={cn("min-w-0", compact ? "px-1" : "px-2")}>
      {!compact ? (
        <p className="mb-2 px-1 text-[13px] font-semibold text-sidebar-foreground/90">
          {t("sidebar.nav.workspace")}
        </p>
      ) : null}
      <ul className="space-y-1" role="tree">
        {folders.map((folder) => (
          <FolderGroup
            key={folder.id}
            folder={folder}
            sessions={sessionsByFolder.get(folder.id) ?? []}
            activeKey={activeKey}
            onSelectChat={onSelectChat}
            onRequestDelete={onRequestDelete}
          />
        ))}
      </ul>
    </div>
  );
}

function FolderGroup({
  folder,
  sessions,
  activeKey,
  onSelectChat,
  onRequestDelete,
}: {
  folder: WorkspaceFolder;
  sessions: ChatSummary[];
  activeKey: string | null;
  onSelectChat: (key: string) => void;
  onRequestDelete: (key: string, label: string) => void;
}) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(true);
  const [showAll, setShowAll] = useState(false);

  const visible = showAll ? sessions : sessions.slice(0, COLLAPSED_CHAT_LIMIT);
  const hiddenCount = Math.max(0, sessions.length - COLLAPSED_CHAT_LIMIT);

  return (
    <li role="treeitem" aria-expanded={expanded}>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full min-w-0 items-center gap-1.5 rounded-lg px-2 py-1.5 text-left text-[13px] font-medium text-sidebar-foreground/88 transition-colors hover:bg-sidebar-accent/60"
      >
        <ChevronRight
          className={cn(
            "h-3.5 w-3.5 shrink-0 text-muted-foreground/70 transition-transform",
            expanded && "rotate-90",
          )}
          aria-hidden
        />
        {expanded ? (
          <FolderOpen className="h-4 w-4 shrink-0 text-muted-foreground/75" aria-hidden />
        ) : (
          <Folder className="h-4 w-4 shrink-0 text-muted-foreground/75" aria-hidden />
        )}
        <span className="truncate">{folder.name}</span>
      </button>

      {expanded && sessions.length > 0 ? (
        <ul className="mt-0.5 space-y-0.5 pl-3" role="group">
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
                className="w-full rounded-lg px-2 py-1.5 text-left text-[12px] text-muted-foreground/75 transition-colors hover:bg-sidebar-accent/45 hover:text-sidebar-foreground/85"
              >
                {t("workspace.expandMore", { count: hiddenCount })}
              </button>
            </li>
          ) : null}
        </ul>
      ) : null}

      {expanded && sessions.length === 0 ? (
        <p className="px-2 py-1 text-[11px] text-muted-foreground/65">
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
  const time = relativeTime(session.updatedAt ?? session.createdAt);

  return (
    <li className="min-w-0">
      <div
        className={cn(
          "group flex min-h-8 min-w-0 items-center gap-1.5 rounded-lg px-2 py-1 text-[12px] transition-colors",
          active
            ? "bg-sidebar-accent/70 text-sidebar-accent-foreground"
            : "text-sidebar-foreground/78 hover:bg-sidebar-accent/50",
        )}
      >
        <Check
          className="h-3.5 w-3.5 shrink-0 text-muted-foreground/55"
          aria-hidden
        />
        <button
          type="button"
          onClick={onSelect}
          title={label}
          className="min-w-0 flex-1 overflow-hidden text-left"
        >
          <span className="block truncate">{label}</span>
        </button>
        {time ? (
          <span className="shrink-0 text-[10px] text-muted-foreground/60">{time}</span>
        ) : null}
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger
            className={cn(
              "inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted-foreground/70 opacity-0 transition-opacity",
              "hover:bg-sidebar-accent hover:text-sidebar-foreground group-hover:opacity-100",
              active && "opacity-100",
            )}
            aria-label={t("chat.actions", { title: label })}
          >
            <MoreHorizontal className="h-3.5 w-3.5" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" onCloseAutoFocus={(e) => e.preventDefault()}>
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
    </li>
  );
}
