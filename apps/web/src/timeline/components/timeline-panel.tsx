"use client";

import { useCallback, useRef, useState } from "react";
import { Plus } from "lucide-react";
import { useProjectStore, selectZoom } from "@/stores/project-store";
import { useSelectionStore } from "@/stores/selection-store";
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
import { SnapGuide } from "./snap-guide";
import { SkimLine } from "./skim-line";
import { TRACK_HEADER_W, clampZoom } from "../constants";

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

  // Zoom keeping the timeline instant under the anchor x (viewport px from
  // the container's left edge) stationary — FCP-style pointer-centric zoom.
  const zoomAround = useCallback(
    (factor: number, anchorX: number) => {
      const el = containerRef.current;
      if (!el) return;
      const cur = useProjectStore.getState().project.timeline.zoom;
      const next = clampZoom(cur * factor);
      if (next === cur) return;
      const ms = (el.scrollLeft + anchorX - TRACK_HEADER_W) / cur;
      setZoom(next);
      // Apply after React lays out the wider/narrower content, otherwise the
      // scroll position clamps against the stale scrollWidth.
      requestAnimationFrame(() => {
        el.scrollLeft = Math.max(0, ms * next - anchorX + TRACK_HEADER_W);
      });
    },
    [setZoom],
  );

  const onWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const rect = e.currentTarget.getBoundingClientRect();
      zoomAround(e.deltaY < 0 ? 1.15 : 1 / 1.15, e.clientX - rect.left);
    }
  };

  // Two-finger pinch zoom for touch / trackpad gestures — anchored to the
  // viewport centre.
  usePinchZoom(containerRef, {
    onZoom: (factor) => {
      const el = containerRef.current;
      zoomAround(factor, el ? el.clientWidth / 2 : 0);
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

  // Marquee (rubber-band) selection — Cmd/Ctrl+drag over the background.
  // Coordinates are relative to the [data-tl-inner] element.
  const [marquee, setMarquee] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(
    null,
  );

  const innerPoint = (e: React.PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    // Only act when the press landed on the ruler / background, not a clip.
    const target = e.target as HTMLElement;
    if (target.closest("[data-clip]")) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    if (e.metaKey || e.ctrlKey) {
      const p = innerPoint(e);
      setMarquee({ x0: p.x, y0: p.y, x1: p.x, y1: p.y });
      return;
    }
    seekFromPointer(e.clientX);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if ((e.buttons & 1) === 0) return;
    if (marquee) {
      const p = innerPoint(e);
      setMarquee({ ...marquee, x1: p.x, y1: p.y });
      return;
    }
    seekFromPointer(e.clientX);
  };

  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!marquee) return;
    const inner = e.currentTarget;
    const innerRect = inner.getBoundingClientRect();
    const [left, right] = [Math.min(marquee.x0, marquee.x1), Math.max(marquee.x0, marquee.x1)];
    const [top, bottom] = [Math.min(marquee.y0, marquee.y1), Math.max(marquee.y0, marquee.y1)];
    const msFrom = (left - TRACK_HEADER_W) / zoom;
    const msTo = (right - TRACK_HEADER_W) / zoom;

    // Tracks whose row intersects the marquee vertically.
    const hitTrackIds = new Set<string>();
    for (const row of inner.querySelectorAll<HTMLElement>("[data-track]")) {
      const r = row.getBoundingClientRect();
      const rowTop = r.top - innerRect.top;
      const rowBottom = rowTop + r.height;
      if (rowBottom >= top && rowTop <= bottom && row.dataset.track) {
        hitTrackIds.add(row.dataset.track);
      }
    }

    const ids = useProjectStore
      .getState()
      .project.timeline.tracks.filter((tr) => hitTrackIds.has(tr.id))
      .flatMap((tr) =>
        tr.clips
          .filter((c) => c.start < msTo && c.start + c.duration > msFrom)
          .map((c) => c.id),
      );
    useSelectionStore.getState().selectMany(ids);
    setMarquee(null);
  };

  return (
    <div className="flex h-full flex-col bg-panel-1">
      <div className="flex items-center justify-between border-b border-white/5 px-3 py-1.5">
        <div className="flex items-center gap-2">
          <span className="text-xs uppercase tracking-wider text-ink-3">{t("timeline.title")}</span>
          <button
            type="button"
            className="btn-ghost px-1.5 py-0.5 text-2xs"
            onClick={() => addNewTrack("video")}
            title={t("timeline.addVideoTrack")}
          >
            <Plus className="size-3" /> V
          </button>
          <button
            type="button"
            className="btn-ghost px-1.5 py-0.5 text-2xs"
            onClick={() => addNewTrack("audio")}
            title={t("timeline.addAudioTrack")}
          >
            <Plus className="size-3" /> A
          </button>
          <button
            type="button"
            className="btn-ghost px-1.5 py-0.5 text-2xs"
            onClick={() => useProjectStore.getState().addTextClipAtPlayhead("Title")}
            title={t("timeline.addTextClip")}
          >
            <Plus className="size-3" /> T
          </button>
          <details className="relative">
            <summary className="btn-ghost cursor-pointer list-none px-1.5 py-0.5 text-2xs">
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
            <summary className="btn-ghost cursor-pointer list-none px-1.5 py-0.5 text-2xs">
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
            className="btn-ghost px-1.5 py-0.5 text-2xs"
            onClick={() => useProjectStore.getState().addAdjustmentClipAtPlayhead()}
            title={t("timeline.addAdjustment")}
          >
            <Plus className="size-3" /> {t("timeline.adjustment")}
          </button>
          <div className="mx-1 h-4 w-px bg-white/10" />
          <button
            type="button"
            className="btn-ghost px-1.5 py-0.5 text-2xs"
            onClick={() => useRangeStore.getState().setIn(useProjectStore.getState().project.timeline.playhead)}
            title={t("range.setIn")}
          >
            {t("range.in")}
          </button>
          <button
            type="button"
            className="btn-ghost px-1.5 py-0.5 text-2xs"
            onClick={() => useRangeStore.getState().setOut(useProjectStore.getState().project.timeline.playhead)}
            title={t("range.setOut")}
          >
            {t("range.out")}
          </button>
          {hasRange && (
            <button
              type="button"
              className="btn-ghost px-1.5 py-0.5 text-2xs text-ink-3"
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
        data-tl-scroll
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
          <SnapGuide />
          <SkimLine />
          <PeerCursors />
        </div>
      </div>
    </div>
  );
}
