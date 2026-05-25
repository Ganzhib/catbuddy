import { useTranslation } from "react-i18next";

import { SkillSettings } from "@/components/settings/SkillSettings";
import { PanelShell } from "@/components/panels/PanelShell";

interface SkillMarketplacePanelProps {
  onBackToChat: () => void;
}

export function SkillMarketplacePanel({ onBackToChat }: SkillMarketplacePanelProps) {
  const { t } = useTranslation();

  return (
    <PanelShell
      title={t("sidebar.nav.skills")}
      subtitle={t("panels.skills.subtitle")}
      onBackToChat={onBackToChat}
    >
      <SkillSettings variant="panel" />
    </PanelShell>
  );
}
