import { Download, FileCode2, PenLine, Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { openWorkspaceFile } from "@catbuddy/platform";

export interface DiagramFileReference {
  path: string;
  absolutePath?: string;
}

interface DiagramResultCardProps {
  diagram: DiagramFileReference;
  onOpenEditor?: (diagram: DiagramFileReference) => void;
  compact?: boolean;
}

function diagramFileName(path: string): string {
  return path.replace(/\\/g, "/").split("/").pop() || path;
}

export function isDrawioPath(path: string): boolean {
  return /\.drawio$/i.test(path.trim());
}

export function DiagramResultCard({
  diagram,
  onOpenEditor,
  compact = false,
}: DiagramResultCardProps) {
  const { t } = useTranslation();
  const fileName = diagramFileName(diagram.path);

  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border border-sky-500/15",
        "bg-gradient-to-br from-sky-500/[0.10] via-background to-violet-500/[0.08]",
        "shadow-[0_16px_40px_rgba(14,116,144,0.10)] dark:shadow-[0_18px_44px_rgba(0,0,0,0.25)]",
        compact ? "p-3" : "p-4 sm:p-5",
      )}
    >
      <div className="flex items-start gap-3">
        <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-sky-500/12 text-sky-600 ring-1 ring-sky-500/15 dark:text-sky-300">
          <FileCode2 className="h-5 w-5" aria-hidden />
          <Sparkles className="absolute -right-1 -top-1 h-3.5 w-3.5 text-violet-500 dark:text-violet-300" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold tracking-[-0.01em] text-foreground">
            {t("diagramCard.title", { defaultValue: "Architecture diagram generated" })}
          </p>
          <p className="mt-1 truncate font-mono text-xs text-muted-foreground" title={diagram.path}>
            {fileName}
          </p>
          {!compact ? (
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground/85">
              {t("diagramCard.description", {
                defaultValue: "Open it in the Draw.io editor to inspect, polish, and save changes back to the workspace.",
              })}
            </p>
          ) : null}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          onClick={() => onOpenEditor?.(diagram)}
          className="gap-2 rounded-full bg-sky-600 px-3.5 text-white shadow-sm shadow-sky-600/20 hover:bg-sky-700"
        >
          <PenLine className="h-4 w-4" aria-hidden />
          {t("diagramCard.openEditor", { defaultValue: "Open editor" })}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => openWorkspaceFile(diagram.path, diagram.absolutePath)}
          className="gap-2 rounded-full bg-background/70"
        >
          <Download className="h-4 w-4" aria-hidden />
          {t("diagramCard.openFile", { defaultValue: "Open file" })}
        </Button>
      </div>
    </div>
  );
}
