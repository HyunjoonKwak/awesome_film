"use client";

import { Grid3x3, Crop } from "lucide-react";
import { useProjectStore } from "@/stores/project-store";
import { useViewStore } from "@/stores/view-store";
import { useT } from "@/i18n/use-t";

// Reframe presets expressed as aspect ratios; the longer side is scaled to a
// sensible base so common social formats land on familiar pixel sizes.
const REFRAME: readonly { id: string; label: string; w: number; h: number }[] = [
  { id: "16:9", label: "16:9", w: 1920, h: 1080 },
  { id: "9:16", label: "9:16", w: 1080, h: 1920 },
  { id: "1:1", label: "1:1", w: 1080, h: 1080 },
  { id: "4:5", label: "4:5", w: 1080, h: 1350 },
  { id: "4:3", label: "4:3", w: 1440, h: 1080 },
  { id: "21:9", label: "21:9", w: 2560, h: 1080 },
];

export function PreviewControls() {
  const showGuides = useViewStore((s) => s.showGuides);
  const toggleGuides = useViewStore((s) => s.toggleGuides);
  const setResolution = useProjectStore((s) => s.setResolution);
  const res = useProjectStore((s) => s.project.resolution);
  const t = useT();

  const currentId = `${res.w}x${res.h}`;
  const matched = REFRAME.find((r) => r.w === res.w && r.h === res.h)?.id ?? "";

  return (
    <div className="absolute right-2 top-2 z-10 flex items-center gap-1">
      <button
        type="button"
        onClick={toggleGuides}
        title={t("preview.guides")}
        aria-pressed={showGuides}
        className={`rounded p-1 ${showGuides ? "bg-accent text-white" : "bg-black/40 text-ink-2 hover:text-ink-1"}`}
      >
        <Grid3x3 className="size-3.5" />
      </button>
      <div className="flex items-center gap-1 rounded bg-black/40 px-1 text-ink-2">
        <Crop className="size-3" />
        <select
          value={matched}
          onChange={(e) => {
            const r = REFRAME.find((x) => x.id === e.target.value);
            if (r) setResolution(r.w, r.h);
          }}
          title={t("preview.reframe")}
          className="bg-transparent py-1 text-[11px] text-ink-1 outline-none"
        >
          {matched === "" && (
            <option value="" className="bg-panel-2">
              {currentId}
            </option>
          )}
          {REFRAME.map((r) => (
            <option key={r.id} value={r.id} className="bg-panel-2">
              {r.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
