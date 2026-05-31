import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, Upload } from "lucide-react";

import { PanelShell } from "@/components/panels/PanelShell";
import { WorkspaceChatSection, DEFAULT_WORKSPACE_FOLDER_ID } from "@/components/workspace/WorkspaceChatSection";
import { Button } from "@/components/ui/button";
import { useWorkspaceFolders } from "@/hooks/useWorkspaceFolders";
import { panelBtnPrimary, panelSection } from "@/lib/panel-styles";
import { cn } from "@/lib/utils";
import type { ChatSummary } from "@catbuddy/shared";

interface WorkspacePanelProps {
  sessions: ChatSummary[];
  activeKey: string | null;
  onSelectChat: (key: string | null, workspaceFolderId?: string | null) => void;
  onRequestDelete: (key: string, label: string) => void;
  onCreateChat: (workspaceFolderId: string | null) => unknown;
  onBackToChat: () => void;
}

export function WorkspacePanel({
  sessions,
  activeKey,
  onSelectChat,
  onRequestDelete,
  onCreateChat,
  onBackToChat,
}: WorkspacePanelProps) {
  const { t } = useTranslation();
  const { store, loading, error, importFolder, selectFolder } = useWorkspaceFolders();
  const [importing, setImporting] = useState(false);

  const workspaceSessions = sessions;

  const handleImport = useCallback(async () => {
    setImporting(true);
    try {
      await importFolder();
    } finally {
      setImporting(false);
    }
  }, [importFolder]);

  const handleSelectChat = useCallback(
    async (key: string, workspaceFolderId?: string | null) => {
      if (workspaceFolderId) {
        if (workspaceFolderId !== store.activeFolderId) {
          await selectFolder(workspaceFolderId);
        }
      } else if (store.activeFolderId) {
        await selectFolder(null);
      }
      onSelectChat(key, workspaceFolderId ?? null);
    },
    [onSelectChat, selectFolder, store.activeFolderId],
  );

  const handleSelectFolder = useCallback(
    async (folderId: string | null) => {
      if (folderId !== store.activeFolderId) {
        await selectFolder(folderId);
      }
      onSelectChat(null, folderId);
    },
    [onSelectChat, selectFolder, store.activeFolderId],
  );

  const createWorkspaceChat = useCallback(
    (folderId: string) => onCreateChat(folderId === DEFAULT_WORKSPACE_FOLDER_ID ? null : folderId),
    [onCreateChat],
  );

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
            className={panelBtnPrimary}
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

        <section className={cn(panelSection, "p-3")}>
          <WorkspaceChatSection
            folders={store.folders}
            sessions={workspaceSessions}
            activeKey={activeKey}
            activeFolderId={store.activeFolderId}
            loading={loading}
            onSelectChat={(key, folderId) => void handleSelectChat(key, folderId === DEFAULT_WORKSPACE_FOLDER_ID ? null : folderId)}
            onRequestDelete={onRequestDelete}
            onCreateChat={createWorkspaceChat}
            onImportFolder={() => void importFolder()}
            onSelectFolder={(id) => void handleSelectFolder(id === DEFAULT_WORKSPACE_FOLDER_ID ? null : id)}
          />
        </section>
      </div>
    </PanelShell>
  );
}
