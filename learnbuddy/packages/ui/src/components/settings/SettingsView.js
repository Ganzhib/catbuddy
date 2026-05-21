import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Bot, Brain, ChevronLeft, ChevronDown, Check, Cloud, Cpu, Database, Eye, EyeOff, Pencil, Gem, Grid3X3, Hexagon, Loader2, LogOut, KeyRound, Layers, Moon, Orbit, RotateCcw, Settings, Sparkles, Triangle, Waves, Zap, } from "lucide-react";
import { useTranslation } from "react-i18next";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { fetchSettings, updateProviderSettings, updateSettings, updateWebSearchSettings, } from "@learnbuddy/platform";
import { cn } from "@/lib/utils";
import { useClient } from "@/providers/ClientProvider";
const LOCAL_UNCONFIGURED_PROVIDER_ORDER = new Map(["vllm", "ollama", "lm_studio", "atomic_chat", "ovms"].map((name, index) => [
    name,
    index,
]));
export function SettingsView({ theme, onToggleTheme, onBackToChat, onModelNameChange, onLogout, onRestart, isRestarting = false, }) {
    const { t } = useTranslation();
    const { token } = useClient();
    const [settings, setSettings] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [providerSaving, setProviderSaving] = useState(null);
    const [webSearchSaving, setWebSearchSaving] = useState(false);
    const [error, setError] = useState(null);
    const [activeSection, setActiveSection] = useState("general");
    const [expandedProvider, setExpandedProvider] = useState(null);
    const [providerForms, setProviderForms] = useState({});
    const [visibleProviderKeys, setVisibleProviderKeys] = useState({});
    const [editingProviderKeys, setEditingProviderKeys] = useState({});
    const [webSearchForm, setWebSearchForm] = useState({
        provider: "duckduckgo",
        apiKey: "",
        baseUrl: "",
    });
    const [webSearchKeyVisible, setWebSearchKeyVisible] = useState(false);
    const [webSearchKeyEditing, setWebSearchKeyEditing] = useState(false);
    const [form, setForm] = useState({
        model: "",
        provider: "",
    });
    const applyPayload = useCallback((payload) => {
        setSettings(payload);
        setForm({
            model: payload.agent.model,
            provider: payload.agent.provider,
        });
        setWebSearchForm((prev) => ({
            provider: payload.web_search.provider,
            apiKey: prev.provider === payload.web_search.provider ? prev.apiKey ?? "" : "",
            baseUrl: payload.web_search.base_url ?? "",
        }));
    }, []);
    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        fetchSettings(token)
            .then((payload) => {
            if (!cancelled) {
                applyPayload(payload);
                setError(null);
            }
        })
            .catch((err) => {
            if (!cancelled)
                setError(err.message);
        })
            .finally(() => {
            if (!cancelled)
                setLoading(false);
        });
        return () => {
            cancelled = true;
        };
    }, [applyPayload, token]);
    useEffect(() => {
        if (!settings)
            return;
        setProviderForms((prev) => {
            const next = { ...prev };
            for (const provider of settings.providers) {
                next[provider.name] = {
                    apiKey: next[provider.name]?.apiKey ?? "",
                    apiBase: next[provider.name]?.apiBase ?? provider.api_base ?? provider.default_api_base ?? "",
                };
            }
            return next;
        });
    }, [settings]);
    const dirty = useMemo(() => {
        if (!settings)
            return false;
        return (form.model !== settings.agent.model ||
            form.provider !== settings.agent.provider);
    }, [form, settings]);
    const save = async () => {
        if (!dirty || saving)
            return;
        setSaving(true);
        try {
            const payload = await updateSettings(token, {
                model: form.model,
                ...(form.provider ? { provider: form.provider } : {}),
            });
            applyPayload(payload);
            onModelNameChange(payload.agent.model || null);
            setError(null);
        }
        catch (err) {
            setError(err.message);
        }
        finally {
            setSaving(false);
        }
    };
    const saveProvider = async (providerName) => {
        if (providerSaving)
            return;
        const provider = settings?.providers.find((item) => item.name === providerName);
        if (!provider)
            return;
        const providerForm = providerForms[providerName] ?? { apiKey: "", apiBase: "" };
        const apiKey = providerForm.apiKey.trim();
        const apiKeyRequired = provider.api_key_required ?? true;
        if (!provider.configured && apiKeyRequired && !apiKey) {
            setError(t("settings.byok.apiKeyRequired"));
            return;
        }
        setProviderSaving(providerName);
        try {
            const payload = await updateProviderSettings(token, {
                provider: providerName,
                apiKey: apiKey || undefined,
                apiBase: providerForm.apiBase.trim(),
            });
            applyPayload(payload);
            setProviderForms((prev) => ({
                ...prev,
                [providerName]: {
                    apiKey: "",
                    apiBase: providerForm.apiBase.trim(),
                },
            }));
            setVisibleProviderKeys((prev) => ({ ...prev, [providerName]: false }));
            setEditingProviderKeys((prev) => ({ ...prev, [providerName]: false }));
            setError(null);
        }
        catch (err) {
            setError(err.message);
        }
        finally {
            setProviderSaving(null);
        }
    };
    const saveWebSearch = async () => {
        if (!settings || webSearchSaving)
            return;
        const provider = settings.web_search.providers.find((item) => item.name === webSearchForm.provider);
        if (!provider)
            return;
        const apiKey = webSearchForm.apiKey?.trim() ?? "";
        const baseUrl = webSearchForm.baseUrl?.trim() ?? "";
        const hasExistingSecret = provider.credential === "api_key" &&
            webSearchForm.provider === settings.web_search.provider &&
            !!settings.web_search.api_key_hint;
        if (provider.credential === "api_key" && !apiKey && !hasExistingSecret) {
            setError(t("settings.byok.webSearch.apiKeyRequired"));
            return;
        }
        if (provider.credential === "base_url" && !baseUrl) {
            setError(t("settings.byok.webSearch.baseUrlRequired"));
            return;
        }
        setWebSearchSaving(true);
        try {
            const update = { provider: webSearchForm.provider };
            if (provider.credential === "api_key" && apiKey)
                update.apiKey = apiKey;
            if (provider.credential === "base_url")
                update.baseUrl = baseUrl;
            const payload = await updateWebSearchSettings(token, update);
            applyPayload(payload);
            setWebSearchForm((prev) => ({
                provider: payload.web_search.provider,
                apiKey: "",
                baseUrl: payload.web_search.base_url ?? prev.baseUrl ?? "",
            }));
            setWebSearchKeyVisible(false);
            setWebSearchKeyEditing(false);
            setError(null);
        }
        catch (err) {
            setError(err.message);
        }
        finally {
            setWebSearchSaving(false);
        }
    };
    const resetProviderDraft = useCallback((providerName) => {
        const provider = settings?.providers.find((item) => item.name === providerName);
        if (!provider)
            return;
        setProviderForms((prev) => ({
            ...prev,
            [providerName]: {
                apiKey: "",
                apiBase: provider.api_base ?? provider.default_api_base ?? "",
            },
        }));
        setVisibleProviderKeys((prev) => ({ ...prev, [providerName]: false }));
        setEditingProviderKeys((prev) => ({ ...prev, [providerName]: false }));
    }, [settings]);
    const handleToggleProvider = useCallback((providerName) => {
        if (expandedProvider)
            resetProviderDraft(expandedProvider);
        setExpandedProvider(expandedProvider === providerName ? null : providerName);
    }, [expandedProvider, resetProviderDraft]);
    const resetWebSearchDraft = useCallback(() => {
        if (!settings)
            return;
        setWebSearchForm({
            provider: settings.web_search.provider,
            apiKey: "",
            baseUrl: settings.web_search.base_url ?? "",
        });
        setWebSearchKeyVisible(false);
        setWebSearchKeyEditing(false);
    }, [settings]);
    const handleWebSearchProviderChange = useCallback((provider) => {
        if (!settings)
            return;
        setWebSearchForm({
            provider,
            apiKey: "",
            baseUrl: provider === settings.web_search.provider ? settings.web_search.base_url ?? "" : "",
        });
        setWebSearchKeyVisible(false);
        setWebSearchKeyEditing(false);
    }, [settings]);
    const toggleProviderKeyVisibility = (providerName) => {
        const isVisible = visibleProviderKeys[providerName];
        setVisibleProviderKeys((prev) => ({ ...prev, [providerName]: !isVisible }));
    };
    const toggleProviderKeyEditing = (providerName) => {
        setEditingProviderKeys((prev) => {
            const nextEditing = !prev[providerName];
            if (!nextEditing) {
                setProviderForms((forms) => ({
                    ...forms,
                    [providerName]: {
                        apiKey: "",
                        apiBase: forms[providerName]?.apiBase ?? "",
                    },
                }));
                setVisibleProviderKeys((visible) => ({ ...visible, [providerName]: false }));
            }
            return { ...prev, [providerName]: nextEditing };
        });
    };
    return (_jsxs("div", { className: "flex min-h-0 flex-1 overflow-hidden bg-[radial-gradient(circle_at_50%_0%,hsl(var(--muted))_0%,hsl(var(--background))_42%)]", children: [_jsx(SettingsSidebar, { activeSection: activeSection, onSelectSection: setActiveSection, onBackToChat: onBackToChat, onLogout: onLogout }), _jsx("main", { className: "min-w-0 flex-1 overflow-y-auto [scrollbar-gutter:stable]", children: _jsxs("div", { className: "mx-auto w-full max-w-[840px] px-6 py-10 sm:px-10 lg:py-14", children: [_jsxs("div", { className: "mb-8", children: [_jsx("p", { className: "mb-2 text-[13px] font-medium text-muted-foreground", children: t("settings.sidebar.title") }), _jsx("h1", { className: "text-[28px] font-semibold leading-tight tracking-[-0.035em] text-foreground sm:text-[34px]", children: t(`settings.nav.${activeSection}`) })] }), loading ? (_jsxs("div", { className: "flex h-48 items-center justify-center rounded-[24px] border border-border/50 bg-card/75 text-sm text-muted-foreground shadow-[0_20px_70px_rgba(15,23,42,0.07)]", children: [_jsx(Loader2, { className: "mr-2 h-4 w-4 animate-spin" }), t("settings.status.loading")] })) : error && !settings ? (_jsx(SettingsGroup, { children: _jsx(SettingsRow, { title: t("settings.status.loadError"), children: _jsx("span", { className: "max-w-[520px] text-sm text-muted-foreground", children: error }) }) })) : settings ? (_jsxs("div", { className: "space-y-5", children: [error ? (_jsx("div", { className: "rounded-[18px] border border-destructive/20 bg-destructive/5 px-4 py-3 text-[13px] text-destructive", children: error })) : null, activeSection === "general" ? (_jsx(GeneralSettings, { theme: theme, onToggleTheme: onToggleTheme, form: form, setForm: setForm, settings: settings, dirty: dirty, saving: saving, onSave: save, onRestart: onRestart, isRestarting: isRestarting, onOpenByok: () => setActiveSection("byok") })) : (_jsx(ByokSettings, { settings: settings, expandedProvider: expandedProvider, providerForms: providerForms, visibleProviderKeys: visibleProviderKeys, editingProviderKeys: editingProviderKeys, providerSaving: providerSaving, webSearchForm: webSearchForm, webSearchKeyVisible: webSearchKeyVisible, webSearchKeyEditing: webSearchKeyEditing, webSearchSaving: webSearchSaving, onToggleProvider: handleToggleProvider, onToggleProviderKey: toggleProviderKeyVisibility, onToggleProviderKeyEditing: toggleProviderKeyEditing, onChangeProviderForm: (provider, value) => setProviderForms((prev) => ({
                                        ...prev,
                                        [provider]: {
                                            apiKey: prev[provider]?.apiKey ?? "",
                                            apiBase: prev[provider]?.apiBase ?? "",
                                            ...value,
                                        },
                                    })), onSaveProvider: saveProvider, onChangeWebSearchForm: setWebSearchForm, onChangeWebSearchProvider: handleWebSearchProviderChange, onToggleWebSearchKey: () => setWebSearchKeyVisible((visible) => !visible), onToggleWebSearchKeyEditing: () => {
                                        setWebSearchKeyEditing((editing) => !editing);
                                        setWebSearchKeyVisible(false);
                                        setWebSearchForm((prev) => ({ ...prev, apiKey: "" }));
                                    }, onResetProviderDraft: resetProviderDraft, onResetWebSearchDraft: resetWebSearchDraft, onSaveWebSearch: saveWebSearch }))] })) : null] }) })] }));
}
const SETTINGS_NAV_ITEMS = [
    { key: "general", icon: Settings },
    { key: "byok", icon: KeyRound },
];
function SettingsSidebar({ activeSection, onSelectSection, onBackToChat, onLogout, }) {
    const { t } = useTranslation();
    return (_jsxs("aside", { className: "flex w-[17rem] shrink-0 flex-col border-r border-border/55 bg-card/62 px-3 py-4 shadow-[inset_-1px_0_0_rgba(255,255,255,0.55)] backdrop-blur-xl dark:bg-card/45 dark:shadow-none", children: [_jsxs("button", { type: "button", onClick: onBackToChat, className: "mb-3 inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[12px] font-medium text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground", children: [_jsx(ChevronLeft, { className: "h-3.5 w-3.5", "aria-hidden": true }), t("settings.backToChat")] }), _jsx("div", { className: "mb-5 px-2", children: _jsx("h2", { className: "text-[21px] font-semibold tracking-[-0.035em] text-foreground", children: t("settings.sidebar.title") }) }), _jsx("nav", { "aria-label": t("settings.sidebar.ariaLabel"), className: "space-y-1", children: SETTINGS_NAV_ITEMS.map(({ key, icon: Icon }) => {
                    const active = key === activeSection;
                    return (_jsxs("button", { type: "button", "aria-current": active ? "page" : undefined, onClick: () => onSelectSection(key), className: cn("flex h-9 w-full items-center gap-2 rounded-[10px] px-2.5 text-left text-[13px] font-medium transition-colors", active
                            ? "bg-muted/90 text-foreground shadow-[inset_0_0_0_1px_rgba(0,0,0,0.025)]"
                            : "text-muted-foreground/78 hover:bg-muted/45 hover:text-foreground"), children: [_jsx(Icon, { className: "h-4 w-4 shrink-0", strokeWidth: 2, "aria-hidden": true }), _jsx("span", { className: "truncate", children: t(`settings.nav.${key}`) })] }, key));
                }) }), _jsx("div", { className: "mt-auto pt-4", children: onLogout ? (_jsxs(Button, { type: "button", variant: "ghost", onClick: onLogout, className: "h-9 w-full justify-start gap-2 rounded-[10px] px-2.5 text-[13px] font-medium text-muted-foreground hover:bg-destructive/8 hover:text-destructive", children: [_jsx(LogOut, { className: "h-4 w-4", "aria-hidden": true }), t("app.account.logout")] })) : null })] }));
}
function RelayRemoteSettings() {
    const { t } = useTranslation();
    const [status, setStatus] = useState(null);
    useEffect(() => {
        if (!window.learnbuddy?.getRelayStatus)
            return;
        let cancelled = false;
        const poll = async () => {
            try {
                const st = await window.learnbuddy.getRelayStatus();
                if (!cancelled)
                    setStatus(st);
            }
            catch {
                if (!cancelled)
                    setStatus(null);
            }
        };
        void poll();
        const id = setInterval(() => void poll(), 2000);
        return () => {
            cancelled = true;
            clearInterval(id);
        };
    }, []);
    if (!status?.enabled)
        return null;
    const copyPairing = async () => {
        const code = status.pairingCode;
        if (!code)
            return;
        try {
            await navigator.clipboard.writeText(code);
        }
        catch {
            /* ignore */
        }
    };
    return (_jsxs("section", { children: [_jsx(SettingsSectionTitle, { children: t("settings.relay.section") }), _jsxs(SettingsGroup, { children: [_jsx(SettingsRow, { title: t("settings.relay.connection"), description: t("settings.relay.connectionHelp"), children: _jsx("span", { className: cn("text-[13px] font-medium", status.connected ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"), children: status.connected
                                ? t("settings.relay.connected")
                                : t("settings.relay.disconnected") }) }), _jsx(SettingsRow, { title: t("settings.relay.pairingCode"), description: t("settings.relay.pairingHelp"), children: _jsxs("div", { className: "flex items-center gap-2", children: [_jsx("code", { className: "rounded-md bg-muted px-2.5 py-1 text-[13px] font-semibold tracking-widest", children: status.pairingCode || "—" }), status.pairingCode ? (_jsx(Button, { type: "button", size: "sm", variant: "outline", className: "rounded-full", onClick: () => void copyPairing(), children: t("settings.relay.copy") })) : null] }) }), status.lastError ? (_jsx(SettingsRow, { title: t("settings.relay.lastError"), children: _jsx("span", { className: "max-w-[420px] text-right text-xs text-destructive break-all", children: status.lastError }) })) : null] })] }));
}
function CompactionSettings() {
    const { t } = useTranslation();
    const [enabled, setEnabled] = useState(true);
    const [threshold, setThreshold] = useState(20);
    useEffect(() => {
        (async () => {
            try {
                const config = await window.learnbuddy?.getConfig();
                const compact = config?.agents?.defaults?.autoCompact ?? {};
                if (compact.enabled !== undefined)
                    setEnabled(compact.enabled);
                if (compact.threshold)
                    setThreshold(compact.threshold);
            }
            catch { }
        })();
    }, []);
    const save = async () => {
        await window.learnbuddy?.updateConfig('agents.defaults.autoCompact', { enabled, threshold });
    };
    return (_jsxs("section", { children: [_jsx(SettingsSectionTitle, { children: t("settings.rows.compaction") }), _jsxs(SettingsGroup, { children: [_jsx(SettingsRow, { title: t("settings.rows.compactionEnable"), description: t("settings.help.compactionEnable"), children: _jsx("button", { onClick: () => { setEnabled(!enabled); save(); }, className: `relative inline-flex h-6 w-10 items-center rounded-full transition-colors ${enabled ? 'bg-blue-600' : 'bg-gray-600'}`, children: _jsx("span", { className: `inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${enabled ? 'translate-x-5' : 'translate-x-1'}` }) }) }), _jsx(SettingsRow, { title: t("settings.rows.compactionThreshold"), description: t("settings.help.compactionThreshold"), children: _jsxs("div", { className: "flex items-center gap-0", children: [_jsx("button", { onClick: () => { if (threshold > 4) {
                                        setThreshold(threshold - 1);
                                        save();
                                    } }, disabled: threshold <= 4, className: "h-7 w-6 text-gray-400  disabled:opacity-20 text-sm", children: "\u2212" }), _jsx("span", { className: "w-10 h-7 text-center text-sm text-gray-800 tabular-nums border border-gray-700 rounded flex items-center justify-center", children: threshold }), _jsx("button", { onClick: () => { if (threshold < 500) {
                                        setThreshold(threshold + 1);
                                        save();
                                    } }, disabled: threshold >= 500, className: "h-7 w-6 text-gray-400  disabled:opacity-20 text-sm", children: "+" })] }) })] })] }));
}
function GeneralSettings({ theme, onToggleTheme, form, setForm, settings, dirty, saving, onSave, onRestart, isRestarting, onOpenByok, }) {
    const { t } = useTranslation();
    const configuredProviders = settings.providers.filter((provider) => provider.configured);
    const providerValue = configuredProviders.some((provider) => provider.name === form.provider)
        ? form.provider
        : "";
    return (_jsxs("div", { className: "space-y-8", children: [_jsxs("section", { children: [_jsx(SettingsSectionTitle, { children: t("settings.sections.interface") }), _jsxs(SettingsGroup, { children: [_jsx(SettingsRow, { title: t("settings.rows.theme"), description: t("settings.help.theme"), children: _jsxs("button", { type: "button", onClick: onToggleTheme, className: "inline-flex h-8 items-center rounded-full bg-muted p-0.5 text-[12px] font-medium text-muted-foreground", children: [_jsx("span", { className: cn("rounded-full px-3 py-1 transition-colors", theme === "light" && "bg-background text-foreground shadow-sm"), children: t("settings.values.light") }), _jsx("span", { className: cn("rounded-full px-3 py-1 transition-colors", theme === "dark" && "bg-background text-foreground shadow-sm"), children: t("settings.values.dark") })] }) }), _jsx(SettingsRow, { title: t("settings.rows.language"), description: t("settings.help.language"), children: _jsx(LanguageSwitcher, {}) })] })] }), _jsxs("section", { children: [_jsx(SettingsSectionTitle, { children: t("settings.sections.ai") }), _jsxs(SettingsGroup, { children: [_jsx(SettingsRow, { title: t("settings.rows.provider"), description: t("settings.help.provider"), children: _jsx(ProviderPicker, { providers: configuredProviders, value: providerValue, emptyLabel: t("settings.byok.noConfiguredProviders"), onChange: (provider) => setForm((prev) => ({ ...prev, provider })) }) }), _jsx(SettingsRow, { title: t("settings.rows.model"), description: t("settings.help.model"), children: _jsx(Input, { value: form.model, onChange: (event) => setForm((prev) => ({ ...prev, model: event.target.value })), className: "h-8 w-[280px] rounded-full text-[13px]" }) }), (dirty || saving || settings.requires_restart) ? (_jsx(SettingsFooter, { dirty: dirty, saving: saving, saved: settings.requires_restart && !dirty, onSave: onSave })) : null, configuredProviders.length === 0 ? (_jsx(SettingsRow, { title: t("settings.byok.configureFirst"), children: _jsx(Button, { size: "sm", variant: "outline", onClick: onOpenByok, className: "rounded-full", children: t("settings.byok.openByok") }) })) : null] })] }), onRestart && (_jsxs("section", { children: [_jsx(SettingsSectionTitle, { children: t("settings.sections.system") }), _jsxs(SettingsGroup, { children: [_jsx(SettingsRow, { title: t("settings.rows.restart"), description: t("app.system.restartHint"), children: _jsxs(Button, { size: "sm", variant: "outline", onClick: onRestart, disabled: isRestarting, className: "rounded-full", children: [isRestarting ? (_jsx(Loader2, { className: "mr-1.5 h-3.5 w-3.5 animate-spin", "aria-hidden": true })) : (_jsx(RotateCcw, { className: "mr-1.5 h-3.5 w-3.5", "aria-hidden": true })), isRestarting ? t("app.system.restarting") : t("app.system.restart")] }) }), _jsx(SettingsRow, { title: t("settings.rows.configPath"), description: t("settings.help.configPath"), children: _jsx("span", { className: "text-right text-xs text-muted-foreground break-all", children: settings.runtime.config_path || t("settings.values.notAvailable") }) })] })] })), _jsx(RelayRemoteSettings, {}), _jsx(CompactionSettings, {})] }));
}
function ProviderPicker({ providers, value, emptyLabel, onChange, }) {
    const selectedProvider = providers.find((provider) => provider.name === value) ?? null;
    const disabled = providers.length === 0;
    return (_jsxs(DropdownMenu, { children: [_jsx(DropdownMenuTrigger, { asChild: true, disabled: disabled, children: _jsxs(Button, { type: "button", variant: "outline", disabled: disabled, className: cn("h-8 w-[210px] justify-between rounded-full border-input bg-background px-3 text-[13px] font-normal shadow-none", "hover:bg-accent/55 focus-visible:ring-2 focus-visible:ring-ring", disabled && "text-muted-foreground"), children: [_jsx("span", { className: "truncate", children: selectedProvider?.label ?? emptyLabel }), _jsx(ChevronDown, { className: "ml-2 h-3.5 w-3.5 shrink-0 text-muted-foreground", "aria-hidden": true })] }) }), _jsx(DropdownMenuContent, { align: "end", className: "max-h-[18rem] w-[240px] overflow-y-auto rounded-[18px] border-border/65 bg-popover p-1.5 text-popover-foreground shadow-[0_18px_55px_rgba(15,23,42,0.18)] dark:border-white/10 dark:shadow-[0_22px_55px_rgba(0,0,0,0.45)]", children: providers.map((provider) => {
                    const selected = provider.name === value;
                    return (_jsxs(DropdownMenuItem, { onSelect: () => onChange(provider.name), className: cn("flex cursor-default items-center justify-between gap-2 rounded-[12px] px-3 py-2 text-[13px]", "focus:bg-muted focus:text-foreground", selected && "bg-primary/10 text-primary focus:bg-primary/12 focus:text-primary"), children: [_jsx("span", { className: "truncate", children: provider.label }), selected ? _jsx(Check, { className: "h-3.5 w-3.5 shrink-0", "aria-hidden": true }) : null] }, provider.name));
                }) })] }));
}
function WebSearchByokSettings({ settings, form, keyVisible, keyEditing, saving, onChangeForm, onChangeProvider, onToggleKey, onToggleKeyEditing, onSave, }) {
    const { t } = useTranslation();
    const selectedProvider = settings.web_search.providers.find((provider) => provider.name === form.provider) ??
        settings.web_search.providers[0];
    const hasExistingSecret = selectedProvider?.credential === "api_key" &&
        form.provider === settings.web_search.provider &&
        !!settings.web_search.api_key_hint;
    const showKeyInput = selectedProvider?.credential === "api_key" && (!hasExistingSecret || keyEditing);
    const apiKey = form.apiKey?.trim() ?? "";
    const baseUrl = form.baseUrl?.trim() ?? "";
    const dirty = form.provider !== settings.web_search.provider ||
        apiKey.length > 0 ||
        baseUrl !== (settings.web_search.base_url ?? "");
    const missingCredential = selectedProvider?.credential === "api_key"
        ? !apiKey && !hasExistingSecret
        : selectedProvider?.credential === "base_url"
            ? !baseUrl
            : false;
    return (_jsx("section", { className: "space-y-4", children: _jsxs(SettingsGroup, { children: [_jsx(SettingsRow, { title: t("settings.byok.webSearch.provider"), description: t("settings.byok.webSearch.providerHelp"), children: _jsx(ProviderPicker, { providers: settings.web_search.providers, value: form.provider, emptyLabel: t("settings.byok.webSearch.selectProvider"), onChange: onChangeProvider }) }), selectedProvider?.credential === "none" ? (_jsx(SettingsRow, { title: t("settings.byok.webSearch.credentials"), description: t("settings.byok.webSearch.noCredentialHelp"), children: _jsx("span", { className: "rounded-full bg-emerald-500/10 px-2.5 py-1 text-[12px] font-medium text-emerald-700 dark:text-emerald-300", children: t("settings.byok.webSearch.noCredentialRequired") }) })) : null, selectedProvider?.credential === "api_key" ? (_jsx(SettingsRow, { title: t("settings.byok.apiKey"), description: t("settings.byok.webSearch.apiKeyHelp"), children: _jsx("div", { className: "relative w-[280px] max-w-full", children: showKeyInput ? (_jsxs(_Fragment, { children: [_jsx(Input, { type: keyVisible ? "text" : "password", value: form.apiKey ?? "", onChange: (event) => onChangeForm((prev) => ({ ...prev, apiKey: event.target.value })), placeholder: hasExistingSecret
                                        ? t("settings.byok.apiKeyConfiguredPlaceholder")
                                        : t("settings.byok.apiKeyPlaceholder"), className: "h-9 rounded-full pr-11 text-[13px]" }), _jsx(Button, { type: "button", variant: "ghost", size: "icon", onClick: onToggleKey, "aria-label": keyVisible ? t("settings.byok.hideApiKey") : t("settings.byok.showApiKey"), className: "absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2 rounded-full text-muted-foreground hover:bg-muted hover:text-foreground", children: keyVisible ? (_jsx(EyeOff, { className: "h-3.5 w-3.5", "aria-hidden": true })) : (_jsx(Eye, { className: "h-3.5 w-3.5", "aria-hidden": true })) })] })) : (_jsxs(_Fragment, { children: [_jsx("div", { className: "flex h-9 items-center rounded-full border border-input bg-background px-3 pr-11 text-[13px] text-muted-foreground", children: settings.web_search.api_key_hint ?? t("settings.byok.configuredKeyHint") }), _jsx(Button, { type: "button", variant: "ghost", size: "icon", onClick: onToggleKeyEditing, "aria-label": t("settings.actions.edit"), className: "absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2 rounded-full text-muted-foreground hover:bg-muted hover:text-foreground", children: _jsx(Pencil, { className: "h-3.5 w-3.5", "aria-hidden": true }) })] })) }) })) : null, selectedProvider?.credential === "base_url" ? (_jsx(SettingsRow, { title: t("settings.byok.webSearch.baseUrl"), description: t("settings.byok.webSearch.baseUrlHelp"), children: _jsx(Input, { value: form.baseUrl ?? "", onChange: (event) => onChangeForm((prev) => ({ ...prev, baseUrl: event.target.value })), placeholder: t("settings.byok.webSearch.baseUrlPlaceholder"), className: "h-9 w-[280px] rounded-full text-[13px]" }) })) : null, _jsxs("div", { className: "flex min-h-[58px] items-center justify-between gap-4 px-4 py-3 sm:px-5", children: [_jsx("div", { className: "text-[13px] text-muted-foreground", children: missingCredential
                                ? t("settings.byok.webSearch.missingCredential")
                                : t("settings.byok.webSearch.saveHint") }), _jsx(Button, { size: "sm", variant: "outline", onClick: onSave, disabled: !dirty || missingCredential || saving, className: "rounded-full", children: saving ? t("settings.actions.saving") : t("settings.actions.save") })] })] }) }));
}
function ByokSettings({ settings, expandedProvider, providerForms, visibleProviderKeys, editingProviderKeys, providerSaving, webSearchForm, webSearchKeyVisible, webSearchKeyEditing, webSearchSaving, onToggleProvider, onToggleProviderKey, onToggleProviderKeyEditing, onChangeProviderForm, onSaveProvider, onChangeWebSearchForm, onChangeWebSearchProvider, onToggleWebSearchKey, onToggleWebSearchKeyEditing, onResetProviderDraft, onResetWebSearchDraft, onSaveWebSearch, }) {
    const { t } = useTranslation();
    const [activePane, setActivePane] = useState("llm");
    const [showAllUnconfigured, setShowAllUnconfigured] = useState(false);
    const configuredProviders = settings.providers.filter((provider) => provider.configured);
    const unconfiguredProviders = useMemo(() => orderUnconfiguredProviders(settings.providers.filter((provider) => !provider.configured)), [settings.providers]);
    const initialUnconfiguredCount = 6;
    const visibleUnconfiguredProviders = showAllUnconfigured
        ? unconfiguredProviders
        : unconfiguredProviders.slice(0, initialUnconfiguredCount);
    const hiddenUnconfiguredCount = Math.max(0, unconfiguredProviders.length - visibleUnconfiguredProviders.length);
    const renderProviderRow = (provider) => {
        const expanded = expandedProvider === provider.name;
        const form = providerForms[provider.name] ?? {
            apiKey: "",
            apiBase: provider.api_base ?? provider.default_api_base ?? "",
        };
        const saving = providerSaving === provider.name;
        const keyVisible = !!visibleProviderKeys[provider.name];
        const editingKey = !provider.configured || !!editingProviderKeys[provider.name];
        const apiKeyRequired = provider.api_key_required ?? true;
        const apiKey = form.apiKey.trim();
        const apiBase = form.apiBase.trim();
        const missingRequiredApiKey = apiKeyRequired && !provider.configured && !apiKey;
        const missingOptionalCredential = !apiKeyRequired && !provider.configured && !apiKey && !apiBase;
        return (_jsxs("div", { className: "divide-y divide-border/45", children: [_jsxs("button", { type: "button", onClick: () => onToggleProvider(provider.name), className: "flex min-h-[70px] w-full items-center justify-between gap-4 px-4 py-3 text-left transition-colors hover:bg-muted/35 sm:px-5", children: [_jsxs("span", { className: "flex min-w-0 items-center gap-3", children: [_jsx(ProviderIcon, { provider: provider.name }), _jsx("span", { className: "min-w-0", children: _jsx("span", { className: "block truncate text-[15px] font-semibold leading-5 text-foreground", children: provider.label }) })] }), _jsx("span", { className: cn("rounded-full px-2.5 py-1 text-[12px] font-medium", provider.configured
                                ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                                : "bg-muted text-muted-foreground"), children: provider.configured
                                ? t("settings.byok.configured")
                                : t("settings.byok.notConfigured") })] }), expanded ? (_jsxs("div", { className: "space-y-3 bg-muted/18 px-4 py-4 sm:px-5", children: [_jsxs("label", { className: "block space-y-1.5", children: [_jsx("span", { className: "text-[12px] font-medium text-muted-foreground", children: t("settings.byok.apiKey") }), _jsx("div", { className: "relative", children: editingKey ? (_jsxs(_Fragment, { children: [_jsx(Input, { type: keyVisible ? "text" : "password", value: form.apiKey, onChange: (event) => onChangeProviderForm(provider.name, { apiKey: event.target.value }), placeholder: provider.configured
                                                    ? t("settings.byok.apiKeyConfiguredPlaceholder")
                                                    : t("settings.byok.apiKeyPlaceholder"), className: "h-9 rounded-full pr-11 text-[13px]" }), _jsx(Button, { type: "button", variant: "ghost", size: "icon", onClick: () => onToggleProviderKey(provider.name), "aria-label": keyVisible
                                                    ? t("settings.byok.hideApiKey")
                                                    : t("settings.byok.showApiKey"), className: "absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2 rounded-full text-muted-foreground hover:bg-muted hover:text-foreground", children: keyVisible ? (_jsx(EyeOff, { className: "h-3.5 w-3.5", "aria-hidden": true })) : (_jsx(Eye, { className: "h-3.5 w-3.5", "aria-hidden": true })) })] })) : (_jsxs(_Fragment, { children: [_jsx("div", { className: "flex h-9 items-center rounded-full border border-input bg-background px-3 pr-11 text-[13px] text-muted-foreground", children: provider.api_key_hint ?? t("settings.byok.configuredKeyHint") }), _jsx(Button, { type: "button", variant: "ghost", size: "icon", onClick: () => onToggleProviderKeyEditing(provider.name), "aria-label": t("settings.actions.edit"), className: "absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2 rounded-full text-muted-foreground hover:bg-muted hover:text-foreground", children: _jsx(Pencil, { className: "h-3.5 w-3.5", "aria-hidden": true }) })] })) })] }), _jsxs("label", { className: "block space-y-1.5", children: [_jsx("span", { className: "text-[12px] font-medium text-muted-foreground", children: t("settings.byok.apiBase") }), _jsx(Input, { value: form.apiBase, onChange: (event) => onChangeProviderForm(provider.name, { apiBase: event.target.value }), placeholder: provider.default_api_base ?? t("settings.byok.apiBasePlaceholder"), className: "h-9 rounded-full text-[13px]" })] }), _jsx("div", { className: "flex items-center justify-end", children: _jsx(Button, { size: "sm", variant: "outline", onClick: () => onSaveProvider(provider.name), disabled: saving || missingRequiredApiKey || missingOptionalCredential, className: "rounded-full", children: saving ? t("settings.actions.saving") : t("settings.actions.save") }) })] })) : null] }, provider.name));
    };
    const panes = [
        { key: "llm", label: t("settings.byok.tabs.llm") },
        { key: "web-search", label: t("settings.byok.tabs.webSearch") },
    ];
    return (_jsxs("div", { className: "space-y-6", children: [_jsx("p", { className: "max-w-[42rem] text-[13px] leading-6 text-muted-foreground", children: t("settings.byok.description") }), _jsx("div", { role: "tablist", "aria-label": t("settings.byok.tabs.ariaLabel"), className: "grid rounded-[22px] border border-border/35 bg-muted/35 p-1 shadow-[inset_0_1px_2px_rgba(15,23,42,0.04)] backdrop-blur-xl sm:grid-cols-2", children: panes.map((pane) => {
                    const selected = activePane === pane.key;
                    return (_jsx("button", { type: "button", role: "tab", "aria-selected": selected, onClick: () => {
                            if (pane.key === activePane)
                                return;
                            if (activePane === "llm" && expandedProvider) {
                                onResetProviderDraft(expandedProvider);
                            }
                            if (activePane === "web-search") {
                                onResetWebSearchDraft();
                            }
                            setActivePane(pane.key);
                        }, className: cn("h-10 rounded-[18px] text-[13px] font-semibold transition-all", selected
                            ? "bg-background text-foreground shadow-[0_8px_28px_rgba(15,23,42,0.10)]"
                            : "text-muted-foreground hover:text-foreground"), children: pane.label }, pane.key));
                }) }), activePane === "llm" ? (_jsxs("div", { className: "space-y-8", children: [_jsxs("section", { className: "space-y-3", children: [_jsx(ByokSectionHeader, { title: t("settings.byok.configuredSection"), count: configuredProviders.length }), _jsx("div", { className: "overflow-hidden rounded-[22px] border border-border/45 bg-card/86 shadow-[0_18px_65px_rgba(15,23,42,0.07)] backdrop-blur-xl dark:border-white/10 dark:shadow-[0_18px_65px_rgba(0,0,0,0.22)]", children: configuredProviders.length > 0 ? (_jsx("div", { className: "divide-y divide-border/45", children: configuredProviders.map(renderProviderRow) })) : (_jsx(ByokEmptyState, { children: t("settings.byok.noConfiguredProviders") })) })] }), _jsxs("section", { className: "space-y-3", children: [_jsx(ByokSectionHeader, { title: t("settings.byok.notConfiguredSection"), count: unconfiguredProviders.length }), _jsx("div", { className: "overflow-hidden rounded-[22px] border border-border/45 bg-card/86 shadow-[0_18px_65px_rgba(15,23,42,0.07)] backdrop-blur-xl dark:border-white/10 dark:shadow-[0_18px_65px_rgba(0,0,0,0.22)]", children: _jsx("div", { className: "divide-y divide-border/45", children: visibleUnconfiguredProviders.map(renderProviderRow) }) }), hiddenUnconfiguredCount > 0 ? (_jsx(Button, { type: "button", variant: "ghost", onClick: () => setShowAllUnconfigured(true), className: "h-9 rounded-full px-3 text-[13px] text-muted-foreground hover:bg-muted/60 hover:text-foreground", children: t("settings.byok.showMore", { count: hiddenUnconfiguredCount }) })) : showAllUnconfigured && unconfiguredProviders.length > initialUnconfiguredCount ? (_jsx(Button, { type: "button", variant: "ghost", onClick: () => setShowAllUnconfigured(false), className: "h-9 rounded-full px-3 text-[13px] text-muted-foreground hover:bg-muted/60 hover:text-foreground", children: t("settings.byok.showLess") })) : null] })] })) : (_jsx(WebSearchByokSettings, { settings: settings, form: webSearchForm, keyVisible: webSearchKeyVisible, keyEditing: webSearchKeyEditing, saving: webSearchSaving, onChangeForm: onChangeWebSearchForm, onChangeProvider: onChangeWebSearchProvider, onToggleKey: onToggleWebSearchKey, onToggleKeyEditing: onToggleWebSearchKeyEditing, onSave: onSaveWebSearch }))] }));
}
function ByokSectionHeader({ title, count }) {
    return (_jsxs("div", { className: "flex items-center justify-between px-1", children: [_jsx("h2", { className: "text-[13px] font-semibold tracking-[-0.01em] text-foreground/85", children: title }), _jsx("span", { className: "rounded-full bg-muted px-2 py-0.5 text-[11.5px] font-medium text-muted-foreground", children: count })] }));
}
function ByokEmptyState({ children }) {
    return (_jsx("div", { className: "rounded-[18px] border border-dashed border-border/65 bg-card/45 px-4 py-5 text-[13px] text-muted-foreground", children: children }));
}
function orderUnconfiguredProviders(providers) {
    return providers
        .map((provider, index) => ({ provider, index }))
        .sort((left, right) => {
        const rank = providerVisibilityRank(left.provider) - providerVisibilityRank(right.provider);
        return rank || left.index - right.index;
    })
        .map(({ provider }) => provider);
}
function providerVisibilityRank(provider) {
    const localRank = LOCAL_UNCONFIGURED_PROVIDER_ORDER.get(provider.name);
    if (localRank !== undefined)
        return localRank;
    if ((provider.api_key_required ?? true) === false)
        return 100;
    return 200;
}
const PROVIDER_ICONS = {
    custom: Hexagon,
    openrouter: Sparkles,
    aihubmix: Triangle,
    anthropic: Brain,
    openai: Bot,
    deepseek: Waves,
    zhipu: Grid3X3,
    dashscope: Cloud,
    moonshot: Moon,
    minimax: Zap,
    minimax_anthropic: Brain,
    groq: Cpu,
    huggingface: Layers,
    gemini: Gem,
    mistral: Orbit,
    siliconflow: Layers,
    volcengine: Cloud,
    volcengine_coding_plan: Cloud,
    byteplus: Cloud,
    byteplus_coding_plan: Cloud,
    qianfan: Database,
    ant_ling: Sparkles,
    azure_openai: Cloud,
    bedrock: Database,
    vllm: Cpu,
    ollama: Cpu,
    lm_studio: Cpu,
    atomic_chat: Cpu,
    ovms: Cpu,
    nvidia: Zap,
};
function ProviderIcon({ provider }) {
    const Icon = PROVIDER_ICONS[provider] ?? Hexagon;
    return (_jsx("span", { className: "grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-muted text-foreground/82 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.025)] dark:bg-muted/70", children: _jsx(Icon, { className: "h-5 w-5", strokeWidth: 2, "aria-hidden": true }) }));
}
function SettingsSectionTitle({ children }) {
    return (_jsx("h2", { className: "mb-2 px-1 text-[13px] font-semibold tracking-[-0.01em] text-foreground/85", children: children }));
}
function SettingsGroup({ children }) {
    return (_jsx("div", { className: "overflow-hidden rounded-[22px] border border-border/45 bg-card/86 shadow-[0_18px_65px_rgba(15,23,42,0.075)] backdrop-blur-xl dark:border-white/10 dark:shadow-[0_18px_65px_rgba(0,0,0,0.24)]", children: _jsx("div", { className: "divide-y divide-border/45", children: children }) }));
}
function SettingsRow({ title, description, children, }) {
    return (_jsxs("div", { className: "flex min-h-[62px] flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-5", children: [_jsxs("div", { className: "min-w-0", children: [_jsx("div", { className: "text-[14px] font-medium leading-5 text-foreground", children: title }), description ? (_jsx("div", { className: "mt-0.5 max-w-[28rem] text-[12px] leading-5 text-muted-foreground", children: description })) : null] }), children ? _jsx("div", { className: "shrink-0 sm:ml-6", children: children }) : null] }));
}
function SettingsFooter({ dirty, saving, saved, onSave, }) {
    const { t } = useTranslation();
    return (_jsxs("div", { className: "flex min-h-[58px] items-center justify-between gap-4 px-4 py-3 sm:px-5", children: [_jsx("div", { className: "text-[13px] text-muted-foreground", children: saved ? t("settings.status.savedRestart") : t("settings.status.unsaved") }), _jsx(Button, { size: "sm", variant: "outline", onClick: onSave, disabled: !dirty || saving, className: "rounded-full", children: saving ? t("settings.actions.saving") : t("settings.actions.save") })] }));
}
//# sourceMappingURL=SettingsView.js.map