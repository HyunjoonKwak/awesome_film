"use client";

import { useEffect, useMemo, useRef } from "react";
import type { ID } from "@cut/core";
import { useProjectStore, selectPlayhead } from "@/stores/project-store";
import { usePlaybackStore } from "@/stores/playback-store";
import { Compositor } from "@/renderer/compositor";
import { useT } from "@/i18n/use-t";
import { RegionOverlay } from "./region-overlay";
import { GuidesOverlay } from "./guides-overlay";
import { PreviewControls } from "./preview-controls";

// Phase 3 preview: WebGL2 compositor. Visible clips at the playhead are
// stacked and drawn into a single canvas, replacing the phase-1 single
// <video> element. Frame-accurate WebCodecs decode comes in phase 3.1.

export function PreviewViewport() {
  const project = useProjectStore((s) => s.project);
  const playhead = useProjectStore(selectPlayhead);
  const playing = usePlaybackStore((s) => s.playing);
  const setPlayhead = useProjectStore((s) => s.setPlayheadMs);
  const fps = project.framerate;
  const t = useT();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const compositorRef = useRef<Compositor | null>(null);

  const assetById = useMemo(() => {
    const map = new Map(project.mediaLibrary.map((a) => [a.id, a]));
    return (id: ID) => map.get(id);
  }, [project.mediaLibrary]);

  // Lazily create the compositor once the canvas mounts.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (!compositorRef.current) {
      try {
        compositorRef.current = new Compositor(canvas);
      } catch (err) {
        console.error("Failed to init WebGL compositor", err);
        return;
      }
    }
    const compositor = compositorRef.current;
    compositor.setPlayheadGetter(() => useProjectStore.getState().project.timeline.playhead);

    const ro = new ResizeObserver(() => {
      const rect = canvas.getBoundingClientRect();
      compositor.resize(rect.width, rect.height);
    });
    ro.observe(canvas);
    return () => {
      ro.disconnect();
    };
  }, []);

  // Redraw on every playhead change while paused, and on rAF while playing.
  useEffect(() => {
    const compositor = compositorRef.current;
    if (!compositor) return;
    let raf = 0;
    let cancelled = false;
    const draw = () => {
      if (cancelled) return;
      void compositor.renderFrame(useProjectStore.getState().project, assetById);
    };
    if (playing) {
      const tick = () => {
        if (cancelled) return;
        const cur = useProjectStore.getState().project.timeline.playhead;
        // Shuttle: advance by the playback rate (negative = reverse).
        const rate = usePlaybackStore.getState().rate;
        const next = cur + (1000 / fps) * rate;
        if (next <= 0) {
          setPlayhead(0);
          usePlaybackStore.getState().setPlaying(false);
        } else {
          setPlayhead(next);
        }
        draw();
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    } else {
      draw();
    }
    return () => {
      cancelled = true;
      if (raf) cancelAnimationFrame(raf);
    };
  }, [playing, playhead, project, assetById, fps, setPlayhead]);

  const { w, h } = project.resolution;

  return (
    <div className="relative flex h-full w-full items-center justify-center p-4">
      <PreviewControls />
      <div
        className="relative max-h-full max-w-full overflow-hidden rounded-md bg-black shadow-2xl"
        style={{ aspectRatio: `${w} / ${h}` }}
      >
        <canvas ref={canvasRef} data-preview-canvas className="size-full" />
        <RegionOverlay />
        <GuidesOverlay />
        {project.mediaLibrary.length === 0 && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-xs text-ink-3">
            {t("preview.empty")}
          </div>
        )}
      </div>
    </div>
  );
}
