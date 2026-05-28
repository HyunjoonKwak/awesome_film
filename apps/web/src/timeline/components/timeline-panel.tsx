"use client";

import { useCallback, useRef } from "react";
import { Plus } from "lucide-react";
import { useProjectStore, selectZoom } from "@/stores/project-store";
import { useRangeStore } from "@/stores/range-store";
import { usePinchZoom } from "@/hooks/use-pinch-zoom";
import { useT } from "@/i18n/use-t";
import { TimelineRuler } from "./timeline-ruler";
import { TimelineTrack } from "./timeline-track";
import { Playhead } from "./playhead";
import { TimelineZoom } from "./timeline-zoom";
import { MarkerStrip } from "./marker-strip";
import { PeerCursors } from "./peer-cursors";
import { RangeBand } from "./range-band";

const PX_PER_MS_MIN = 0.005;
const PX_PER_MS_MAX = 1;
const TRACK_HEADER_W = 96;

export function TimelinePanel() {
  const containerRef = useRef<HTMLDivElement>(null);
  const tracks = useProjectStore((s) => s.project.timeline.tracks);
  const duration = useProjectStore((s) => s.project.timeline.duration);
  const zoom = useProjectStore(selectZoom);
  const setZoom = useProjectStore((s) => s.setZoomLevel);
  const setPlayhead = useProjectStore((s) => s.setPlayheadMs);
  const addNewTrack = useProjectStore((s) => s.addNewTrack);
  const hasRange = useRangeStore((s) => s.inMs !== null || s.outMs !== null);
  const t = useT();

  const onWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
      const next = Math.min(PX_PER_MS_MAX, Math.max(PX_PER_MS_MIN, zoom * factor));
      setZoom(next);
    }
  };

  // Two-finger pinch zoom for touch / trackpad gestures.
  usePinchZoom(containerRef, {
    onZoom: (factor) => {
      const next = Math.min(PX_PER_MS_MAX, Math.max(PX_PER_MS_MIN, zoom * factor));
      setZoom(next);
    },
    onPan: (dx) => {
      const el = containerRef.current;
      if (el) el.scrollLeft -= dx;
    },
  });

  const minWidth = Math.max(1200, duration * zoom + 800);

  const seekFromPointer = useCallback(
    (clientX: number) => {
      const inner = containerRef.current?.querySelector<HTMLDivElement>("[data-tl-inner]");
      if (!inner) return;
      const rect = inner.getBoundingClientRect();
      const x = clientX - rect.left - TRACK_HEADER_W;
      setPlayhead(Math.max(0, x / zoom));
    },
    [setPlayhead, zoom],
  );

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    // Only seek if click landed on the ruler / background, not on a clip.
    const target = e.target as HTMLElement;
    if (target.closest("[data-clip]")) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    seekFromPointer(e.clientX);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if ((e.buttons & 1) === 0) return;
    seekFromPointer(e.clientX);
  };

  return (
    <div className="flex h-full flex-col bg-panel-1">
      <div className="flex items-center justify-between border-b border-white/5 px-3 py-1.5">
        <div className="flex items-center gap-2">
          <span className="text-xs uppercase tracking-wider text-ink-3">{t("timeline.title")}</span>
          <button
            type="button"
            className="btn-ghost px-1.5 py-0.5 text-[11px]"
            onClick={() => addNewTrack("video")}
            title={t("timeline.addVideoTrack")}
          >
            <Plus className="size-3" /> V
          </button>
          <button
            type="button"
            className="btn-ghost px-1.5 py-0.5 text-[11px]"
            onClick={() => addNewTrack("audio")}
            title={t("timeline.addAudioTrack")}
          >
            <Plus className="size-3" /> A
          </button>
          <button
            type="button"
            className="btn-ghost px-1.5 py-0.5 text-[11px]"
            onClick={() => useProjectStore.getState().addTextClipAtPlayhead("Title")}
            title={t("timeline.addTextClip")}
          >
            <Plus className="size-3" /> T
          </button>
          <details className="relative">
            <summary className="btn-ghost cursor-pointer list-none px-1.5 py-0.5 text-[11px]">
              <Plus className="size-3" /> {t("timeline.shape")}
            </summary>
            <div className="absolute left-0 z-30 mt-1 w-32 rounded-md border border-white/10 bg-panel-3 p-1 shadow-lg">
              {(["rect", "ellipse", "line"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => useProjectStore.getState().addShapeClipAtPlayhead(s)}
                  className="block w-full rounded px-2 py-1 text-left text-xs text-ink-1 hover:bg-white/10"
                >
                  {t(`shape.${s}`)}
                </button>
              ))}
            </div>
          </details>
          <details className="relative">
            <summary className="btn-ghost cursor-pointer list-none px-1.5 py-0.5 text-[11px]">
              <Plus className="size-3" /> {t("timeline.titleTpl")}
            </summary>
            <div className="absolute left-0 z-30 mt-1 w-36 rounded-md border border-white/10 bg-panel-3 p-1 shadow-lg">
              {(["title", "subtitle", "lowerThird"] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => useProjectStore.getState().addTitleTemplate(k)}
                  className="block w-full rounded px-2 py-1 text-left text-xs text-ink-1 hover:bg-white/10"
                >
                  {t(`titleTpl.${k}`)}
                </button>
              ))}
            </div>
          </details>
          <button
            type="button"
            className="btn-ghost px-1.5 py-0.5 text-[11px]"
            onClick={() => useProjectStore.getState().addAdjustmentClipAtPlayhead()}
            title={t("timeline.addAdjustment")}
          >
            <Plus className="size-3" /> {t("timeline.adjustment")}
          </button>
          <div className="mx-1 h-4 w-px bg-white/10" />
          <button
            type="button"
            className="btn-ghost px-1.5 py-0.5 text-[11px]"
            onClick={() => useRangeStore.getState().setIn(useProjectStore.getState().project.timeline.playhead)}
            title={t("range.setIn")}
          >
            {t("range.in")}
          </button>
          <button
            type="button"
            className="btn-ghost px-1.5 py-0.5 text-[11px]"
            onClick={() => useRangeStore.getState().setOut(useProjectStore.getState().project.timeline.playhead)}
            title={t("range.setOut")}
          >
            {t("range.out")}
          </button>
          {hasRange && (
            <button
              type="button"
              className="btn-ghost px-1.5 py-0.5 text-[11px] text-ink-3"
              onClick={() => useRangeStore.getState().clear()}
              title={t("range.clear")}
            >
              {t("range.clear")}
            </button>
          )}
        </div>
        <TimelineZoom />
      </div>

      <div
        ref={containerRef}
        className="relative flex-1 overflow-auto"
        onWheel={onWheel}
      >
        <div
          data-tl-inner
          className="relative"
          style={{ minWidth }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
        >
          <TimelineRuler width={minWidth} />
          <MarkerStrip />
          <RangeBand />
          <div className="flex flex-col gap-1 px-0 py-2">
            {tracks.map((track) => (
              <TimelineTrack key={track.id} track={track} width={minWidth} />
            ))}
          </div>
          <Playhead containerWidth={minWidth} />
          <PeerCursors />
        </div>
      </div>
    </div>
  );
}
