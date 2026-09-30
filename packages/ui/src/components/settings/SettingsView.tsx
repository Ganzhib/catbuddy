import { useEffect, useState, type ReactNode } from "react";
import {
  Bot,
  CheckCircle2,
  ChevronLeft,
  KeyRound,
  Loader2,
  LogOut,
  RotateCcw,
  Settings,
  type LucideIcon,
} from "lucide-react";
import { useTranslation } from "react-i18next";

import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { ProviderSettingsPanel } from "@/components/providers/ProviderSettingsPanel";
import { activeProvider } from "@/components/providers/provider-contract";
import { useProviderSettings } from "@/components/providers/useProviderSettings";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useClient } from "@/providers/ClientProvider";

type SettingsSectionKey = "general" | "providers";

interface SettingsViewProps {
  theme: "light" | "dark";
  onToggleTheme: () => void;
  onBackToChat: () => void;
  onModelNameChange: (modelName: string | null) => void;
  onLogout?: () => void;
  onRestart?: () => void;
  isRestarting?: boolean;
}

const NAV_ITEMS: ReadonlyArray<{ key: SettingsSectionKey; icon: LucideIcon }> = [
  { key: "general", icon: Settings },
  { key: "providers", icon: KeyRound },
];

export function SettingsView({
  theme,
  onToggleTheme,
  onBackToChat,
  onModelNameChange,
  onLogout,
  onRestart,
  isRestarting = false,
}: SettingsViewProps) {
  const { t } = useTranslation();
  const { token } = useClient();
  const [activeSection, setActiveSection] = useState<SettingsSectionKey>("general");
  const { settings, setSettings, loading, error, refresh } = useProviderSettings(token);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-background lg:flex-row">
      <SettingsNavigation
        activeSection={activeSection}
        onSelectSection={setActiveSection}
        onBackToChat={onBackToChat}
        onLogout={onLogout}
      />

      <main className="min-w-0 flex-1 overflow-y-auto [scrollbar-gutter:stable]">
        <div className="mx-auto w-full max-w-[880px] px-4 py-7 sm:px-7 sm:py-10 lg:px-12 lg:py-14">
          <header className="mb-8 border-b border-border pb-5">
            <p className="text-sm text-muted-foreground">{t("settings.sidebar.title")}</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-[-0.03em] sm:text-3xl">
              {t(`settings.nav.${activeSection}`)}
            </h1>
          </header>

          {loading ? (
            <SettingsSkeleton />
          ) : error || !settings ? (
            <SettingsLoadError error={error} onRetry={() => void refresh()} />
          ) : activeSection === "providers" ? (
            <ProviderSettingsPanel
              token={token}
              settings={settings}
              onSettingsChange={setSettings}
              onModelNameChange={onModelNameChange}
            />
          ) : (
            <GeneralSettings
              theme={theme}
              onToggleTheme={onToggleTheme}
              settings={settings}
              onOpenProviders={() => setActiveSection("providers")}
              onRestart={onRestart}
              isRestarting={isRestarting}
            />
          )}
        </div>
      </main>
    </div>
  );
}

function SettingsNavigation({
  activeSection,
  onSelectSection,
  onBackToChat,
  onLogout,
}: {
  activeSection: SettingsSectionKey;
  onSelectSection: (section: SettingsSectionKey) => void;
  onBackToChat: () => void;
  onLogout?: () => void;
}) {
  const { t } = useTranslation();
  return (
    <>
      <header className="shrink-0 border-b border-border bg-background px-3 pb-3 pt-safe lg:hidden">
        <div className="flex min-h-12 items-center justify-between gap-2">
          <Button variant="ghost" className="min-h-11 px-2" onClick={onBackToChat}>
            <ChevronLeft className="mr-1 h-4 w-4" aria-hidden />{t("settings.backToChat")}
          </Button>
          {onLogout ? <Button variant="ghost" size="icon" className="h-11 w-11" onClick={onLogout} aria-label={t("app.account.logout")}><LogOut className="h-4 w-4" aria-hidden /></Button> : null}
        </div>
        <nav aria-label={t("settings.sidebar.ariaLabel")} className="grid grid-cols-2 gap-1 bg-muted p-1">
          {NAV_ITEMS.map(({ key, icon: Icon }) => <NavButton key={key} itemKey={key} icon={Icon} active={activeSection === key} onClick={() => onSelectSection(key)} mobile />)}
        </nav>
      </header>

      <aside className="hidden w-64 shrink-0 flex-col border-r border-border bg-sidebar px-3 py-4 lg:flex">
        <Button variant="ghost" className="mb-5 min-h-11 w-fit justify-start px-2 text-muted-foreground" onClick={onBackToChat}>
          <ChevronLeft className="mr-1 h-4 w-4" aria-hidden />{t("settings.backToChat")}
        </Button>
        <h2 className="px-2 text-lg font-semibold">{t("settings.sidebar.title")}</h2>
        <nav aria-label={t("settings.sidebar.ariaLabel")} className="mt-4 space-y-1">
          {NAV_ITEMS.map(({ key, icon: Icon }) => <NavButton key={key} itemKey={key} icon={Icon} active={activeSection === key} onClick={() => onSelectSection(key)} />)}
        </nav>
        {onLogout ? <Button variant="ghost" className="mt-auto min-h-11 w-full justify-start text-muted-foreground hover:text-destructive" onClick={onLogout}><LogOut className="mr-2 h-4 w-4" aria-hidden />{t("app.account.logout")}</Button> : null}
      </aside>
    </>
  );
}

function NavButton({ itemKey, icon: Icon, active, onClick, mobile = false }: { itemKey: SettingsSectionKey; icon: LucideIcon; active: boolean; onClick: () => void; mobile?: boolean }) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      aria-current={active ? "page" : undefined}
      onClick={onClick}
      className={cn(
        "flex min-h-11 items-center gap-2 rounded-md px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        mobile && "justify-center",
        active ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      <Icon className="h-4 w-4 shrink-0" aria-hidden />
      <span className="truncate">{t(`settings.nav.${itemKey}`)}</span>
    </button>
  );
}

function GeneralSettings({
  theme,
  onToggleTheme,
  settings,
  onOpenProviders,
  onRestart,
  isRestarting,
}: {
  theme: "light" | "dark";
  onToggleTheme: () => void;
  settings: NonNullable<ReturnType<typeof useProviderSettings>["settings"]>;
  onOpenProviders: () => void;
  onRestart?: () => void;
  isRestarting?: boolean;
}) {
  const { t } = useTranslation();
  const provider = activeProvider(settings);
  return (
    <div className="space-y-10">
      <SettingsSection title={t("settings.sections.currentModel")}>
        <SettingsRow title={t("settings.rows.currentProvider")} description={t("settings.help.currentProvider")}>
          <div className="text-left sm:text-right">
            <div className="flex items-center gap-2 sm:justify-end">
              <span className="text-sm font-semibold">{provider?.label ?? (settings.agent.provider || t("settings.values.notAvailable"))}</span>
              {provider?.configured || settings.agent.has_api_key ? <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" aria-label={t("settings.providers.configured")} /> : null}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{settings.agent.model || t("settings.values.notAvailable")}</p>
          </div>
        </SettingsRow>
        <SettingsRow title={t("settings.rows.manageProviders")} description={t("settings.help.manageProviders")}>
          <Button variant="outline" className="min-h-11" onClick={onOpenProviders}>{t("settings.actions.openProviderSettings")}</Button>
        </SettingsRow>
      </SettingsSection>

      <SettingsSection title={t("settings.sections.interface")}>
        <SettingsRow title={t("settings.rows.theme")} description={t("settings.help.theme")}>
          <div role="group" aria-label={t("settings.rows.theme")} className="inline-flex bg-muted p-1">
            <button type="button" aria-pressed={theme === "light"} className={cn("min-h-10 rounded px-4 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", theme === "light" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground")} onClick={() => { if (theme !== "light") onToggleTheme(); }}>{t("settings.values.light")}</button>
            <button type="button" aria-pressed={theme === "dark"} className={cn("min-h-10 rounded px-4 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", theme === "dark" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground")} onClick={() => { if (theme !== "dark") onToggleTheme(); }}>{t("settings.values.dark")}</button>
          </div>
        </SettingsRow>
        <SettingsRow title={t("settings.rows.language")} description={t("settings.help.language")}><LanguageSwitcher /></SettingsRow>
      </SettingsSection>

      <CompactionSettings />

      {onRestart ? (
        <SettingsSection title={t("settings.sections.system")}>
          <SettingsRow title={t("settings.rows.restart")} description={t("app.system.restartHint")}>
            <Button variant="outline" className="min-h-11" onClick={onRestart} disabled={isRestarting}>
              {isRestarting ? <Loader2 className="mr-2 h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden /> : <RotateCcw className="mr-2 h-4 w-4" aria-hidden />}
              {isRestarting ? t("app.system.restarting") : t("app.system.restart")}
            </Button>
          </SettingsRow>
          <SettingsRow title={t("settings.rows.configPath")} description={t("settings.help.configPath")}><code className="max-w-sm break-all text-xs text-muted-foreground">{settings.runtime.config_path || t("settings.values.notAvailable")}</code></SettingsRow>
        </SettingsSection>
      ) : null}
    </div>
  );
}

function CompactionSettings() {
  const { t } = useTranslation();
  const [enabled, setEnabled] = useState(true);
  const [threshold, setThreshold] = useState(20);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    void window.catbuddy?.getConfig().then((config) => {
      const compact = (config as { agents?: { defaults?: { autoCompact?: { enabled?: boolean; threshold?: number } } } })?.agents?.defaults?.autoCompact;
      if (compact?.enabled !== undefined) setEnabled(compact.enabled);
      if (compact?.threshold) setThreshold(compact.threshold);
    }).catch(() => undefined);
  }, []);

  const persist = async (nextEnabled: boolean, nextThreshold: number) => {
    try {
      await window.catbuddy?.updateConfig("agents.defaults.autoCompact", { enabled: nextEnabled, threshold: nextThreshold });
      setStatus(t("settings.status.saved"));
    } catch {
      setStatus(t("settings.status.saveFailed"));
    }
  };

  return (
    <SettingsSection title={t("settings.rows.compaction")}>
      <SettingsRow title={t("settings.rows.compactionEnable")} description={t("settings.help.compactionEnable")}>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          className={cn("relative h-7 w-12 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2", enabled ? "bg-primary" : "bg-muted-foreground/35")}
          onClick={() => { const next = !enabled; setEnabled(next); void persist(next, threshold); }}
        ><span className={cn("absolute top-1 h-5 w-5 rounded-full bg-background shadow-sm transition-transform", enabled ? "translate-x-6" : "translate-x-1")} /></button>
      </SettingsRow>
      <SettingsRow title={t("settings.rows.compactionThreshold")} description={t("settings.help.compactionThreshold")}>
        <label className="flex items-center gap-2"><span className="sr-only">{t("settings.rows.compactionThreshold")}</span><input type="number" min={4} max={100} value={threshold} className="h-11 w-24 rounded-md border border-input bg-background px-3 text-sm tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" onChange={(event) => setThreshold(Math.min(100, Math.max(4, Number(event.target.value) || 4)))} onBlur={() => void persist(enabled, threshold)} /></label>
      </SettingsRow>
      <div className="sr-only" role="status" aria-live="polite">{status}</div>
    </SettingsSection>
  );
}

function SettingsSection({ title, children }: { title: string; children: ReactNode }) {
  return <section><h2 className="mb-2 text-sm font-semibold">{title}</h2><div className="divide-y divide-border border-y border-border">{children}</div></section>;
}

function SettingsRow({ title, description, children }: { title: string; description?: string; children?: ReactNode }) {
  return <div className="flex min-h-[72px] flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><p className="text-sm font-medium">{title}</p>{description ? <p className="mt-1 max-w-[34rem] text-xs leading-5 text-muted-foreground">{description}</p> : null}</div>{children ? <div className="min-w-0 shrink-0 sm:ml-8">{children}</div> : null}</div>;
}

function SettingsSkeleton() {
  return <div className="animate-pulse space-y-8 motion-reduce:animate-none" aria-busy="true"><div className="space-y-3 border-y border-border py-4"><div className="h-5 w-40 rounded bg-muted" /><div className="h-12 rounded bg-muted" /><div className="h-12 rounded bg-muted" /></div><div className="space-y-3 border-y border-border py-4"><div className="h-5 w-32 rounded bg-muted" /><div className="h-12 rounded bg-muted" /></div></div>;
}

function SettingsLoadError({ error, onRetry }: { error: string | null; onRetry: () => void }) {
  const { t } = useTranslation();
  return <div className="border-y border-border py-8" role="alert"><h2 className="text-lg font-semibold">{t("settings.status.loadError")}</h2><p className="mt-2 text-sm text-muted-foreground">{error}</p><Button variant="outline" className="mt-5 min-h-11" onClick={onRetry}>{t("providerSetup.loadError.retry")}</Button></div>;
}
