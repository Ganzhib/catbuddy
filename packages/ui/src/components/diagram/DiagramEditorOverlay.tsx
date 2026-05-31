import { useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, Check, Download, History, Image, Loader2, Maximize2, RotateCcw, Save, X } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { readWorkspaceFile, writeWorkspaceFile } from "@catbuddy/platform";

export interface DiagramEditorTarget {
  path: string;
  absolutePath?: string;
  xml?: string;
}

interface DiagramEditorOverlayProps {
  target: DiagramEditorTarget | null;
  onClose: () => void;
  embedded?: boolean;
}

type DiagramSnapshot = {
  id: string;
  xml: string;
  createdAt: number;
  label: string;
};

type EditorStatus = "loading" | "ready" | "saving" | "saved" | "error";

const DRAWIO_BASE_URL = "https://embed.diagrams.net";

function diagramName(path: string): string {
  return path.replace(/\\/g, "/").split("/").pop() || path;
}

function buildDrawioUrl(): string {
  const params = new URLSearchParams({
    embed: "1",
    proto: "json",
    spin: "0",
    libraries: "0",
    saveAndExit: "0",
    noSaveBtn: "1",
    noExitBtn: "1",
    ui: "min",
  });
  return `${DRAWIO_BASE_URL}/?${params.toString()}`;
}

function extractDrawioXml(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const data = payload as { xml?: unknown; data?: unknown };
  if (typeof data.xml === "string") return data.xml;
  if (typeof data.data === "string") {
    const match = data.data.match(/content="([^"]+)"/);
    if (match?.[1]) {
      try {
        const decoded = decodeURIComponent(match[1]);
        return decoded;
      } catch {
        return match[1];
      }
    }
  }
  return null;
}

function downloadText(filename: string, content: string, mime: string): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function downloadDataUrl(filename: string, dataUrl: string): void {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export function DiagramEditorOverlay({ target, onClose, embedded = false }: DiagramEditorOverlayProps) {
  const { t } = useTranslation();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [status, setStatus] = useState<EditorStatus>("loading");
  const [error, setError] = useState<string | null>(null);
  const [xml, setXml] = useState("");
  const [drawioReady, setDrawioReady] = useState(false);
  const pendingSaveRef = useRef(false);
  const pendingExportRef = useRef<"svg" | "png" | null>(null);
  const [snapshots, setSnapshots] = useState<DiagramSnapshot[]>([]);
  const url = useMemo(buildDrawioUrl, []);

  useEffect(() => {
    if (!target) return;
    let cancelled = false;
    setStatus("loading");
    setError(null);
    setXml("");
    pendingSaveRef.current = false;
    pendingExportRef.current = null;
    setSnapshots([]);

    if (target.xml?.trim()) {
      const inlineXml = target.xml;
      setXml(inlineXml);
      setSnapshots([{ id: "initial", xml: inlineXml, createdAt: Date.now(), label: "Initial" }]);
      return () => {
        cancelled = true;
      };
    }

    readWorkspaceFile(target.path, target.absolutePath).then((result) => {
      if (cancelled) return;
      if (!result.ok || typeof result.content !== "string") {
        setStatus("error");
        setError(result.error || "read_failed");
        return;
      }
      setXml(result.content);
      setSnapshots([{ id: "initial", xml: result.content, createdAt: Date.now(), label: "Initial" }]);
    });

    return () => {
      cancelled = true;
    };
  }, [target]);

  useEffect(() => {
    if (!target) return;
    const onMessage = (event: MessageEvent) => {
      if (event.source !== iframeRef.current?.contentWindow) return;
      let payload: unknown = event.data;
      if (typeof payload === "string") {
        try {
          payload = JSON.parse(payload);
        } catch {
          return;
        }
      }
      if (!payload || typeof payload !== "object") return;
      const msg = payload as { event?: string };

      if (msg.event === "init") {
        setDrawioReady(true);
        return;
      }

      if (msg.event === "load") {
        setStatus("ready");
        return;
      }

      if (msg.event === "export") {
        const exportFormat = pendingExportRef.current;
        if (exportFormat) {
          pendingExportRef.current = null;
          const exportedPayload = payload as Record<string, unknown>;
          const filename = `${diagramName(target.path).replace(/\.drawio$/i, "")}.${exportFormat}`;
          if (exportFormat === "svg") {
            const svg = typeof exportedPayload.svg === "string" ? exportedPayload.svg : extractDrawioXml(exportedPayload);
            if (svg) downloadText(filename, svg, "image/svg+xml;charset=utf-8");
          } else {
            const dataUrl = typeof exportedPayload.data === "string" ? exportedPayload.data : "";
            if (dataUrl.startsWith("data:image/")) downloadDataUrl(filename, dataUrl);
          }
          setStatus("ready");
          return;
        }

        const exportedXml = extractDrawioXml(payload);
        if (!pendingSaveRef.current || !exportedXml) return;
        pendingSaveRef.current = false;
        setStatus("saving");
        writeWorkspaceFile(target.path, exportedXml, target.absolutePath).then((result) => {
          if (!result.ok) {
            setStatus("error");
            setError(result.error || "save_failed");
            return;
          }
          setXml(exportedXml);
          setSnapshots((prev) => [
            ...prev.slice(-9),
            {
              id: `${Date.now()}`,
              xml: exportedXml,
              createdAt: Date.now(),
              label: new Date().toLocaleTimeString(),
            },
          ]);
          setStatus("saved");
          window.setTimeout(() => setStatus("ready"), 1400);
        });
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [target]);

  useEffect(() => {
    if (!drawioReady || !xml) return;
    iframeRef.current?.contentWindow?.postMessage(
      JSON.stringify({ action: "load", xml, autosave: 1 }),
      "*",
    );
  }, [drawioReady, xml]);

  if (!target) return null;

  const title = diagramName(target.path);
  const saving = status === "saving";
  const loading = status === "loading";

  const saveDiagram = () => {
    if (!iframeRef.current || saving || loading) return;
    pendingSaveRef.current = true;
    setStatus("saving");
    iframeRef.current.contentWindow?.postMessage(
      JSON.stringify({ action: "export", format: "xml" }),
      "*",
    );
  };

  const exportDiagram = (format: "svg" | "png") => {
    if (!iframeRef.current || loading || status === "error") return;
    pendingExportRef.current = format;
    iframeRef.current.contentWindow?.postMessage(
      JSON.stringify({ action: "export", format, xml: format === "svg" ? 1 : undefined }),
      "*",
    );
  };

  const restoreSnapshot = (snapshot: DiagramSnapshot) => {
    setXml(snapshot.xml);
    setStatus("ready");
  };

  const rootClassName = embedded
    ? "flex h-full min-h-0 flex-col bg-background"
    : "fixed inset-0 z-[70] flex flex-col bg-background";

  return (
    <div className={rootClassName}>
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border/70 bg-background/95 px-4 shadow-sm backdrop-blur">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-300">
          <Maximize2 className="h-4 w-4" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-sm font-semibold tracking-[-0.01em] text-foreground">
            {title}
          </h2>
          <p className="truncate text-xs text-muted-foreground">
            {target.path.replace(/\\/g, "/")}
          </p>
        </div>
        {status === "saved" ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-300">
            <Check className="h-3.5 w-3.5" aria-hidden />
            {t("diagramEditor.saved", { defaultValue: "Saved" })}
          </span>
        ) : null}
        <div className="hidden items-center gap-1 rounded-full border border-border/70 bg-muted/40 px-1 py-1 xl:flex">
          <History className="ml-1.5 h-3.5 w-3.5 text-muted-foreground" aria-hidden />
          <select
            aria-label="Diagram history"
            className="h-7 max-w-32 bg-transparent text-xs outline-none"
            value=""
            onChange={(event) => {
              const found = snapshots.find((snapshot) => snapshot.id === event.target.value);
              if (found) restoreSnapshot(found);
            }}
          >
            <option value="" disabled>History</option>
            {snapshots.slice().reverse().map((snapshot) => (
              <option key={snapshot.id} value={snapshot.id}>{snapshot.label}</option>
            ))}
          </select>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            disabled={snapshots.length < 2}
            onClick={() => restoreSnapshot(snapshots[snapshots.length - 2])}
            aria-label="Restore previous snapshot"
            className="h-7 w-7 rounded-full"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden />
          </Button>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => exportDiagram("svg")}
          disabled={loading || status === "error"}
          className="hidden gap-2 rounded-full sm:inline-flex"
        >
          <Download className="h-4 w-4" aria-hidden />
          SVG
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => exportDiagram("png")}
          disabled={loading || status === "error"}
          className="hidden gap-2 rounded-full sm:inline-flex"
        >
          <Image className="h-4 w-4" aria-hidden />
          PNG
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={saveDiagram}
          disabled={saving || loading || status === "error"}
          className="gap-2 rounded-full"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Save className="h-4 w-4" aria-hidden />}
          {saving
            ? t("diagramEditor.saving", { defaultValue: "Saving" })
            : t("diagramEditor.save", { defaultValue: "Save" })}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onClose}
          aria-label={t("diagramEditor.close", { defaultValue: "Back to chat" })}
          className="rounded-full"
        >
          <X className="h-4 w-4" aria-hidden />
        </Button>
      </header>

      <div className="relative min-h-0 flex-1 bg-muted/30 p-2 sm:p-3">
        <div className="h-full overflow-hidden rounded-2xl border border-border/70 bg-background shadow-xl shadow-slate-950/5 dark:shadow-black/25">
          <iframe
            ref={iframeRef}
            title={t("diagramEditor.iframeTitle", { defaultValue: "Draw.io diagram editor" })}
            src={url}
            className="h-full w-full border-0"
            allow="clipboard-read; clipboard-write"
          />
        </div>
        {(loading || status === "error") ? (
          <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm">
            <div className="max-w-sm rounded-2xl border border-border/70 bg-card p-5 text-center shadow-xl">
              {status === "error" ? (
                <AlertCircle className="mx-auto mb-3 h-8 w-8 text-destructive" aria-hidden />
              ) : (
                <Loader2 className="mx-auto mb-3 h-8 w-8 animate-spin text-sky-500" aria-hidden />
              )}
              <p className="text-sm font-medium text-foreground">
                {status === "error"
                  ? t("diagramEditor.failed", { defaultValue: "Failed to open diagram" })
                  : t("diagramEditor.loading", { defaultValue: "Loading diagram editor…" })}
              </p>
              {error ? (
                <p className="mt-1 text-xs text-muted-foreground">{error}</p>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
