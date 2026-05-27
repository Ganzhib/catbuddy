import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BookOpen,
  CheckCircle2,
  Loader2,
  Puzzle,
  Sparkles,
  Store,
  ToggleLeft,
  ToggleRight,
  Wrench,
  Zap,
} from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { panelBtnPrimary, panelCard, panelSection } from "@/lib/panel-styles";
import {
  fetchSkillMarketplace,
  installSkillFromMarketplace,
  listSkills,
  toggleSkill,
} from "@catbuddy/platform";
import { useClient } from "@/providers/ClientProvider";
import type { SkillInfo, SkillMarketplaceEntry } from "@catbuddy/shared";

function SkillBadge({
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

function MarketplaceCard({
  entry,
  installed,
  installing,
  onInstall,
  t,
}: {
  entry: SkillMarketplaceEntry;
  installed: boolean;
  installing: boolean;
  onInstall: () => void;
  t: (key: string, opts?: Record<string, string>) => string;
}) {
  return (
    <div
      className={cn(
        "flex h-full flex-col",
        panelCard,
        "p-4 shadow-sm transition-colors hover:border-primary/25 hover:shadow-[0_10px_30px_rgba(59,130,246,0.08)]",
        entry.featured && "ring-1 ring-primary/15",
      )}
    >
      <div className="flex items-start gap-2.5">
        <span className="text-xl leading-none" aria-hidden>
          {entry.emoji ?? "🧩"}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <p className="text-[14px] font-medium leading-tight">{entry.name}</p>
            <SkillBadge tone={entry.setupNote ? "warning" : "success"}>
              {entry.setupNote ? <Wrench className="h-3 w-3" aria-hidden /> : <CheckCircle2 className="h-3 w-3" aria-hidden />}
              {entry.setupNote ? "需配置" : "一键可用"}
            </SkillBadge>
            <SkillBadge>{entry.category}</SkillBadge>
          </div>
          <p className="mt-1.5 text-[12px] leading-relaxed text-muted-foreground">
            {entry.description}
          </p>
          {entry.setupNote ? (
            <p className="mt-2 flex items-start gap-1 text-[11px] text-amber-700 dark:text-amber-300">
              <BookOpen className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
              <span>{entry.setupNote}</span>
            </p>
          ) : null}
          <div className="flex-1" />
        </div>
      </div>
      <Button
        type="button"
        size="sm"
        variant={installed ? "secondary" : "default"}
        disabled={installing}
        onClick={onInstall}
        className={cn("mt-auto w-full", panelBtnPrimary)}
      >
        {installing ? (
          <>
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            {t("settings.skills.installing")}
          </>
        ) : installed ? (
          t("settings.skills.installed")
        ) : (
          t("settings.skills.oneClickInstall")
        )}
      </Button>
    </div>
  );
}

export function SkillSettings({ variant = "settings" }: { variant?: "settings" | "panel" }) {
  const { t } = useTranslation();
  const { token } = useClient();
  const [skills, setSkills] = useState<SkillInfo[]>([]);
  const [marketplace, setMarketplace] = useState<SkillMarketplaceEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [installingId, setInstallingId] = useState<string | null>(null);
  const [togglingName, setTogglingName] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [skillList, marketplaceItems] = await Promise.all([
        listSkills(token),
        fetchSkillMarketplace(token),
      ]);
      setSkills(skillList);
      setMarketplace(marketplaceItems);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  const installedInWorkspace = useMemo(() => {
    const byName = new Map(skills.map((s) => [s.name, s]));
    return new Set(
      marketplace
        .filter((entry) => {
          const skill = byName.get(entry.skillName);
          return skill && !skill.isBuiltin;
        })
        .map((entry) => entry.id),
    );
  }, [marketplace, skills]);

  const { featured, more } = useMemo(() => {
    const feat = marketplace.filter((e) => e.featured);
    const rest = marketplace.filter((e) => !e.featured);
    return { featured: feat, more: rest };
  }, [marketplace]);

  const workspaceSkills = useMemo(
    () =>
      skills.filter(
        (s) =>
          s.name !== "memory" &&
          s.name !== "my" &&
          !s.isBuiltin,
      ),
    [skills],
  );

  const handleInstall = async (entry: SkillMarketplaceEntry) => {
    setInstallingId(entry.id);
    setError(null);
    try {
      const result = await installSkillFromMarketplace(token, entry.id);
      setSkills(result.skills);
      setStatusMessage(
        result.hotReload
          ? `${result.message} ${t("settings.skills.hotReloadHint")}`
          : result.message,
      );
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setInstallingId(null);
    }
  };

  const handleToggle = async (skill: SkillInfo) => {
    if (skill.name === "memory" || skill.name === "my") return;
    setTogglingName(skill.name);
    setError(null);
    try {
      await toggleSkill(token, skill.name, !skill.enabled);
      setSkills((prev) =>
        prev.map((s) =>
          s.name === skill.name ? { ...s, enabled: !skill.enabled } : s,
        ),
      );
      setStatusMessage(
        skill.enabled
          ? t("settings.skills.disabledHotReload", { name: skill.name })
          : t("settings.skills.enabledHotReload", { name: skill.name }),
      );
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setTogglingName(null);
    }
  };

  const isPanel = variant === "panel";
  const sectionClass = isPanel
    ? panelSection
    : "rounded-[24px] border border-border/50 bg-card shadow-[0_20px_70px_rgba(15,23,42,0.07)]";
  const gridClass = isPanel ? "sm:grid-cols-2 lg:grid-cols-3" : "sm:grid-cols-2";

  if (loading) {
    return (
      <div className={cn("flex h-48 items-center justify-center text-sm text-muted-foreground", sectionClass)}>
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        {t("settings.skills.loading")}
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
          <span className="inline-flex items-start gap-1.5">
            <Zap className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
            {statusMessage}
          </span>
        </div>
      ) : null}

      <div className="overflow-hidden rounded-[20px] border border-primary/10 bg-gradient-to-br from-primary/10 via-card to-sky-500/5 p-4 shadow-[0_12px_40px_rgba(59,130,246,0.08)]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-background/70 px-3 py-1 text-[11px] font-medium text-primary ring-1 ring-primary/10">
              <Sparkles className="h-3.5 w-3.5" aria-hidden />
              Skill Marketplace
            </div>
            <p className="mt-3 max-w-2xl text-[13px] leading-relaxed text-muted-foreground">
              优先展示无需额外依赖的实用技能；需要本机工具或开关的技能会明确标记，安装后下一条消息即可热加载。
            </p>
          </div>
          <div className="flex gap-2 text-[11px]">
            <SkillBadge tone="success">一键可用</SkillBadge>
            <SkillBadge tone="warning">需配置</SkillBadge>
          </div>
        </div>
      </div>

      <section className={sectionClass}>
        <div className="border-b border-border/45 px-4 py-4 sm:px-5">
          <div className="flex items-center gap-2 text-[15px] font-medium">
            <Store className="h-4 w-4 text-muted-foreground" aria-hidden />
            {t("settings.skills.marketplaceTitle")}
          </div>
          <p className="mt-1 text-[13px] text-muted-foreground">
            {t("settings.skills.marketplaceHelp")}
          </p>
        </div>

        {featured.length > 0 ? (
          <div className="border-b border-border/45 px-4 py-4 sm:px-5">
            <div className="mb-3 flex items-center gap-1.5 text-[12px] font-medium text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5" aria-hidden />
              {t("settings.skills.featuredTitle")}
            </div>
            <div className={cn("grid gap-3", gridClass)}>
              {featured.map((entry) => (
                <MarketplaceCard
                  key={entry.id}
                  entry={entry}
                  installed={installedInWorkspace.has(entry.id)}
                  installing={installingId === entry.id}
                  onInstall={() => void handleInstall(entry)}
                  t={t}
                />
              ))}
            </div>
          </div>
        ) : null}

        {more.length > 0 ? (
          <div className="px-4 py-4 sm:px-5">
            <p className="mb-3 text-[12px] font-medium text-muted-foreground">
              {t("settings.skills.moreTitle")}
            </p>
            <div className={cn("grid gap-3", gridClass)}>
              {more.map((entry) => (
                <MarketplaceCard
                  key={entry.id}
                  entry={entry}
                  installed={installedInWorkspace.has(entry.id)}
                  installing={installingId === entry.id}
                  onInstall={() => void handleInstall(entry)}
                  t={t}
                />
              ))}
            </div>
          </div>
        ) : null}
      </section>

      {workspaceSkills.length > 0 ? (
        <section className={sectionClass}>
          <div className="border-b border-border/45 px-4 py-4 sm:px-5">
            <div className="flex items-center gap-2 text-[15px] font-medium">
              <Puzzle className="h-4 w-4 text-muted-foreground" aria-hidden />
              {t("settings.skills.installedTitle")}
            </div>
            <p className="mt-1 text-[13px] text-muted-foreground">
              {t("settings.skills.installedHelp")}
            </p>
          </div>
          <ul className="divide-y divide-border/45">
            {workspaceSkills.map((skill) => (
              <li
                key={skill.name}
                className="flex items-start justify-between gap-3 px-4 py-3 sm:px-5"
              >
                <div className="min-w-0">
                  <p className="text-[14px] font-medium">{skill.name}</p>
                  <p className="mt-0.5 text-[12px] text-muted-foreground line-clamp-2">
                    {skill.description}
                  </p>
                  <p className="mt-1 text-[11px] text-muted-foreground/80">
                    {skill.enabled
                      ? t("settings.skills.enabled")
                      : t("settings.skills.disabled")}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={togglingName === skill.name}
                  onClick={() => void handleToggle(skill)}
                  className="shrink-0"
                  aria-label={
                    skill.enabled
                      ? t("settings.skills.disable", { name: skill.name })
                      : t("settings.skills.enable", { name: skill.name })
                  }
                >
                  {togglingName === skill.name ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : skill.enabled ? (
                    <ToggleRight className="h-5 w-5 text-emerald-600" />
                  ) : (
                    <ToggleLeft className="h-5 w-5 text-muted-foreground" />
                  )}
                </Button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
