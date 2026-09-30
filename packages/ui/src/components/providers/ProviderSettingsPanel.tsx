import { useId, useMemo, useState } from "react";
import { Check, ChevronDown, KeyRound, Laptop, Loader2, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { updateSettings } from "@catbuddy/platform";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ProviderEditor } from "./ProviderEditor";
import {
  activeProvider,
  credentialStorageLabel,
  deleteCredential,
  providerManagementAvailable,
  providerModels,
  type ProviderInfo,
  type ProviderSettingsPayload,
} from "./provider-contract";

export function ProviderSettingsPanel({
  token,
  settings,
  onSettingsChange,
  onModelNameChange,
}: {
  token: string;
  settings: ProviderSettingsPayload;
  onSettingsChange: (settings: ProviderSettingsPayload) => void;
  onModelNameChange: (model: string | null) => void;
}) {
  const { t } = useTranslation();
  const headingId = useId();
  const [expanded, setExpanded] = useState<string | null>(null);
  const [activating, setActivating] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ProviderInfo | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const providers = settings.providers as ProviderInfo[];
  const active = activeProvider(settings);
  const canManage = providerManagementAvailable(settings);
  const storage = credentialStorageLabel(settings);
  const storageSummary =
    typeof settings.credential_storage === "object" && settings.credential_storage.secure && storage
      ? t("settings.providers.secureStorage", { backend: storage })
      : storage;

  const orderedProviders = useMemo(
    () => [...providers].sort((left, right) => {
      const rank = (provider: ProviderInfo) => provider.active || provider.name === settings.agent.provider ? 0 : provider.configured ? 1 : 2;
      return rank(left) - rank(right) || left.label.localeCompare(right.label);
    }),
    [providers, settings.agent.provider],
  );

  if (!canManage) {
    return (
      <section aria-labelledby={headingId} className="border-y border-border py-7">
        <Laptop className="h-6 w-6 text-muted-foreground" aria-hidden />
        <h2 id={headingId} className="mt-4 text-xl font-semibold">{t("settings.providers.desktopOnlyTitle")}</h2>
        <p className="mt-2 max-w-[60ch] text-sm leading-6 text-muted-foreground">{t("settings.providers.desktopOnlyDescription")}</p>
        <p className="mt-5 text-sm font-medium text-foreground">{t("settings.providers.desktopOnlySecurity")}</p>
      </section>
    );
  }

  const activate = async (provider: ProviderInfo) => {
    setActivating(provider.name);
    setError(null);
    setNotice(null);
    try {
      const model = providerModels(provider)[0] || settings.agent.model;
      const payload = (await updateSettings(token, { provider: provider.name, model })) as ProviderSettingsPayload;
      onSettingsChange(payload);
      onModelNameChange(payload.agent.model || null);
      setNotice(t("settings.providers.activated", { provider: provider.label, model: payload.agent.model }));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setActivating(null);
    }
  };

  const remove = async () => {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    setError(null);
    setNotice(null);
    try {
      const payload = await deleteCredential(token, deleteTarget.name);
      onSettingsChange(payload);
      setExpanded((current) => current === deleteTarget.name ? null : current);
      setNotice(t("settings.providers.deleted", { provider: deleteTarget.label }));
      setDeleteTarget(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <section aria-labelledby={headingId}>
      <div className="flex flex-col gap-3 border-b border-border pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 id={headingId} className="text-xl font-semibold tracking-[-0.02em]">{t("settings.providers.title")}</h2>
          <p className="mt-1 max-w-[62ch] text-sm leading-6 text-muted-foreground">{t("settings.providers.description")}</p>
        </div>
        {storageSummary ? <span className="max-w-64 text-xs leading-5 text-muted-foreground">{storageSummary}</span> : null}
      </div>

      <div className="sr-only" role="status" aria-live="polite">{notice}</div>
      {notice ? <p className="mt-4 flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-300"><Check className="h-4 w-4" aria-hidden />{notice}</p> : null}
      {error ? <p className="mt-4 text-sm text-destructive" role="alert">{error}</p> : null}

      <div className="mt-5 divide-y divide-border border-y border-border">
        {orderedProviders.map((provider) => {
          const isActive = provider.active || provider.name === active?.name;
          const isExpanded = expanded === provider.name;
          const panelId = `provider-panel-${provider.name.replace(/[^a-z0-9_-]/gi, "-")}`;
          return (
            <div key={provider.name}>
              <div className="flex min-h-[72px] items-center gap-3 py-3">
                <button
                  type="button"
                  className="flex min-h-11 min-w-0 flex-1 items-center gap-3 rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-expanded={isExpanded}
                  aria-controls={panelId}
                  onClick={() => setExpanded(isExpanded ? null : provider.name)}
                >
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground"><KeyRound className="h-4 w-4" aria-hidden /></span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="truncate text-sm font-semibold text-foreground">{provider.label}</span>
                      {isActive ? <StatusLabel tone="active">{t("settings.providers.active")}</StatusLabel> : provider.configured ? <StatusLabel tone="configured">{t("settings.providers.configured")}</StatusLabel> : <StatusLabel>{t("settings.providers.notConfigured")}</StatusLabel>}
                    </span>
                    <span className="mt-1 block truncate text-xs text-muted-foreground">
                      {provider.credential_source === "environment"
                        ? t("settings.providers.environmentManaged")
                        : isActive
                          ? settings.agent.model
                          : provider.configured
                            ? provider.api_key_hint ?? t("settings.providers.credentialSaved")
                            : t("settings.providers.configureHint")}
                    </span>
                  </span>
                  <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", isExpanded && "rotate-180")} aria-hidden />
                </button>

                {provider.configured && !isActive ? (
                  <Button variant="outline" size="sm" className="hidden min-h-11 sm:inline-flex" disabled={!!activating} onClick={() => void activate(provider)}>
                    {activating === provider.name ? <Loader2 className="mr-2 h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden /> : null}
                    {t("settings.providers.setActive")}
                  </Button>
                ) : null}
                {provider.configured && provider.credential_source !== "environment" ? (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-11 w-11 text-muted-foreground hover:text-destructive"
                    disabled={isActive}
                    title={isActive ? t("settings.providers.deleteActiveHint") : t("settings.providers.delete")}
                    aria-label={isActive ? t("settings.providers.deleteActiveHint") : t("settings.providers.deleteNamed", { provider: provider.label })}
                    onClick={() => setDeleteTarget(provider)}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden />
                  </Button>
                ) : null}
              </div>

              {isExpanded ? (
                <div id={panelId} className="border-t border-border bg-muted/25 px-3 py-5 sm:px-5">
                  {!isActive && provider.configured ? (
                    <Button variant="outline" className="mb-5 min-h-11 w-full sm:hidden" disabled={!!activating} onClick={() => void activate(provider)}>{t("settings.providers.setActive")}</Button>
                  ) : null}
                  <ProviderEditor
                    token={token}
                    provider={provider}
                    currentModel={isActive ? settings.agent.model : providerModels(provider)[0]}
                    submitLabel={isActive ? t("settings.providers.saveAndKeepActive") : t("settings.providers.saveAndActivate")}
                    compact
                    managedExternally={provider.credential_source === "environment"}
                    onComplete={(payload) => {
                      onSettingsChange(payload);
                      onModelNameChange(payload.agent.model || null);
                      setNotice(t("settings.providers.saved", { provider: provider.label }));
                      setExpanded(null);
                    }}
                  />
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open && !deleting) setDeleteTarget(null); }}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>{t("settings.providers.deleteTitle", { provider: deleteTarget?.label })}</AlertDialogTitle>
            <AlertDialogDescription>{t("settings.providers.deleteDescription")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>{t("settings.actions.cancel")}</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" disabled={deleting} onClick={(event) => { event.preventDefault(); void remove(); }}>
              {deleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden /> : null}
              {t("settings.providers.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

function StatusLabel({ children, tone = "muted" }: { children: string; tone?: "active" | "configured" | "muted" }) {
  return <span className={cn("rounded px-1.5 py-0.5 text-[11px] font-medium", tone === "active" && "bg-primary text-primary-foreground", tone === "configured" && "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300", tone === "muted" && "bg-muted text-muted-foreground")}>{children}</span>;
}
