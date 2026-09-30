import { useState, type ReactNode } from "react";
import { ArrowRight, KeyRound, Laptop, RefreshCw, ShieldCheck } from "lucide-react";
import { useTranslation } from "react-i18next";

import { BrandLogo } from "@/components/BrandLogo";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ProviderEditor } from "./ProviderEditor";
import {
  activeProvider,
  credentialStorageLabel,
  hasUsableProvider,
  providerManagementAvailable,
  type ProviderInfo,
  type ProviderSettingsPayload,
} from "./provider-contract";
import { useProviderSettings } from "./useProviderSettings";

export function ProviderSetupGate({
  token,
  children,
  onModelNameChange,
}: {
  token: string;
  children: ReactNode;
  onModelNameChange?: (model: string | null) => void;
}) {
  const { settings, setSettings, loading, error, refresh } = useProviderSettings(token);

  if (loading) return <ProviderSetupSkeleton />;
  if (error || !settings) {
    return <ProviderSetupLoadError error={error} onRetry={() => void refresh()} />;
  }
  // The Gateway intentionally redacts credential state. Web stays usable as a
  // remote control surface; credential management remains desktop-only.
  if (!providerManagementAvailable(settings) || hasUsableProvider(settings)) {
    return <>{children}</>;
  }

  return (
    <ProviderSetupView
      token={token}
      settings={settings}
      onComplete={(payload) => {
        setSettings(payload);
        onModelNameChange?.(payload.agent.model || null);
      }}
    />
  );
}

export function ProviderSetupView({
  token,
  settings,
  onComplete,
}: {
  token: string;
  settings: ProviderSettingsPayload;
  onComplete: (settings: ProviderSettingsPayload) => void;
}) {
  const { t } = useTranslation();
  const providers = settings.providers as ProviderInfo[];
  const initial = activeProvider(settings) ?? providers[0] ?? null;
  const [selectedName, setSelectedName] = useState(initial?.name ?? "");
  const selected = providers.find((provider) => provider.name === selectedName) ?? initial;
  const canManage = providerManagementAvailable(settings);
  const storageLabel = credentialStorageLabel(settings);
  const secureStorageLabel =
    typeof settings.credential_storage === "object" && settings.credential_storage.secure && storageLabel
      ? t("providerSetup.trust.secureStorageBody", { backend: storageLabel })
      : storageLabel;

  return (
    <main className="min-h-dvh overflow-y-auto bg-background px-4 py-6 text-foreground sm:px-6 sm:py-10">
      <div className="mx-auto w-full max-w-5xl">
        <header className="flex items-center justify-between border-b border-border pb-5">
          <BrandLogo className="h-8 w-auto" />
          <span className="text-xs font-medium text-muted-foreground">{t("providerSetup.step")}</span>
        </header>

        <div className="grid gap-10 py-8 lg:grid-cols-[minmax(0,0.82fr)_minmax(0,1.18fr)] lg:gap-16 lg:py-14">
          <section aria-labelledby="provider-setup-title">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <KeyRound className="h-5 w-5" aria-hidden />
            </div>
            <h1 id="provider-setup-title" className="mt-5 text-3xl font-semibold leading-tight tracking-[-0.035em] sm:text-4xl">
              {t("providerSetup.title")}
            </h1>
            <p className="mt-4 max-w-[56ch] text-sm leading-7 text-muted-foreground">
              {t("providerSetup.description")}
            </p>
            <ul className="mt-7 space-y-4 text-sm">
              <TrustItem icon={ShieldCheck} title={t("providerSetup.trust.localTitle")} body={secureStorageLabel || t("providerSetup.trust.localBody")} />
              <TrustItem icon={ArrowRight} title={t("providerSetup.trust.verifyTitle")} body={t("providerSetup.trust.verifyBody")} />
            </ul>
          </section>

          <section aria-label={t("providerSetup.formAria")} className="min-w-0 border-t border-border pt-6 lg:border-l lg:border-t-0 lg:pl-10 lg:pt-0">
            {!canManage ? (
              <div className="py-4" role="status">
                <Laptop className="h-7 w-7 text-muted-foreground" aria-hidden />
                <h2 className="mt-4 text-xl font-semibold">{t("providerSetup.desktopOnly.title")}</h2>
                <p className="mt-2 max-w-[52ch] text-sm leading-6 text-muted-foreground">{t("providerSetup.desktopOnly.description")}</p>
                <p className="mt-5 border-y border-border py-4 text-sm text-foreground">{t("providerSetup.desktopOnly.security")}</p>
              </div>
            ) : providers.length === 0 ? (
              <div role="alert" className="py-4">
                <h2 className="text-xl font-semibold">{t("providerSetup.noProviders.title")}</h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{t("providerSetup.noProviders.description")}</p>
              </div>
            ) : selected ? (
              <>
                <div>
                  <label htmlFor="provider-setup-provider" className="text-sm font-medium">{t("providerSetup.fields.provider")}</label>
                  <p id="provider-setup-provider-hint" className="mt-1 text-xs leading-5 text-muted-foreground">{t("providerSetup.fields.providerHint")}</p>
                  <select
                    id="provider-setup-provider"
                    aria-describedby="provider-setup-provider-hint"
                    value={selected.name}
                    onChange={(event) => setSelectedName(event.target.value)}
                    className={cn(
                      "mt-2 h-11 w-full rounded-md border border-input bg-background px-3 text-sm",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                    )}
                  >
                    {providers.map((provider) => <option key={provider.name} value={provider.name}>{provider.label}</option>)}
                  </select>
                </div>
                <div className="my-6 border-t border-border" />
                <ProviderEditor
                  key={selected.name}
                  token={token}
                  provider={selected}
                  currentModel={selected.name === settings.agent.provider ? settings.agent.model : undefined}
                  onComplete={onComplete}
                />
              </>
            ) : null}
          </section>
        </div>
      </div>
    </main>
  );
}

function TrustItem({ icon: Icon, title, body }: { icon: typeof ShieldCheck; title: string; body: string }) {
  return (
    <li className="flex gap-3">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
      <div><p className="font-medium text-foreground">{title}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{body}</p></div>
    </li>
  );
}

function ProviderSetupSkeleton() {
  const { t } = useTranslation();
  return (
    <main className="min-h-dvh bg-background px-4 py-8" aria-busy="true" aria-label={t("providerSetup.loading")}>
      <div className="mx-auto max-w-5xl animate-pulse motion-reduce:animate-none">
        <div className="h-8 w-36 rounded bg-muted" />
        <div className="mt-8 grid gap-10 border-t border-border pt-10 lg:grid-cols-2">
          <div className="space-y-4"><div className="h-10 w-3/4 rounded bg-muted" /><div className="h-4 w-full rounded bg-muted" /><div className="h-4 w-4/5 rounded bg-muted" /></div>
          <div className="space-y-5"><div className="h-11 rounded bg-muted" /><div className="h-11 rounded bg-muted" /><div className="h-11 rounded bg-muted" /></div>
        </div>
      </div>
    </main>
  );
}

function ProviderSetupLoadError({ error, onRetry }: { error: string | null; onRetry: () => void }) {
  const { t } = useTranslation();
  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-4 py-8">
      <div className="w-full max-w-lg border-y border-border py-8 text-center" role="alert">
        <h1 className="text-xl font-semibold">{t("providerSetup.loadError.title")}</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{t("providerSetup.loadError.description")}</p>
        {error ? <details className="mt-4 text-left text-xs text-muted-foreground"><summary className="cursor-pointer text-center">{t("providerSetup.loadError.details")}</summary><pre className="mt-2 max-h-28 overflow-auto whitespace-pre-wrap bg-muted p-3">{error}</pre></details> : null}
        <Button className="mt-6 min-h-11" onClick={onRetry}><RefreshCw className="mr-2 h-4 w-4" aria-hidden />{t("providerSetup.loadError.retry")}</Button>
      </div>
    </main>
  );
}
