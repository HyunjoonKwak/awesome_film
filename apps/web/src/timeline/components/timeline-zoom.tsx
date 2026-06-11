"use client";

import { Maximize2, ZoomIn, ZoomOut } from "lucide-react";
import { useProjectStore, selectZoom } from "@/stores/project-store";
import { useT } from "@/i18n/use-t";
import { clampZoom } from "../constants";
import { zoomToFit } from "../zoom-to-fit";

const STEP = 1.4;

export function TimelineZoom() {
  const zoom = useProjectStore(selectZoom);
  const setZoom = useProjectStore((s) => s.setZoomLevel);
  const t = useT();

  return (
    <div className="flex items-center gap-1 text-xs text-ink-3">
      <button
        type="button"
        className="btn-ghost px-1.5 py-1"
        onClick={() => setZoom(clampZoom(zoom / STEP))}
        aria-label={t("timeline.zoomOut")}
        title={t("timeline.zoomOut")}
      >
        <ZoomOut className="size-3.5" />
      </button>
      <span className="w-14 text-center font-mono">{(zoom * 1000).toFixed(1)} px/s</span>
      <button
        type="button"
        className="btn-ghost px-1.5 py-1"
        onClick={() => setZoom(clampZoom(zoom * STEP))}
        aria-label={t("timeline.zoomIn")}
        title={t("timeline.zoomIn")}
      >
        <ZoomIn className="size-3.5" />
      </button>
      <button
        type="button"
        className="btn-ghost px-1.5 py-1"
        onClick={zoomToFit}
        aria-label={t("timeline.zoomFit")}
        title={`${t("timeline.zoomFit")} (⇧Z)`}
      >
        <Maximize2 className="size-3.5" />
      </button>
    </div>
  );
}
