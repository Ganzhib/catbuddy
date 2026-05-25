import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, Upload } from "lucide-react";

import { PanelShell } from "@/components/panels/PanelShell";
import { WorkspaceChatSection } from "@/components/workspace/WorkspaceChatSection";
import { Button } from "@/components/ui/button";
import { useWorkspaceFolders } from "@/hooks/useWorkspaceFolders";
import type { ChatSummary } from "@catbuddy/shared";

interface WorkspacePanelProps {
  sessions: ChatSummary[];
  activeKey: string | null;
  onSelectChat: (key: string) => void;
  onRequestDelete: (key: string, label: string) => void;
  onBackToChat: () => void;
}

export function WorkspacePanel({
  sessions,
  activeKey,
  onSelectChat,
  onRequestDelete,
  onBackToChat,
}: WorkspacePanelProps) {
  const { t } = useTranslation();
  const { store, loading, error, importFolder } = useWorkspaceFolders();
  const [importing, setImporting] = useState(false);

  const workspaceSessions = sessions.filter((s) => !!s.workspaceFolderId);

  const handleImport = useCallback(async () => {
    setImporting(true);
    try {
      await importFolder();
    } finally {
      setImporting(false);
    }
  }, [importFolder]);

  return (
    <PanelShell
      title={t("sidebar.nav.workspace")}
      subtitle={t("workspace.panelSubtitle")}
      onBackToChat={onBackToChat}
    >
      <div className="space-y-4">
        {error ? (
          <div className="rounded-[16px] border border-destructive/20 bg-destructive/5 px-4 py-3 text-[13px] text-destructive">
            {error}
          </div>
        ) : null}

        <div className="flex justify-end">
          <Button
            type="button"
            size="sm"
            className="rounded-full"
            disabled={importing}
            onClick={() => void handleImport()}
          >
            {importing ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            ) : (
              <Upload className="mr-1.5 h-4 w-4" />
            )}
            {t("workspace.importFolder")}
          </Button>
        </div>

        <section className="rounded-[20px] border border-border/40 bg-card/60 p-3 shadow-[0_8px_32px_rgba(15,23,42,0.05)]">
          <WorkspaceChatSection
            folders={store.folders}
            sessions={workspaceSessions}
            activeKey={activeKey}
            loading={loading}
            onSelectChat={onSelectChat}
            onRequestDelete={onRequestDelete}
          />
        </section>
      </div>
    </PanelShell>
  );
}
