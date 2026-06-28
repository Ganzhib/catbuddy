import { MoreHorizontal, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { deriveTitle } from "@/lib/format";
import { sb, sbGroupLabel } from "@/lib/sidebar-styles";
import { cn } from "@/lib/utils";
import type { ChatSummary } from "@catbuddy/shared";

interface ChatListProps {
  sessions: ChatSummary[];
  activeKey: string | null;
  onSelect: (key: string) => void;
  onRequestDelete: (key: string, label: string) => void;
  loading?: boolean;
  emptyLabel?: string;
}

export function ChatList({
  sessions,
  activeKey,
  onSelect,
  onRequestDelete,
  loading,
  emptyLabel,
}: ChatListProps) {
  const { t } = useTranslation();
  if (loading && sessions.length === 0) {
    return (
      <div className={cn("py-8 text-[14px]", sb.px, sb.textMuted)}>
        {t("chat.loading")}
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div className={cn("py-8 text-[14px] leading-6", sb.px, sb.textMuted)}>
        {emptyLabel ?? t("chat.noSessions")}
      </div>
    );
  }

  const groups = groupSessions(sessions, {
    today: t("chat.groups.today"),
    yesterday: t("chat.groups.yesterday"),
    earlier: t("chat.groups.earlier"),
  });

  return (
    <div className="h-full min-h-0 min-w-0 overflow-x-hidden overflow-y-auto overscroll-contain scrollbar-none">
      <div className={cn("min-w-0 space-y-4 py-2", sb.px)}>
        {groups.map((group) => (
          <section key={group.label} aria-label={group.label}>
            <div className={cn("mb-2", sbGroupLabel)}>{group.label}</div>
            <ul className="space-y-2">
              {group.sessions.map((s) => {
                const active = s.key === activeKey;
                const fallbackTitle = t("chat.fallbackTitle", {
                  id: s.chatId.slice(0, 6),
                });
                const generatedTitle = s.title?.trim() || "";
                const title =
                  generatedTitle || deriveTitle(s.preview, t("chat.newChat"));
                const tooltipTitle =
                  generatedTitle || deriveTitle(s.preview, fallbackTitle);
                return (
                  <li key={s.key} className="min-w-0">
                    <div
                      className={cn(
                        "group flex min-w-0 max-w-full items-stretch rounded-lg text-[14px] transition-colors duration-200",
                        active ? sb.active : cn(sb.surface, sb.bubbleHover),
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => onSelect(s.key)}
                        title={tooltipTitle}
                        className={cn(
                          "min-w-0 flex-1 rounded-lg px-3 py-3 text-left",
                          sb.text,
                        )}
                      >
                        <span className="block w-full truncate leading-[1.4]">{title}</span>
                      </button>
                      <div className="flex shrink-0 items-center pr-2">
                        <DropdownMenu modal={false}>
                          <DropdownMenuTrigger
                            className={cn(
                              "inline-flex h-8 w-8 items-center justify-center rounded-md transition-colors duration-200",
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
                                window.setTimeout(() => onRequestDelete(s.key, title), 0);
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
              })}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}

function groupSessions(
  sessions: ChatSummary[],
  labels: { today: string; yesterday: string; earlier: string },
): Array<{ label: string; sessions: ChatSummary[] }> {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfYesterday = startOfToday - 24 * 60 * 60 * 1000;
  const buckets = new Map<string, ChatSummary[]>();

  for (const session of sessions) {
    const timestamp = Date.parse(session.updatedAt ?? session.createdAt ?? "");
    const label = Number.isFinite(timestamp) && timestamp >= startOfToday
      ? labels.today
      : Number.isFinite(timestamp) && timestamp >= startOfYesterday
        ? labels.yesterday
        : labels.earlier;
    const bucket = buckets.get(label) ?? [];
    bucket.push(session);
    buckets.set(label, bucket);
  }

  return [labels.today, labels.yesterday, labels.earlier]
    .map((label) => ({ label, sessions: buckets.get(label) ?? [] }))
    .filter((group) => group.sessions.length > 0);
}
