import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Copy,
  ExternalLink,
  Loader2,
  Plug,
  Plus,
  ShieldCheck,
  Store,
  Trash2,
  Wrench,
  XCircle,
} from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { panelBtnPrimary, panelCard, panelSection } from "@/lib/panel-styles";
import { cn } from "@/lib/utils";
import {
  addMcpFromMarketplace,
  fetchMcpMarketplace,
  fetchMcpSettings,
  updateMcpServers,
} from "@catbuddy/platform";
import { useClient } from "@/providers/ClientProvider";
import type {
  McpMarketplaceEntry,
  McpServerConfig,
  McpSettingsServer,
} from "@catbuddy/shared";

function serversToRecord(
  servers: McpSettingsServer[],
): Record<string, McpServerConfig> {
  return Object.fromEntries(servers.map((s) => [s.name, s.config]));
}

function parsePaste(raw: string): Record<string, McpServerConfig> {
  const parsed = JSON.parse(raw.trim()) as Record<string, unknown>;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("invalid_object");
  }
  if (parsed.mcpServers && typeof parsed.mcpServers === "object") {
    return parsed.mcpServers as Record<string, McpServerConfig>;
  }
  if (typeof parsed.command === "string") {
    return { custom: parsed as unknown as McpServerConfig };
  }
  return parsed as Record<string, McpServerConfig>;
}

function Badge({
  children,
  tone = "muted",
}: {
  children: React.ReactNode;
  tone?: "muted" | "success" | "warning";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium",
        tone === "success" && "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
        tone === "warning" && "bg-amber-500/10 text-amber-700 dark:text-amber-300",
        tone === "muted" && "bg-muted/80 text-muted-foreground",
      )}
    >
      {children}
    </span>
  );
}

export function McpSettings({ variant = "settings" }: { variant?: "settings" | "panel" }) {
  const { t } = useTranslation();
  const { token } = useClient();
  const [servers, setServers] = useState<McpSettingsServer[]>([]);
  const [marketplace, setMarketplace] = useState<McpMarketplaceEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [pasteText, setPasteText] = useState("");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [settingsPayload, marketplaceItems] = await Promise.all([
        fetchMcpSettings(token),
        fetchMcpMarketplace(token),
      ]);
      setServers(settingsPayload.servers);
      setMarketplace(marketplaceItems);
      setError(null);
    } catch (err) {
      const message = (err as Error).message;
      setError(
        message.includes("501") || message.includes("desktop app")
          ? t("settings.mcp.desktopOnly")
          : message,
      );
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  const installedIds = useMemo(() => {
    const names = new Set(servers.map((s) => s.name));
    return new Set(
      marketplace
        .filter(
          (entry) =>
            !entry.pasteOnly
            && Object.keys(entry.config).length > 0
            && Object.keys(entry.config).every((key) => names.has(key)),
        )
        .map((entry) => entry.id),
    );
  }, [marketplace, servers]);

  const handleCopyTemplate = async (entry: McpMarketplaceEntry) => {
    if (!entry.pasteTemplate) return;
    try {
      await navigator.clipboard.writeText(entry.pasteTemplate);
      setPasteText(entry.pasteTemplate);
      setStatusMessage(t("settings.mcp.templateCopied"));
      setError(null);
    } catch {
      setPasteText(entry.pasteTemplate);
      setStatusMessage(t("settings.mcp.templateCopiedPaste"));
      setError(null);
    }
  };

  const applyServers = async (next: Record<string, McpServerConfig>) => {
    setSaving(true);
    setError(null);
    try {
      const result = await updateMcpServers(token, next);
      setServers(result.servers);
      setStatusMessage(result.message);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAndConnect = () => {
    void applyServers(serversToRecord(servers));
  };

  const handleRemove = (name: string) => {
    const next = servers.filter((s) => s.name !== name);
    setServers(next);
    void applyServers(serversToRecord(next));
  };

  const handlePasteMerge = () => {
    try {
      const parsed = parsePaste(pasteText);
      const merged = { ...serversToRecord(servers), ...parsed };
      const mergedList: McpSettingsServer[] = Object.entries(merged).map(
        ([name, config]) => {
          const existing = servers.find((s) => s.name === name);
          return {
            name,
            config,
            connected: existing?.connected ?? false,
            toolCount: existing?.toolCount ?? 0,
          };
        },
      );
      setPasteText("");
      setServers(mergedList);
      void applyServers(merged);
    } catch {
      setError(t("settings.mcp.pasteInvalid"));
    }
  };

  const handleMarketplaceAdd = async (entry: McpMarketplaceEntry) => {
    setAddingId(entry.id);
    setError(null);
    try {
      const result = await addMcpFromMarketplace(token, entry.id);
      setServers(result.servers);
      setStatusMessage(result.message);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setAddingId(null);
    }
  };

  const isPanel = variant === "panel";
  const sectionClass = isPanel
    ? panelSection
    : "rounded-[24px] border border-border/50 bg-card shadow-[0_20px_70px_rgba(15,23,42,0.07)]";
  const innerCardClass = cn(panelCard, "flex h-full flex-col p-4 shadow-sm transition-colors hover:border-primary/25 hover:shadow-[0_10px_30px_rgba(59,130,246,0.08)]");

  if (loading) {
    return (
      <div className={cn("flex h-48 items-center justify-center text-sm text-muted-foreground", sectionClass)}>
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        {t("settings.mcp.loading")}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {error ? (
        <div className="rounded-[18px] border border-destructive/20 bg-destructive/5 px-4 py-3 text-[13px] text-destructive">
          {error}
        </div>
      ) : null}
      {statusMessage ? (
        <div className="rounded-[18px] border border-emerald-500/20 bg-emerald-500/5 px-4 py-3 text-[13px] text-emerald-700 dark:text-emerald-300">
          {statusMessage}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-[20px] border border-primary/10 bg-gradient-to-br from-primary/10 via-card to-sky-500/5 p-4 shadow-[0_12px_40px_rgba(59,130,246,0.08)]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-background/70 px-3 py-1 text-[11px] font-medium text-primary ring-1 ring-primary/10">
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
              MCP Marketplace
            </div>
            <p className="mt-3 max-w-2xl text-[13px] leading-relaxed text-muted-foreground">
              一键可用项会直接添加并重连；需要密钥、登录或远程 HTTP 的服务改为复制模板，避免误点后连接失败。
            </p>
          </div>
          <div className="flex gap-2 text-[11px]">
            <Badge tone="success">一键可用</Badge>
            <Badge tone="warning">需配置</Badge>
          </div>
        </div>
      </div>

      <section className={sectionClass}>
        <div className="border-b border-border/45 px-4 py-4 sm:px-5">
          <div className="flex items-center gap-2 text-[15px] font-medium">
            <Plug className="h-4 w-4 text-muted-foreground" aria-hidden />
            {t("settings.mcp.serversTitle")}
          </div>
          <p className="mt-1 text-[13px] text-muted-foreground">
            {t("settings.mcp.serversHelp")}
          </p>
        </div>
        {servers.length === 0 ? (
          <div className="px-4 py-8 text-center text-[13px] text-muted-foreground sm:px-5">
            {t("settings.mcp.empty")}
          </div>
        ) : (
          <ul className="divide-y divide-border/45">
            {servers.map((server) => (
              <li
                key={server.name}
                className="flex items-start justify-between gap-3 px-4 py-3 sm:px-5"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-foreground">{server.name}</span>
                    {server.connected ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-300">
                        <CheckCircle2 className="h-3 w-3" aria-hidden />
                        {t("settings.mcp.connected", { count: server.toolCount })}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-[11px] font-medium text-destructive">
                        <XCircle className="h-3 w-3" aria-hidden />
                        {t("settings.mcp.disconnected")}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 truncate font-mono text-[12px] text-muted-foreground">
                    {server.config.command} {server.config.args?.join(" ") ?? ""}
                  </p>
                  {!server.connected && server.lastError ? (
                    <p className="mt-1 text-[12px] text-destructive">{server.lastError}</p>
                  ) : null}
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0 rounded-full text-muted-foreground hover:text-destructive"
                  aria-label={t("settings.mcp.remove", { name: server.name })}
                  onClick={() => handleRemove(server.name)}
                  disabled={saving}
                >
                  <Trash2 className="h-4 w-4" aria-hidden />
                </Button>
              </li>
            ))}
          </ul>
        )}
        {servers.length > 0 ? (
          <div className="flex justify-end border-t border-border/45 px-4 py-3 sm:px-5">
            <Button
              size="sm"
              className={panelBtnPrimary}
              onClick={handleSaveAndConnect}
              disabled={saving}
            >
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t("settings.mcp.connecting")}
                </>
              ) : (
                t("settings.mcp.saveAndConnect")
              )}
            </Button>
          </div>
        ) : null}
      </section>

      <section className={sectionClass}>
        <div className="border-b border-border/45 px-4 py-4 sm:px-5">
          <div className="flex items-center gap-2 text-[15px] font-medium">
            <Store className="h-4 w-4 text-muted-foreground" aria-hidden />
            {t("settings.mcp.marketplaceTitle")}
          </div>
          <p className="mt-1 text-[13px] text-muted-foreground">
            {t("settings.mcp.marketplaceHelp")}
          </p>
        </div>
        <div className="grid gap-3 p-4 sm:grid-cols-2 sm:p-5">
          {marketplace.map((entry) => {
            const installed = installedIds.has(entry.id);
            return (
              <article key={entry.id} className={innerCardClass}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-[14px] font-medium">{entry.name}</h3>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      <Badge tone={entry.pasteOnly ? "warning" : "success"}>
                        {entry.pasteOnly ? <Wrench className="h-3 w-3" aria-hidden /> : <CheckCircle2 className="h-3 w-3" aria-hidden />}
                        {entry.pasteOnly ? "需配置" : "一键可用"}
                      </Badge>
                      <Badge>{entry.category}</Badge>
                    </div>
                  </div>
                  {entry.docsUrl ? (
                    <button
                      type="button"
                      className="text-muted-foreground hover:text-foreground"
                      aria-label={t("settings.mcp.docs")}
                      onClick={() => {
                        const url = entry.docsUrl!;
                        if (typeof window !== "undefined") {
                          window.open(url, "_blank", "noopener,noreferrer");
                        }
                      }}
                    >
                      <ExternalLink className="h-4 w-4" aria-hidden />
                    </button>
                  ) : null}
                </div>
                <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
                  {entry.description}
                </p>
                <div className="flex-1" />
                {entry.setupNote ? (
                  <p className="mt-2 text-[12px] leading-relaxed text-muted-foreground/90">
                    {entry.setupNote}
                  </p>
                ) : null}
                {entry.requiresEnv?.length ? (
                  <p className="mt-2 text-[11px] text-amber-700 dark:text-amber-300">
                    {t("settings.mcp.requiresEnv")}: {entry.requiresEnv.join(", ")}
                  </p>
                ) : null}
                {entry.pasteOnly ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className={cn("mt-auto w-full", panelBtnPrimary)}
                    onClick={() => void handleCopyTemplate(entry)}
                  >
                    <Copy className="mr-1 h-4 w-4" aria-hidden />
                    {t("settings.mcp.copyTemplate")}
                  </Button>
                ) : (
                  <Button
                    type="button"
                    size="sm"
                    variant={installed ? "outline" : "default"}
                    className={cn("mt-auto w-full", panelBtnPrimary)}
                    disabled={installed || addingId === entry.id || saving}
                    onClick={() => void handleMarketplaceAdd(entry)}
                  >
                    {addingId === entry.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : installed ? (
                      t("settings.mcp.added")
                    ) : (
                      <>
                        <Plus className="mr-1 h-4 w-4" aria-hidden />
                        {t("settings.mcp.add")}
                      </>
                    )}
                  </Button>
                )}
              </article>
            );
          })}
        </div>
      </section>

      <section className={sectionClass}>
        <div className="border-b border-border/45 px-4 py-4 sm:px-5">
          <h2 className="text-[15px] font-medium">{t("settings.mcp.pasteTitle")}</h2>
          <p className="mt-1 text-[13px] text-muted-foreground">
            {t("settings.mcp.pasteHelp")}
          </p>
        </div>
        <div className="space-y-3 p-4 sm:p-5">
          <Textarea
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            placeholder={t("settings.mcp.pastePlaceholder")}
            className="min-h-[140px] rounded-[14px] font-mono text-[12px] leading-relaxed"
          />
          <div className="flex justify-end">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className={panelBtnPrimary}
              disabled={!pasteText.trim() || saving}
              onClick={handlePasteMerge}
            >
              {saving ? t("settings.mcp.connecting") : t("settings.mcp.pasteApply")}
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
