"use client";

import { Headphones, Lock, Trash2, Unlock, Volume2, VolumeX } from "lucide-react";
import type { Track } from "@cut/core";
import { useProjectStore, selectZoom } from "@/stores/project-store";
import { useT } from "@/i18n/use-t";
import { TimelineClip } from "./timeline-clip";
import { cn } from "@/lib/cn";

interface Props {
  track: Track;
  width: number;
}

export function TimelineTrack({ track, width }: Props) {
  const zoom = useProjectStore(selectZoom);
  const toggleMute = useProjectStore((s) => s.toggleTrackMute);
  const toggleSolo = useProjectStore((s) => s.toggleTrackSolo);
  const toggleLock = useProjectStore((s) => s.toggleTrackLock);
  const removeTrack = useProjectStore((s) => s.removeTrackById);
  const t = useT();

  return (
    <div className="flex items-stretch gap-0" data-track={track.id} data-track-kind={track.kind}>
      <div
        className={cn(
          "group sticky left-0 z-10 flex w-24 shrink-0 items-center justify-between gap-1",
          "border-y border-r border-white/5 bg-panel-2 px-2 text-xs",
        )}
        style={{ height: track.height }}
      >
        <span className="font-medium text-ink-1">{track.name}</span>
        <span className="flex items-center gap-0.5">
          <button
            type="button"
            className="rounded p-0.5 text-ink-3 hover:bg-white/10 hover:text-ink-1"
            onClick={() => toggleMute(track.id)}
            title={track.muted ? t("timeline.unmute") : t("timeline.mute")}
          >
            {track.muted ? <VolumeX className="size-3" /> : <Volume2 className="size-3" />}
          </button>
          <button
            type="button"
            className={cn(
              "rounded p-0.5 hover:bg-white/10 hover:text-ink-1",
              track.solo ? "text-amber-400" : "text-ink-3",
            )}
            onClick={() => toggleSolo(track.id)}
            title={track.solo ? t("timeline.unsolo") : t("timeline.solo")}
          >
            <Headphones className="size-3" />
          </button>
          <button
            type="button"
            className="rounded p-0.5 text-ink-3 hover:bg-white/10 hover:text-ink-1"
            onClick={() => toggleLock(track.id)}
            title={track.locked ? t("timeline.unlock") : t("timeline.lock")}
          >
            {track.locked ? <Lock className="size-3" /> : <Unlock className="size-3" />}
          </button>
          <button
            type="button"
            className="rounded p-0.5 text-ink-3 opacity-0 hover:bg-red-500/20 hover:text-red-300 group-hover:opacity-100"
            onClick={() => removeTrack(track.id)}
            title={t("timeline.deleteTrack")}
          >
            <Trash2 className="size-3" />
          </button>
        </span>
      </div>
      <div
        className="relative border-y border-white/5 bg-panel-2/40"
        style={{ width: width - 96, height: track.height }}
      >
        <GridLines width={width - 96} zoom={zoom} />
        {track.clips.map((clip) => (
          <TimelineClip
            key={clip.id}
            clip={clip}
            trackHeight={track.height}
            trackLocked={track.locked}
          />
        ))}
      </div>
    </div>
  );
}

function GridLines({ width, zoom }: { width: number; zoom: number }) {
  const step = 1000;
  const count = Math.ceil(width / (step * zoom));
  return (
    <svg className="absolute inset-0 size-full" preserveAspectRatio="none">
      {Array.from({ length: count }).map((_, i) => {
        const x = i * step * zoom;
        return (
          <line
            key={i}
            x1={x}
            x2={x}
            y1={0}
            y2="100%"
            stroke="rgba(255,255,255,0.04)"
            strokeWidth={1}
          />
        );
      })}
    </svg>
  );
}
