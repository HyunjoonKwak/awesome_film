"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FolderUp,
  Music,
  Image as ImageIcon,
  Film,
  Layers,
  Loader2,
  Pin,
  Scissors,
  Search,
  Trash2,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { toast } from "sonner";
import { useProjectStore } from "@/stores/project-store";
import { useTimelineUiStore } from "@/stores/timeline-ui-store";
import { useMediaImport } from "@/media/hooks";
import { useImportProgressStore } from "@/media/import-progress-store";
import { useAutoEditStore } from "@/autoedit/autoedit-store";
import type { ID } from "@cut/core";
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

const fmtSec = (ms: number): string => `${(ms / 1000).toFixed(1)}s`;

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
        try {
          setAssetProxy(asset.id, result);
        } finally {
          result.releaseLease();
        }
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
  const [usage, setUsage] = useState<{ usageBytes: number; quotaBytes: number } | null>(null);

  // 썸네일 크기 (0=S, 1=M, 2=L) — localStorage에 유지.
  const [thumbSize, setThumbSize] = useState(1);
  useEffect(() => {
    const v = Number(localStorage.getItem("cut.media.thumbSize"));
    if (v >= 0 && v <= 2) setThumbSize(v);
  }, []);
  useEffect(() => {
    localStorage.setItem("cut.media.thumbSize", String(thumbSize));
  }, [thumbSize]);

  // 다중 선택 (Cmd/Ctrl+클릭, 빈 공간 드래그 마퀴) + 자동 편집 사용/제외 연동.
  const [selected, setSelected] = useState<ReadonlySet<ID>>(new Set());
  const [rangeEditing, setRangeEditing] = useState<ID | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const marqueeStart = useRef<{ x: number; y: number } | null>(null);
  const [marquee, setMarquee] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const pinned = useAutoEditStore((s) => s.pinned);
  const excluded = useAutoEditStore((s) => s.excluded);

  const toLocal = useCallback((e: React.PointerEvent) => {
    const el = listRef.current!;
    const r = el.getBoundingClientRect();
    return { x: e.clientX - r.left + el.scrollLeft, y: e.clientY - r.top + el.scrollTop };
  }, []);

  const onMarqueeDown = useCallback(
    (e: React.PointerEvent) => {
      if ((e.target as HTMLElement).closest("[data-asset-card]")) return; // 카드 위에서는 드래그-투-타임라인 유지
      if (e.button !== 0) return;
      marqueeStart.current = toLocal(e);
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    },
    [toLocal],
  );

  const onMarqueeMove = useCallback(
    (e: React.PointerEvent) => {
      const start = marqueeStart.current;
      if (!start) return;
      const cur = toLocal(e);
      const rect = {
        x: Math.min(start.x, cur.x),
        y: Math.min(start.y, cur.y),
        w: Math.abs(cur.x - start.x),
        h: Math.abs(cur.y - start.y),
      };
      if (rect.w < 4 && rect.h < 4) return;
      setMarquee(rect);
      // 교차하는 카드 선택
      const el = listRef.current!;
      const cRect = el.getBoundingClientRect();
      const next = new Set<ID>();
      for (const li of el.querySelectorAll<HTMLElement>("[data-asset-card]")) {
        const r = li.getBoundingClientRect();
        const lx = r.left - cRect.left + el.scrollLeft;
        const ly = r.top - cRect.top + el.scrollTop;
        const hit = lx < rect.x + rect.w && lx + r.width > rect.x && ly < rect.y + rect.h && ly + r.height > rect.y;
        if (hit) next.add(li.dataset.assetCard as ID);
      }
      setSelected(next);
    },
    [toLocal],
  );

  const onMarqueeUp = useCallback(() => {
    if (marqueeStart.current && !marquee) setSelected(new Set()); // 빈 공간 클릭 = 선택 해제
    marqueeStart.current = null;
    setMarquee(null);
  }, [marquee]);

  const toggleSelect = useCallback((id: ID) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: re-query storage only when the library size changes, not on every metadata edit.
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
    const startMs = track.clips.reduce((max, c) => Math.max(max, c.start + c.duration), 0);
    // 사용 구간이 지정되어 있으면 그 구간만 추가.
    const inMs = asset.useInMs ?? 0;
    const outMs = asset.useOutMs ?? asset.durationMs;
    store.addClipToTrack(track.id, {
      kind: "media",
      id: newId(),
      assetId: asset.id,
      start: startMs,
      duration: Math.max(200, outMs - inMs),
      trimIn: inMs,
      trimOut: outMs,
      speed: 1,
      effects: [],
      keyframes: [],
    });
  }, []);

  const handleDelete = useCallback(
    (asset: MediaAsset) => {
      // Metadata-only delete: keep the OPFS blob (and proxy) so Undo can fully
      // restore the clip and its media. Orphaned blobs are reclaimed by
      // startup GC once no project — current or saved — references them.
      try {
        removeMediaAsset(asset.id);
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

      <ImportProgress />

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
                  "rounded px-1.5 py-0.5 text-3xs uppercase tracking-wider",
                  filter === k ? "bg-accent text-accent-fg" : "text-ink-3 hover:text-ink-1",
                )}
              >
                {k}
              </button>
            ))}
            <div className="ml-auto flex items-center gap-1" title={t("media.thumbSize")}>
              <ZoomOut className="size-3 text-ink-3" />
              <input
                type="range"
                min={0}
                max={2}
                step={1}
                value={thumbSize}
                onChange={(e) => setThumbSize(Number(e.target.value))}
                className="w-14 accent-[var(--accent)]"
                aria-label={t("media.thumbSize")}
              />
              <ZoomIn className="size-3 text-ink-3" />
            </div>
          </div>
        </div>
      )}

      {selected.size > 0 && (
        <BulkBar
          count={selected.size}
          onUse={() => useAutoEditStore.getState().markPinned([...selected])}
          onSkip={() => useAutoEditStore.getState().markExcluded([...selected])}
          onClearMarks={() => useAutoEditStore.getState().clearMarks([...selected])}
          onDeselect={() => setSelected(new Set())}
        />
      )}

      <div
        ref={listRef}
        className={cn(
          "relative flex-1 select-none overflow-y-auto p-2",
          "data-[dropping=true]:bg-accent/5",
        )}
        onDragOver={(e) => e.preventDefault()}
        onDrop={onDrop}
        onPointerDown={onMarqueeDown}
        onPointerMove={onMarqueeMove}
        onPointerUp={onMarqueeUp}
      >
        {marquee && (
          <div
            className="pointer-events-none absolute z-20 rounded-sm border border-accent bg-accent/10"
            style={{ left: marquee.x, top: marquee.y, width: marquee.w, height: marquee.h }}
          />
        )}
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
          <p className="px-2 py-6 text-center text-xs text-ink-3">{t("media.noMatches")}</p>
        )}

        <ul
          className={cn(
            "grid gap-2",
            thumbSize === 0 ? "grid-cols-3" : thumbSize === 2 ? "grid-cols-1" : "grid-cols-2",
          )}
        >
          {filtered.map((asset) => {
            const Icon = KIND_ICON[asset.kind];
            const isSelected = selected.has(asset.id);
            const isPinned = pinned.includes(asset.id);
            const isExcluded = excluded.includes(asset.id);
            const hasRange = asset.useInMs !== undefined || asset.useOutMs !== undefined;
            return (
              <li key={asset.id} className="group relative" data-asset-card={asset.id}>
                <button
                  type="button"
                  onClick={(e) => {
                    if (e.metaKey || e.ctrlKey || e.shiftKey) {
                      toggleSelect(asset.id);
                      return;
                    }
                    if (selected.size > 0) {
                      // 선택 모드 중에는 클릭이 선택 토글로 동작 (실수로 타임라인 추가 방지)
                      toggleSelect(asset.id);
                      return;
                    }
                    addToTimeline(asset);
                  }}
                  draggable
                  onDragStart={(e) => {
                    // Tracks read the dragged asset from the UI store —
                    // dataTransfer is set too for completeness.
                    e.dataTransfer.setData("application/x-cut-asset", asset.id);
                    e.dataTransfer.effectAllowed = "copy";
                    useTimelineUiStore.getState().setDragAssetId(asset.id);
                  }}
                  onDragEnd={() => useTimelineUiStore.getState().setDragAssetId(null)}
                  className={cn(
                    "w-full overflow-hidden rounded-md border text-left transition",
                    isSelected
                      ? "border-accent ring-2 ring-accent/60"
                      : "border-white/5 hover:border-accent",
                    isExcluded ? "opacity-45" : "bg-panel-2",
                  )}
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
                      <span className="absolute bottom-1 right-1 rounded bg-black/60 px-1 py-0.5 text-3xs font-mono text-white">
                        {asset.width}×{asset.height}
                      </span>
                    )}
                    {asset.proxyPath && (
                      <span className="absolute bottom-1 left-1 rounded bg-accent/80 px-1 py-0.5 text-3xs font-medium text-white">
                        PROXY
                      </span>
                    )}
                    <div className="absolute left-1 top-1 flex flex-col items-start gap-0.5">
                      {isPinned && (
                        <span className="flex items-center gap-0.5 rounded bg-accent/90 px-1 py-0.5 text-3xs font-medium text-accent-fg">
                          <Pin className="size-2.5" />
                          {t("media.markUse")}
                        </span>
                      )}
                      {isExcluded && (
                        <span className="flex items-center gap-0.5 rounded bg-red-500/85 px-1 py-0.5 text-3xs font-medium text-white">
                          <X className="size-2.5" />
                          {t("media.markSkip")}
                        </span>
                      )}
                      {hasRange && (
                        <span className="flex items-center gap-0.5 rounded bg-black/60 px-1 py-0.5 text-3xs font-mono text-amber-300">
                          <Scissors className="size-2.5" />
                          {fmtSec(asset.useInMs ?? 0)}–{fmtSec(asset.useOutMs ?? asset.durationMs)}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 px-2 py-1.5">
                    <Icon className="size-3 shrink-0 text-ink-3" />
                    <span className="truncate text-xs text-ink-1">{asset.name}</span>
                  </div>
                </button>
                <div className="absolute right-1 top-1 flex gap-1 opacity-0 transition group-hover:opacity-100">
                  {asset.kind !== "image" && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setRangeEditing(rangeEditing === asset.id ? null : asset.id);
                      }}
                      className={cn(
                        "rounded bg-black/60 p-1 hover:bg-amber-500/40 hover:text-white",
                        hasRange ? "text-amber-300" : "text-ink-1",
                      )}
                      title={t("media.range")}
                    >
                      <Scissors className="size-3" />
                    </button>
                  )}
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

      {rangeEditing &&
        (() => {
          const asset = media.find((a) => a.id === rangeEditing);
          if (!asset || asset.kind === "image") return null;
          return <RangeEditor asset={asset} onClose={() => setRangeEditing(null)} />;
        })()}

      {usage && usage.quotaBytes > 0 && (
        <div className="border-t border-white/5 px-2 py-1.5 text-3xs text-ink-3">
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

// 대량 가져오기 진행률 + 중단. hooks.ts의 임포트 루프가 파일 단위로 갱신하며,
// 중단 요청 시 남은 파일을 건너뛴다 (이미 완료된 파일은 유지).
function ImportProgress() {
  const t = useT();
  const { active, total, done, failed, currentName, cancelRequested, requestCancel } =
    useImportProgressStore();
  if (!active) return null;
  const processed = done + failed;
  const pct = total > 0 ? Math.round((processed / total) * 100) : 0;
  return (
    <div className="mx-2 mb-2 rounded border border-accent/30 bg-accent/10 p-2 text-2xs">
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium text-ink-1">
          {t("media.importProgress", { done: processed, total })}
        </span>
        <button
          type="button"
          onClick={requestCancel}
          disabled={cancelRequested}
          className="rounded border border-white/15 px-1.5 py-0.5 text-3xs text-ink-1 hover:border-red-400/60 hover:text-red-300 disabled:opacity-50"
        >
          {cancelRequested ? t("media.importStopping") : t("media.importStop")}
        </button>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/10">
        <div className="h-full bg-accent transition-[width]" style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-1 truncate text-ink-3">{currentName}</p>
    </div>
  );
}

// 선택된 자산 일괄 처리 바 — 자동 편집의 사용(핀)/제외 지정과 연동.
function BulkBar(props: {
  count: number;
  onUse: () => void;
  onSkip: () => void;
  onClearMarks: () => void;
  onDeselect: () => void;
}) {
  const t = useT();
  return (
    <div className="mx-2 mb-2 flex flex-wrap items-center gap-1 rounded border border-accent/30 bg-accent/10 px-2 py-1 text-2xs">
      <span className="mr-auto whitespace-nowrap font-medium text-ink-1">
        {t("media.selectedCount", { n: props.count })}
      </span>
      <button
        type="button"
        onClick={props.onUse}
        className="flex items-center gap-0.5 whitespace-nowrap rounded bg-accent/80 px-1.5 py-0.5 text-accent-fg hover:bg-accent"
      >
        <Pin className="size-2.5" />
        {t("media.markUse")}
      </button>
      <button
        type="button"
        onClick={props.onSkip}
        className="flex items-center gap-0.5 whitespace-nowrap rounded bg-red-500/70 px-1.5 py-0.5 text-white hover:bg-red-500"
      >
        <X className="size-2.5" />
        {t("media.markSkip")}
      </button>
      <button
        type="button"
        onClick={props.onClearMarks}
        className="whitespace-nowrap rounded border border-white/15 px-1.5 py-0.5 text-ink-1 hover:border-white/40"
      >
        {t("media.unmark")}
      </button>
      <button
        type="button"
        onClick={props.onDeselect}
        className="rounded p-0.5 text-ink-3 hover:text-ink-1"
        title={t("media.deselect")}
      >
        <X className="size-3" />
      </button>
    </div>
  );
}

// 사용 구간 편집 드로어 — 필름스트립(영상) 또는 파형(오디오) 위를 드래그해
// in/out을 지정한다. 드래그가 끝날 때 한 번만 커밋해 undo 1회로 남긴다.
function RangeEditor({ asset, onClose }: { asset: MediaAsset; onClose: () => void }) {
  const t = useT();
  const setAssetUseRange = useProjectStore((s) => s.setAssetUseRange);
  const stripRef = useRef<HTMLDivElement>(null);
  const dragging = useRef<{ anchorMs: number } | null>(null);
  const [inMs, setInMs] = useState(asset.useInMs ?? 0);
  const [outMs, setOutMs] = useState(asset.useOutMs ?? asset.durationMs);

  // 카드 배지에서 다른 자산으로 전환하면 로컬 상태 재초기화
  useEffect(() => {
    setInMs(asset.useInMs ?? 0);
    setOutMs(asset.useOutMs ?? asset.durationMs);
  }, [asset.useInMs, asset.useOutMs, asset.durationMs]);

  const msAt = (clientX: number): number => {
    const el = stripRef.current;
    if (!el) return 0;
    const r = el.getBoundingClientRect();
    const f = Math.min(1, Math.max(0, (clientX - r.left) / r.width));
    return Math.round(f * asset.durationMs);
  };

  const commit = (a: number, b: number) => {
    const lo = Math.max(0, Math.min(a, b));
    const hi = Math.min(asset.durationMs, Math.max(a, b));
    if (lo <= 0 && hi >= asset.durationMs) {
      setAssetUseRange(asset.id, undefined); // 전체 구간 = 지정 해제
    } else if (hi - lo >= 200) {
      setAssetUseRange(asset.id, { inMs: lo, outMs: hi });
    }
  };

  const onDown = (e: React.PointerEvent) => {
    const ms = msAt(e.clientX);
    dragging.current = { anchorMs: ms };
    setInMs(ms);
    setOutMs(ms);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onMove = (e: React.PointerEvent) => {
    if (!dragging.current) return;
    const ms = msAt(e.clientX);
    const { anchorMs } = dragging.current;
    setInMs(Math.min(anchorMs, ms));
    setOutMs(Math.max(anchorMs, ms));
  };
  const onUp = (e: React.PointerEvent) => {
    if (!dragging.current) return;
    const ms = msAt(e.clientX);
    const { anchorMs } = dragging.current;
    dragging.current = null;
    commit(Math.min(anchorMs, ms), Math.max(anchorMs, ms));
  };

  const leftPct = (Math.min(inMs, outMs) / Math.max(1, asset.durationMs)) * 100;
  const rightPct = 100 - (Math.max(inMs, outMs) / Math.max(1, asset.durationMs)) * 100;

  return (
    <div className="border-t border-white/10 bg-panel-2 p-2">
      <div className="mb-1.5 flex items-center gap-1.5 text-2xs">
        <Scissors className="size-3 text-amber-300" />
        <span className="truncate font-medium text-ink-1">{asset.name}</span>
        <span className="ml-auto font-mono text-ink-3">
          {fmtSec(inMs)} – {fmtSec(outMs)}
        </span>
        <button
          type="button"
          onClick={onClose}
          className="rounded p-0.5 text-ink-3 hover:text-ink-1"
          title={t("media.close")}
        >
          <X className="size-3" />
        </button>
      </div>

      <div
        ref={stripRef}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        className="relative h-12 cursor-crosshair touch-none select-none overflow-hidden rounded bg-black"
      >
        {asset.filmstripDataUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={asset.filmstripDataUrl}
            alt=""
            draggable={false}
            className="pointer-events-none size-full object-cover"
          />
        ) : asset.waveformPeaks && asset.waveformPeaks.length > 0 ? (
          <div className="pointer-events-none flex size-full items-center gap-px px-0.5">
            {asset.waveformPeaks.slice(0, 160).map((p, i) => (
              <div
                // 파형 막대는 정적 스냅샷 — 순서가 바뀌지 않으므로 인덱스 키가 안전
                // biome-ignore lint/suspicious/noArrayIndexKey: static waveform bars never reorder
                key={i}
                className="flex-1 rounded-sm bg-accent/60"
                style={{ height: `${Math.max(6, p * 100)}%` }}
              />
            ))}
          </div>
        ) : (
          <div className="pointer-events-none size-full bg-gradient-to-r from-accent/20 to-accent/40" />
        )}
        {/* 구간 밖 마스크 + 경계 핸들 */}
        <div
          className="pointer-events-none absolute inset-y-0 left-0 bg-black/70"
          style={{ width: `${leftPct}%` }}
        />
        <div
          className="pointer-events-none absolute inset-y-0 right-0 bg-black/70"
          style={{ width: `${rightPct}%` }}
        />
        <div
          className="pointer-events-none absolute inset-y-0 w-0.5 bg-amber-300"
          style={{ left: `${leftPct}%` }}
        />
        <div
          className="pointer-events-none absolute inset-y-0 w-0.5 bg-amber-300"
          style={{ right: `${rightPct}%` }}
        />
      </div>

      <div className="mt-1.5 flex items-center gap-2 text-3xs text-ink-3">
        <span>{t("media.rangeHint")}</span>
        <button
          type="button"
          onClick={() => {
            setInMs(0);
            setOutMs(asset.durationMs);
            setAssetUseRange(asset.id, undefined);
          }}
          className="ml-auto whitespace-nowrap rounded border border-white/15 px-1.5 py-0.5 text-ink-1 hover:border-white/40"
        >
          {t("media.rangeClear")}
        </button>
      </div>
    </div>
  );
}
