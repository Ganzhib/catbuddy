import { useTranslation } from "react-i18next";

import { McpSettings } from "@/components/settings/McpSettings";
import { PanelShell } from "@/components/panels/PanelShell";

interface McpMarketplacePanelProps {
  onBackToChat: () => void;
}

export function McpMarketplacePanel({ onBackToChat }: McpMarketplacePanelProps) {
  const { t } = useTranslation();

  return (
    <PanelShell
      title={t("sidebar.nav.mcp")}
      subtitle={t("panels.mcp.subtitle")}
      onBackToChat={onBackToChat}
    >
      <McpSettings variant="panel" />
    </PanelShell>
  );
}
