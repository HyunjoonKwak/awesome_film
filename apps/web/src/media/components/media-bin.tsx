"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FolderUp, Music, Image as ImageIcon, Film, Layers, Loader2, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useProjectStore } from "@/stores/project-store";
import { useTimelineUiStore } from "@/stores/timeline-ui-store";
import { useMediaImport } from "@/media/hooks";
import { cn } from "@/lib/cn";
import { useT } from "@/i18n/use-t";
import type { MediaAsset, MediaKind } from "@cut/core";
import { newId } from "@cut/core";
import { deleteMediaFile, getStorageUsage } from "@/persistence/opfs";
import { generateProxy } from "@/media/proxy";

const KIND_ICON = { video: Film, audio: Music, image: ImageIcon } as const;
const KIND_FILTERS: ReadonlyArray<MediaKind | "all"> = ["all", "video", "audio", "image"];

const formatBytes = (b: number): string => {
  if (b < 1024) return `${b} B`;
  if (b < 1_048_576) return `${(b / 1024).toFixed(1)} KB`;
  if (b < 1_073_741_824) return `${(b / 1_048_576).toFixed(1)} MB`;
  return `${(b / 1_073_741_824).toFixed(2)} GB`;
};

export function MediaBin() {
  const inputRef = useRef<HTMLInputElement>(null);
  const media = useProjectStore((s) => s.project.mediaLibrary);
  const removeMediaAsset = useProjectStore((s) => s.removeMediaAsset);
  const setAssetProxy = useProjectStore((s) => s.setAssetProxy);
  const { importing, importFiles } = useMediaImport();
  const t = useT();
  const [proxying, setProxying] = useState<string | null>(null);

  const makeProxy = useCallback(
    async (asset: MediaAsset) => {
      setProxying(asset.id);
      const toastId = toast.loading(t("media.proxyBuilding"));
      try {
        const result = await generateProxy(asset, (pct) =>
          toast.loading(t("media.proxyProgress", { n: Math.round(pct * 100) }), { id: toastId }),
        );
        if (!result) {
          toast.error(t("media.proxyUnsupported"), { id: toastId });
          return;
        }
        setAssetProxy(asset.id, result);
        toast.success(t("media.proxyDone"), { id: toastId });
      } catch (err) {
        toast.error(`${t("media.proxyFailed")}: ${err instanceof Error ? err.message : err}`, {
          id: toastId,
        });
      } finally {
        setProxying(null);
      }
    },
    [setAssetProxy, t],
  );

  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<MediaKind | "all">("all");
  const [usage, setUsage] = useState<{ usageBytes: number; quotaBytes: number } | null>(
    null,
  );

  useEffect(() => {
    void getStorageUsage().then(setUsage);
  }, [media.length]);

  const onChooseFiles = useCallback(() => inputRef.current?.click(), []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const files = e.dataTransfer?.files;
      if (files && files.length > 0) void importFiles(files);
    },
    [importFiles],
  );

  const addToTimeline = useCallback((asset: MediaAsset) => {
    const store = useProjectStore.getState();
    const targetKind = asset.kind === "audio" ? "audio" : "video";
    const track = store.project.timeline.tracks.find((tr) => tr.kind === targetKind);
    if (!track) return;
    const startMs = track.clips.reduce(
      (max, c) => Math.max(max, c.start + c.duration),
      0,
    );
    store.addClipToTrack(track.id, {
      kind: "media",
      id: newId(),
      assetId: asset.id,
      start: startMs,
      duration: asset.durationMs,
      trimIn: 0,
      trimOut: asset.durationMs,
      speed: 1,
      effects: [],
      keyframes: [],
    });
  }, []);

  const handleDelete = useCallback(
    async (asset: MediaAsset) => {
      try {
        removeMediaAsset(asset.id);
        await deleteMediaFile(asset.opfsPath);
        toast.success(t("media.deleted", { name: asset.name }));
      } catch (err) {
        toast.error(`${t("media.deleteFailed")}: ${err instanceof Error ? err.message : err}`);
      }
    },
    [removeMediaAsset, t],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return media.filter(
      (a) =>
        (filter === "all" || a.kind === filter) &&
        (q.length === 0 || a.name.toLowerCase().includes(q)),
    );
  }, [media, query, filter]);

  return (
    <div className="flex h-full flex-col">
      <div className="panel-header">
        <span>{t("media.title")}</span>
        <button
          type="button"
          className="btn-ghost text-xs"
          onClick={onChooseFiles}
          disabled={importing}
        >
          <FolderUp className="size-3.5" />
          {t("media.import")}
        </button>
      </div>

      {media.length > 0 && (
        <div className="space-y-2 px-2 pb-2">
          <label className="relative flex items-center">
            <Search className="absolute left-2 size-3 text-ink-3" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("media.search")}
              className="w-full rounded bg-white/5 py-1 pl-7 pr-2 text-xs text-ink-1 outline-none focus:bg-white/10"
            />
          </label>
          <div className="flex items-center gap-1">
            {KIND_FILTERS.map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setFilter(k)}
                className={cn(
                  "rounded px-1.5 py-0.5 text-[10px] uppercase tracking-wider",
                  filter === k
                    ? "bg-accent text-accent-fg"
                    : "text-ink-3 hover:text-ink-1",
                )}
              >
                {k}
              </button>
            ))}
          </div>
        </div>
      )}

      <div
        className={cn(
          "relative flex-1 overflow-y-auto p-2",
          "data-[dropping=true]:bg-accent/5",
        )}
        onDragOver={(e) => e.preventDefault()}
        onDrop={onDrop}
      >
        {media.length === 0 && (
          <button
            type="button"
            onClick={onChooseFiles}
            className="mx-auto mt-12 flex h-44 w-full flex-col items-center justify-center gap-2
                       rounded-xl border border-dashed border-white/10 text-ink-3 hover:border-accent
                       hover:text-accent transition-colors"
          >
            <FolderUp className="size-6" />
            <span className="text-sm">{t("media.dropHere")}</span>
            <span className="text-xs">{t("media.browseHere")}</span>
          </button>
        )}

        {filtered.length === 0 && media.length > 0 && (
          <p className="px-2 py-6 text-center text-xs text-ink-3">
            {t("media.noMatches")}
          </p>
        )}

        <ul className="grid grid-cols-2 gap-2">
          {filtered.map((asset) => {
            const Icon = KIND_ICON[asset.kind];
            return (
              <li key={asset.id} className="group relative">
                <button
                  type="button"
                  onClick={() => addToTimeline(asset)}
                  draggable
                  onDragStart={(e) => {
                    // Tracks read the dragged asset from the UI store —
                    // dataTransfer is set too for completeness.
                    e.dataTransfer.setData("application/x-cut-asset", asset.id);
                    e.dataTransfer.effectAllowed = "copy";
                    useTimelineUiStore.getState().setDragAssetId(asset.id);
                  }}
                  onDragEnd={() => useTimelineUiStore.getState().setDragAssetId(null)}
                  className="w-full overflow-hidden rounded-md border border-white/5
                             bg-panel-2 text-left transition hover:border-accent"
                  title={t("media.clickToAdd")}
                >
                  <div className="relative aspect-video bg-black">
                    {asset.thumbDataUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={asset.thumbDataUrl}
                        alt={asset.name}
                        className="size-full object-cover"
                      />
                    ) : (
                      <div className="flex size-full items-center justify-center text-ink-3">
                        <Icon className="size-6" />
                      </div>
                    )}
                    {asset.width && asset.height && (
                      <span className="absolute bottom-1 right-1 rounded bg-black/60 px-1 py-0.5 text-[9px] font-mono text-white">
                        {asset.width}×{asset.height}
                      </span>
                    )}
                    {asset.proxyPath && (
                      <span className="absolute bottom-1 left-1 rounded bg-accent/80 px-1 py-0.5 text-[9px] font-medium text-white">
                        PROXY
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 px-2 py-1.5">
                    <Icon className="size-3 shrink-0 text-ink-3" />
                    <span className="truncate text-xs text-ink-1">{asset.name}</span>
                  </div>
                </button>
                <div className="absolute right-1 top-1 flex gap-1 opacity-0 transition group-hover:opacity-100">
                  {asset.kind === "video" && !asset.proxyPath && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        void makeProxy(asset);
                      }}
                      disabled={proxying !== null}
                      className="rounded bg-black/60 p-1 text-ink-1 hover:bg-accent/40 hover:text-white disabled:opacity-50"
                      title={t("media.proxy")}
                    >
                      {proxying === asset.id ? (
                        <Loader2 className="size-3 animate-spin" />
                      ) : (
                        <Layers className="size-3" />
                      )}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      void handleDelete(asset);
                    }}
                    className="rounded bg-black/60 p-1 text-ink-1 hover:bg-red-500/40 hover:text-red-200"
                    title={t("media.delete")}
                  >
                    <Trash2 className="size-3" />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>

        <input
          ref={inputRef}
          type="file"
          accept="video/*,audio/*,image/*"
          multiple
          hidden
          onChange={(e) => {
            if (e.target.files) void importFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {usage && usage.quotaBytes > 0 && (
        <div className="border-t border-white/5 px-2 py-1.5 text-[10px] text-ink-3">
          <div className="flex justify-between">
            <span>{t("media.storage")}</span>
            <span className="font-mono">
              {formatBytes(usage.usageBytes)} / {formatBytes(usage.quotaBytes)}
            </span>
          </div>
          <div className="mt-1 h-1 overflow-hidden rounded bg-white/5">
            <div
              className="h-full bg-accent transition-[width]"
              style={{
                width: `${Math.min(100, (usage.usageBytes / usage.quotaBytes) * 100)}%`,
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
