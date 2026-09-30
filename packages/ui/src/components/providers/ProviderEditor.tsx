import { useEffect, useId, useMemo, useState } from "react";
import { CheckCircle2, Eye, EyeOff, Loader2, ShieldCheck, XCircle } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { ProviderSettingsPayload } from "./provider-contract";
import {
  providerModels,
  saveAndActivateProvider,
  testProviderDraft,
  type ProviderDraft,
  type ProviderInfo,
  type ProviderTestResult,
} from "./provider-contract";

type FieldErrors = Partial<Record<"apiKey" | "apiBase" | "model", string>>;

export function ProviderEditor({
  token,
  provider,
  currentModel,
  submitLabel,
  onComplete,
  compact = false,
  managedExternally = false,
}: {
  token: string;
  provider: ProviderInfo;
  currentModel?: string;
  submitLabel?: string;
  onComplete: (settings: ProviderSettingsPayload) => void;
  compact?: boolean;
  managedExternally?: boolean;
}) {
  const { t } = useTranslation();
  const apiKeyId = useId();
  const apiBaseId = useId();
  const modelId = useId();
  const modelListId = useId();
  const recommendedModels = useMemo(() => providerModels(provider), [provider]);
  const [apiKey, setApiKey] = useState("");
  const [apiBase, setApiBase] = useState(provider.api_base ?? provider.default_api_base ?? "");
  const [model, setModel] = useState(
    currentModel?.trim() || recommendedModels[0] || "",
  );
  const [showKey, setShowKey] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(
    provider.name === "custom" || provider.api_key_required === false,
  );
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testResult, setTestResult] = useState<ProviderTestResult | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    setApiKey("");
    setApiBase(provider.api_base ?? provider.default_api_base ?? "");
    setModel(currentModel?.trim() || recommendedModels[0] || "");
    setShowKey(false);
    setAdvancedOpen(provider.name === "custom" || provider.api_key_required === false);
    setTestResult(null);
    setFieldErrors({});
    setFormError(null);
  }, [currentModel, provider, recommendedModels]);

  const invalidateTest = () => {
    setTestResult(null);
    setFormError(null);
  };

  const validate = (): FieldErrors => {
    const next: FieldErrors = {};
    if ((provider.api_key_required ?? true) && !provider.configured && !apiKey.trim()) {
      next.apiKey = t("providerSetup.errors.apiKeyRequired");
    }
    if (!model.trim()) next.model = t("providerSetup.errors.modelRequired");
    if (apiBase.trim()) {
      try {
        const url = new URL(apiBase.trim());
        if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error();
      } catch {
        next.apiBase = t("providerSetup.errors.invalidBaseUrl");
      }
    }
    setFieldErrors(next);
    return next;
  };

  const draft = (): ProviderDraft => ({
    provider: provider.name,
    ...(apiKey.trim() ? { apiKey: apiKey.trim() } : {}),
    apiBase: apiBase.trim(),
    model: model.trim(),
  });

  const test = async () => {
    const errors = validate();
    if (Object.keys(errors).length > 0) return;
    setTesting(true);
    setFormError(null);
    try {
      const result = await testProviderDraft(token, draft());
      setTestResult(result);
      if (!result.ok) setFormError(result.message || t("providerSetup.errors.testFailed"));
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : String(caught);
      setTestResult({ ok: false, message });
      setFormError(
        message === "provider_test_unavailable"
          ? t("providerSetup.errors.testUnavailable")
          : message,
      );
    } finally {
      setTesting(false);
    }
  };

  const save = async () => {
    const errors = validate();
    if (Object.keys(errors).length > 0) return;
    if (!testResult?.ok) {
      setFormError(t("providerSetup.errors.testFirst"));
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const payload = await saveAndActivateProvider(token, draft());
      setApiKey("");
      onComplete(payload);
    } catch (caught) {
      setFormError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setSaving(false);
    }
  };

  const keyRequired = provider.api_key_required ?? true;
  const discoveredModels = testResult?.models ?? [];
  const modelOptions = [...new Set([...discoveredModels, ...recommendedModels])];

  return (
    <div className={cn("space-y-5", compact && "space-y-4")}>
      {managedExternally ? (
        <div className="flex items-start gap-3 border-y border-border py-3 text-sm">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
          <div>
            <p className="font-medium text-foreground">{t("settings.providers.environmentManaged")}</p>
            <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{t("settings.providers.environmentManagedHint")}</p>
          </div>
        </div>
      ) : keyRequired ? (
        <div>
          <label htmlFor={apiKeyId} className="text-sm font-medium text-foreground">
            {t("providerSetup.fields.apiKey")}
          </label>
          <p id={`${apiKeyId}-hint`} className="mt-1 text-xs leading-5 text-muted-foreground">
            {provider.configured
              ? t("providerSetup.fields.apiKeyReplaceHint")
              : t("providerSetup.fields.apiKeyHint")}
          </p>
          <div className="relative mt-2">
            <Input
              id={apiKeyId}
              type={showKey ? "text" : "password"}
              value={apiKey}
              autoComplete="new-password"
              spellCheck={false}
              aria-invalid={!!fieldErrors.apiKey}
              aria-describedby={`${apiKeyId}-hint${fieldErrors.apiKey ? ` ${apiKeyId}-error` : ""}`}
              placeholder={
                provider.configured
                  ? provider.api_key_hint ?? t("providerSetup.fields.apiKeyConfigured")
                  : t("providerSetup.fields.apiKeyPlaceholder")
              }
              className="h-11 pr-11"
              onChange={(event) => {
                setApiKey(event.target.value);
                setFieldErrors((current) => ({ ...current, apiKey: undefined }));
                invalidateTest();
              }}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1 h-9 w-9"
              onClick={() => setShowKey((visible) => !visible)}
              aria-label={showKey ? t("settings.byok.hideApiKey") : t("settings.byok.showApiKey")}
            >
              {showKey ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
            </Button>
          </div>
          {fieldErrors.apiKey ? (
            <p id={`${apiKeyId}-error`} className="mt-1.5 text-xs text-destructive">
              {fieldErrors.apiKey}
            </p>
          ) : null}
        </div>
      ) : (
        <div className="flex items-start gap-3 border-y border-border py-3 text-sm">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
          <div>
            <p className="font-medium text-foreground">{t("providerSetup.local.title")}</p>
            <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{t("providerSetup.local.description")}</p>
          </div>
        </div>
      )}

      <div>
        <label htmlFor={modelId} className="text-sm font-medium text-foreground">
          {t("providerSetup.fields.model")}
        </label>
        <p id={`${modelId}-hint`} className="mt-1 text-xs leading-5 text-muted-foreground">
          {modelOptions.length > 0
            ? t("providerSetup.fields.modelRecommended")
            : t("providerSetup.fields.modelManual")}
        </p>
        <Input
          id={modelId}
          list={modelOptions.length > 0 ? modelListId : undefined}
          value={model}
          aria-invalid={!!fieldErrors.model}
          aria-describedby={`${modelId}-hint${fieldErrors.model ? ` ${modelId}-error` : ""}`}
          className="mt-2 h-11"
          placeholder={t("providerSetup.fields.modelPlaceholder")}
          onChange={(event) => {
            setModel(event.target.value);
            setFieldErrors((current) => ({ ...current, model: undefined }));
            invalidateTest();
          }}
          disabled={managedExternally}
        />
        {modelOptions.length > 0 ? (
          <datalist id={modelListId}>
            {modelOptions.map((option) => <option key={option} value={option} />)}
          </datalist>
        ) : null}
        {fieldErrors.model ? (
          <p id={`${modelId}-error`} className="mt-1.5 text-xs text-destructive">{fieldErrors.model}</p>
        ) : null}
      </div>

      <div>
        <button
          type="button"
          className="min-h-11 text-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-expanded={advancedOpen}
          onClick={() => setAdvancedOpen((open) => !open)}
        >
          {advancedOpen ? t("providerSetup.fields.hideAdvanced") : t("providerSetup.fields.showAdvanced")}
        </button>
        {advancedOpen ? (
          <div className="mt-2">
            <label htmlFor={apiBaseId} className="text-sm font-medium text-foreground">
              {t("providerSetup.fields.apiBase")}
            </label>
            <p id={`${apiBaseId}-hint`} className="mt-1 text-xs leading-5 text-muted-foreground">
              {t("providerSetup.fields.apiBaseHint")}
            </p>
            <Input
              id={apiBaseId}
              type="url"
              inputMode="url"
              value={apiBase}
              aria-invalid={!!fieldErrors.apiBase}
              aria-describedby={`${apiBaseId}-hint${fieldErrors.apiBase ? ` ${apiBaseId}-error` : ""}`}
              className="mt-2 h-11"
              placeholder={provider.default_api_base ?? "https://api.example.com/v1"}
              onChange={(event) => {
                setApiBase(event.target.value);
                setFieldErrors((current) => ({ ...current, apiBase: undefined }));
                invalidateTest();
              }}
              disabled={managedExternally}
            />
            {fieldErrors.apiBase ? (
              <p id={`${apiBaseId}-error`} className="mt-1.5 text-xs text-destructive">{fieldErrors.apiBase}</p>
            ) : null}
          </div>
        ) : null}
      </div>

      <div aria-live="polite" className="min-h-6">
        {testResult?.ok ? (
          <p className="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-300">
            <CheckCircle2 className="h-4 w-4" aria-hidden />
            {t("providerSetup.test.success", { latency: testResult.latencyMs ?? 0 })}
          </p>
        ) : formError ? (
          <p className="flex items-start gap-2 text-sm text-destructive">
            <XCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <span>{formError}</span>
          </p>
        ) : (
          <p className="text-xs leading-5 text-muted-foreground">{t("providerSetup.test.hint")}</p>
        )}
      </div>

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" className="min-h-11 sm:min-w-32" onClick={() => void test()} disabled={testing || saving}>
          {testing ? <Loader2 className="mr-2 h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden /> : null}
          {testing ? t("providerSetup.test.testing") : t("providerSetup.test.action")}
        </Button>
        {!managedExternally ? (
          <Button type="button" className="min-h-11 sm:min-w-40" onClick={() => void save()} disabled={!testResult?.ok || testing || saving}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden /> : null}
            {saving ? t("settings.actions.saving") : submitLabel ?? t("providerSetup.actions.saveAndContinue")}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
